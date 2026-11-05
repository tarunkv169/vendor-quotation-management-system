import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Modal from '@/components/common/Modal';
import Input, { Textarea } from '@/components/common/Input';
import Select from '@/components/common/Select';
import Alert from '@/components/common/Alert';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import StatusBadge from '@/components/common/StatusBadge';
import { applyFieldErrors } from '@/utils/errors';
import { formatCurrency } from '@/utils/formatCurrency';
import { CURRENCIES, humanize } from '@/utils/constants';
import { ROLES } from '@/utils/permissions';
import { approvalKeys, approvalService } from '../approvalService';

const LEVELS = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5'];
const APPROVER_ROLES = [ROLES.PROCUREMENT_MANAGER, ROLES.PROCUREMENT_ADMIN, ROLES.ADMIN, ROLES.EMPLOYEE];
const amount = (message) => z.string().trim().refine((value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) >= 0, message);
const int = (min, max, message) => z.string().trim().refine((value) => Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max, message);

// Mirrors ApprovalPolicyRequest.
const schema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_]{2,40}$/, 'Use 2–40 upper-case letters, digits or _'),
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().max(500),
  currencyCode: z.string().length(3),
  minAmount: amount('Enter a minimum amount (0 or more)'),
  maxAmount: z.string().trim().refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), 'Enter a valid amount'),
  mode: z.enum(['SEQUENTIAL', 'PARALLEL']),
  escalationRole: z.string().trim().min(1, 'Escalation role is required').max(40),
  escalationHours: int(1, 720, 'Between 1 and 720 hours'),
  priority: int(0, 1000, 'Between 0 and 1000'),
  levels: z
    .array(
      z.object({
        level: z.enum(LEVELS),
        requiredRole: z.string().trim().min(1, 'Required').max(40),
        approvalLimit: z.string().trim().refine((value) => Number(value) >= 0.01, 'At least 0.01'),
        deadlineHours: int(1, 720, '1–720'),
      }),
    )
    .min(1, 'Add at least one level')
    .max(5),
});

const roleOptions = APPROVER_ROLES.map((role) => ({ value: role, label: humanize(role) }));

function PolicyDialog({ open, onClose }) {
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      currencyCode: 'USD',
      minAmount: '0',
      maxAmount: '',
      mode: 'SEQUENTIAL',
      escalationRole: ROLES.ADMIN,
      escalationHours: '48',
      priority: '0',
      levels: [{ level: 'LEVEL_1', requiredRole: ROLES.PROCUREMENT_MANAGER, approvalLimit: '', deadlineHours: '48' }],
    },
  });
  const levels = useFieldArray({ control, name: 'levels' });

  const create = useMutation({
    mutationFn: (values) =>
      approvalService.createPolicy({
        ...values,
        description: values.description || undefined,
        minAmount: Number(values.minAmount),
        maxAmount: values.maxAmount === '' ? undefined : Number(values.maxAmount),
        escalationHours: Number(values.escalationHours),
        priority: Number(values.priority),
        levels: values.levels.map((level) => ({ ...level, approvalLimit: Number(level.approvalLimit), deadlineHours: Number(level.deadlineHours) })),
      }),
    meta: { silent: true, successMessage: 'Policy created' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.policies });
      reset();
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) setError('root', { message: error.message });
    },
  });
  const submit = handleSubmit((values) => create.mutate(values));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="New approval policy"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Create policy
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {errors.root && <Alert tone="error">{errors.root.message}</Alert>}
        <div className="grid gap-4 sm:grid-cols-6">
          <Input label="Code" required error={errors.code?.message} {...register('code')} className="sm:col-span-2" />
          <Input label="Name" required error={errors.name?.message} {...register('name')} className="sm:col-span-4" />
          <Textarea label="Description" rows={2} error={errors.description?.message} {...register('description')} className="sm:col-span-6" />
          <Select label="Currency" required options={CURRENCIES.map((code) => ({ value: code, label: code }))} {...register('currencyCode')} className="sm:col-span-2" />
          <Input label="Minimum amount" type="number" min="0" step="0.01" required error={errors.minAmount?.message} {...register('minAmount')} className="sm:col-span-2" />
          <Input label="Maximum amount" type="number" min="0" step="0.01" hint="Empty = no upper limit" error={errors.maxAmount?.message} {...register('maxAmount')} className="sm:col-span-2" />
          <Select label="Mode" required options={[{ value: 'SEQUENTIAL', label: 'Sequential' }, { value: 'PARALLEL', label: 'Parallel' }]} {...register('mode')} className="sm:col-span-2" />
          <Select label="Escalation role" required options={roleOptions} {...register('escalationRole')} className="sm:col-span-2" />
          <Input label="Escalate after (hours)" type="number" min="1" max="720" required error={errors.escalationHours?.message} {...register('escalationHours')} className="sm:col-span-1" />
          <Input label="Priority" type="number" min="0" max="1000" required error={errors.priority?.message} {...register('priority')} className="sm:col-span-1" />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Levels</p>
            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              disabled={levels.fields.length >= 5}
              onClick={() => levels.append({ level: LEVELS[levels.fields.length] || 'LEVEL_5', requiredRole: ROLES.PROCUREMENT_ADMIN, approvalLimit: '', deadlineHours: '48' })}
            >
              Add level
            </Button>
          </div>
          {errors.levels?.message && <p className="mb-2 text-sm text-red-600">{errors.levels.message}</p>}
          <div className="space-y-3">
            {levels.fields.map((field, index) => (
              <div key={field.id} className="grid items-end gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-9">
                <Select label="Level" options={LEVELS.map((level) => ({ value: level, label: humanize(level) }))} {...register(`levels.${index}.level`)} className="sm:col-span-2" />
                <Select label="Required role" options={roleOptions} {...register(`levels.${index}.requiredRole`)} className="sm:col-span-3" />
                <Input label="Approval limit" type="number" min="0.01" step="0.01" error={errors.levels?.[index]?.approvalLimit?.message} {...register(`levels.${index}.approvalLimit`)} className="sm:col-span-2" />
                <Input label="Deadline (h)" type="number" min="1" max="720" error={errors.levels?.[index]?.deadlineHours?.message} {...register(`levels.${index}.deadlineHours`)} className="sm:col-span-1" />
                <Button variant="ghost" size="icon" icon={X} aria-label={`Remove level ${index + 1}`} onClick={() => levels.remove(index)} disabled={levels.fields.length === 1} />
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function ApprovalPoliciesPage() {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canManage = can('approvalPolicy.manage');
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState(null);
  const policies = useQuery({ queryKey: approvalKeys.policies, queryFn: ({ signal }) => approvalService.policies(signal) });

  const deactivate = useMutation({
    mutationFn: (id) => approvalService.deactivatePolicy(id),
    meta: { successMessage: 'Policy deactivated' },
    onSuccess: () => {
      setDeactivating(null);
      queryClient.invalidateQueries({ queryKey: approvalKeys.policies });
    },
  });

  return (
    <>
      <PageHeader
        title="Approval policies"
        description="Amount bands decide which approval levels a recommendation must pass."
        actions={canManage && <Button icon={Plus} onClick={() => setCreating(true)}>New policy</Button>}
      />
      <div className="card overflow-hidden">
        <DataTable
          columns={[
            { key: 'code', header: 'Code', render: (row) => <span className="font-mono text-xs font-medium">{row.code}</span> },
            { key: 'name', header: 'Name', render: (row) => <span className="font-medium text-slate-900">{row.name}</span> },
            { key: 'band', header: 'Amount band', render: (row) => `${formatCurrency(row.minAmount, row.currencyCode)} – ${row.maxAmount != null ? formatCurrency(row.maxAmount, row.currencyCode) : 'no limit'}` },
            { key: 'mode', header: 'Mode', render: (row) => humanize(row.mode) },
            { key: 'levels', header: 'Levels', render: (row) => (row.levels || []).map((level) => humanize(level.requiredRole)).join(' → ') },
            { key: 'priority', header: 'Priority', align: 'right' },
            { key: 'active', header: 'Status', render: (row) => <StatusBadge status={row.active ? 'ACTIVE' : 'INACTIVE'} /> },
            canManage && {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              align: 'right',
              render: (row) =>
                row.active && (
                  <Button variant="ghost" size="sm" onClick={() => setDeactivating(row)}>
                    Deactivate
                  </Button>
                ),
            },
          ].filter(Boolean)}
          rows={policies.data || []}
          loading={policies.isLoading}
          error={policies.error}
          onRetry={policies.refetch}
          empty={{ title: 'No approval policies' }}
        />
      </div>
      {canManage && <PolicyDialog open={creating} onClose={() => setCreating(false)} />}
      <ConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivate.mutate(deactivating.id)}
        loading={deactivate.isPending}
        title="Deactivate policy"
        message={`New approvals will no longer use ${deactivating?.name}.`}
        tone="danger"
        confirmLabel="Deactivate"
      />
    </>
  );
}
