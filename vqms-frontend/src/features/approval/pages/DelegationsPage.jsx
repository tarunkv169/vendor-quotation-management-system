import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Modal from '@/components/common/Modal';
import Input, { Textarea } from '@/components/common/Input';
import Alert from '@/components/common/Alert';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import StatusBadge from '@/components/common/StatusBadge';
import { IdText } from '@/components/common/DetailList';
import { isUuid } from '@/components/common/EntitySelect';
import { applyFieldErrors } from '@/utils/errors';
import { formatDateTime } from '@/utils/formatDate';
import { approvalKeys, approvalService } from '../approvalService';

const schema = z
  .object({
    delegateId: z.string().trim().refine(isUuid, 'Enter the user ID of the delegate'),
    validFrom: z.string().min(1, 'Start is required'),
    validUntil: z.string().min(1, 'End is required'),
    reason: z.string().trim().max(500),
  })
  .refine((values) => new Date(values.validUntil) > new Date(values.validFrom), { path: ['validUntil'], message: 'End must be after start' });

function DelegateDialog({ open, onClose }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { delegateId: '', validFrom: '', validUntil: '', reason: '' } });

  const create = useMutation({
    // Instants are sent in ISO-8601 UTC.
    mutationFn: (values) =>
      approvalService.delegate({
        delegateId: values.delegateId,
        validFrom: new Date(values.validFrom).toISOString(),
        validUntil: new Date(values.validUntil).toISOString(),
        reason: values.reason || undefined,
      }),
    meta: { silent: true, successMessage: 'Delegation created' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.delegations });
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
      title="Delegate approvals"
      description="The delegate can decide your approval steps during this period."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Delegate
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {errors.root && <Alert tone="error" className="sm:col-span-2">{errors.root.message}</Alert>}
        <Input label="Delegate user ID" required error={errors.delegateId?.message} {...register('delegateId')} className="sm:col-span-2" />
        <Input label="Valid from" type="datetime-local" required error={errors.validFrom?.message} {...register('validFrom')} />
        <Input label="Valid until" type="datetime-local" required error={errors.validUntil?.message} {...register('validUntil')} />
        <Textarea label="Reason" rows={2} error={errors.reason?.message} {...register('reason')} className="sm:col-span-2" />
      </form>
    </Modal>
  );
}

export default function DelegationsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const delegations = useQuery({ queryKey: approvalKeys.delegations, queryFn: ({ signal }) => approvalService.myDelegations(signal) });

  const revoke = useMutation({
    mutationFn: (id) => approvalService.revokeDelegation(id),
    meta: { successMessage: 'Delegation revoked' },
    onSuccess: () => {
      setRevoking(null);
      queryClient.invalidateQueries({ queryKey: approvalKeys.delegations });
    },
  });

  return (
    <>
      <PageHeader title="Delegations" description="Hand over your approval authority for a period (e.g. leave)." actions={<Button icon={Plus} onClick={() => setCreating(true)}>New delegation</Button>} />
      <div className="card overflow-hidden">
        <DataTable
          columns={[
            { key: 'delegateId', header: 'Delegate', render: (row) => <IdText value={row.delegateId} /> },
            { key: 'delegatorRole', header: 'Your role', render: (row) => <StatusBadge status={row.delegatorRole} tone="gray" /> },
            { key: 'validFrom', header: 'From', render: (row) => formatDateTime(row.validFrom) },
            { key: 'validUntil', header: 'Until', render: (row) => formatDateTime(row.validUntil) },
            { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
            { key: 'state', header: 'State', render: (row) => <StatusBadge status={!row.active ? 'CANCELLED' : row.effectiveNow ? 'ACTIVE' : 'PENDING'} label={!row.active ? 'Revoked' : row.effectiveNow ? 'Active' : 'Scheduled'} /> },
            {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              align: 'right',
              render: (row) =>
                row.active && (
                  <Button variant="ghost" size="sm" onClick={() => setRevoking(row)}>
                    Revoke
                  </Button>
                ),
            },
          ]}
          rows={delegations.data || []}
          loading={delegations.isLoading}
          error={delegations.error}
          onRetry={delegations.refetch}
          empty={{ title: 'No delegations' }}
        />
      </div>
      <DelegateDialog open={creating} onClose={() => setCreating(false)} />
      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoke.mutate(revoking.id)}
        loading={revoke.isPending}
        title="Revoke delegation"
        message="The delegate will no longer be able to decide on your behalf."
        tone="danger"
        confirmLabel="Revoke"
      />
    </>
  );
}
