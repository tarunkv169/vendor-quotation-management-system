import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, X } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import PageHeader from '@/components/common/PageHeader';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import Modal from '@/components/common/Modal';
import Input, { Textarea } from '@/components/common/Input';
import Alert from '@/components/common/Alert';
import Tabs from '@/components/common/Tabs';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import StatusBadge from '@/components/common/StatusBadge';
import { applyFieldErrors } from '@/utils/errors';
import { normalizePage } from '@/utils/pagination';
import { formatDateTime } from '@/utils/formatDate';
import { ROLE_LABELS } from '@/utils/permissions';
import { authService } from '@/features/auth/authService';
import { settingsKeys, settingsService } from '../settingsService';

const schema = z.object({
  settingKey: z.string().trim().min(1, 'Key is required').max(100),
  settingValue: z.string().max(5000),
  settingType: z.string().trim().max(50),
  category: z.string().trim().max(100),
  description: z.string().trim().max(500),
});
const EMPTY = { settingKey: '', settingValue: '', settingType: 'STRING', category: '', description: '' };

function SettingDialog({ open, setting, onClose }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) {
      reset(setting ? { settingKey: setting.settingKey || '', settingValue: setting.settingValue || '', settingType: setting.settingType || '', category: setting.category || '', description: setting.description || '' } : EMPTY);
    }
  }, [open, setting, reset]);

  const save = useMutation({
    mutationFn: (values) => (setting ? settingsService.update(setting.settingKey, values) : settingsService.create(values)),
    meta: { silent: true, successMessage: 'Setting saved' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) setError('root', { message: error.message });
    },
  });
  const submit = handleSubmit((values) => save.mutate(values));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={setting ? 'Edit setting' : 'New setting'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {errors.root && <Alert tone="error" className="sm:col-span-2">{errors.root.message}</Alert>}
        <Input label="Key" required readOnly={Boolean(setting)} error={errors.settingKey?.message} {...register('settingKey')} className="sm:col-span-2" />
        <Textarea label="Value" rows={2} error={errors.settingValue?.message} {...register('settingValue')} className="sm:col-span-2" />
        <Input label="Type" error={errors.settingType?.message} {...register('settingType')} />
        <Input label="Category" error={errors.category?.message} {...register('category')} />
        <Textarea label="Description" rows={2} error={errors.description?.message} {...register('description')} className="sm:col-span-2" />
      </form>
    </Modal>
  );
}

function SystemSettings() {
  const queryClient = useQueryClient();
  const pager = usePagination({ size: 20 });
  const [dialog, setDialog] = useState({ open: false, setting: null });
  const [deleting, setDeleting] = useState(null);
  const params = { page: pager.page, size: pager.size };
  const query = useQuery({ queryKey: settingsKeys.list(params), queryFn: ({ signal }) => settingsService.list(params, signal), placeholderData: keepPreviousData });
  const page = normalizePage(query.data);
  const remove = useMutation({
    mutationFn: (key) => settingsService.remove(key),
    meta: { successMessage: 'Setting deleted' },
    onSuccess: () => {
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });

  return (
    <>
      <div className="flex justify-end p-4">
        <Button size="sm" icon={Plus} onClick={() => setDialog({ open: true, setting: null })}>
          New setting
        </Button>
      </div>
      <DataTable
        rowKey="settingKey"
        columns={[
          { key: 'settingKey', header: 'Key', render: (row) => <span className="font-mono text-xs font-medium text-slate-900">{row.settingKey}</span> },
          { key: 'settingValue', header: 'Value', render: (row) => <span className="line-clamp-2 break-all">{row.settingValue || '—'}</span> },
          { key: 'settingType', header: 'Type' },
          { key: 'category', header: 'Category', render: (row) => row.category || '—' },
          { key: 'updatedAt', header: 'Updated', render: (row) => formatDateTime(row.updatedAt) },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right',
            render: (row) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" icon={Pencil} aria-label={`Edit ${row.settingKey}`} onClick={() => setDialog({ open: true, setting: row })} />
                <Button variant="ghost" size="icon-sm" icon={X} aria-label={`Delete ${row.settingKey}`} onClick={() => setDeleting(row)} />
              </div>
            ),
          },
        ]}
        rows={page.items}
        loading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        empty={{ title: 'No system settings' }}
      />
      <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} />
      <SettingDialog open={dialog.open} setting={dialog.setting} onClose={() => setDialog({ open: false, setting: null })} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.settingKey)}
        loading={remove.isPending}
        title="Delete setting"
        message={`Delete ${deleting?.settingKey}?`}
        tone="danger"
        confirmLabel="Delete"
      />
    </>
  );
}

function Users() {
  const queryClient = useQueryClient();
  const pager = usePagination({ size: 20 });
  const [target, setTarget] = useState(null);
  const params = { page: pager.page, size: pager.size };
  const query = useQuery({ queryKey: ['users', params], queryFn: ({ signal }) => authService.listUsers(params, signal), placeholderData: keepPreviousData });
  const page = normalizePage(query.data);
  const deactivate = useMutation({
    mutationFn: (id) => authService.deactivateUser(id),
    meta: { successMessage: 'User deactivated' },
    onSuccess: () => {
      setTarget(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <>
      <DataTable
        columns={[
          { key: 'fullName', header: 'Name', render: (row) => <span className="font-medium text-slate-900">{row.fullName || row.username}</span> },
          { key: 'username', header: 'Username' },
          { key: 'email', header: 'Email' },
          { key: 'role', header: 'Role', render: (row) => ROLE_LABELS[row.role] || row.role },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'lastLoginAt', header: 'Last sign-in', render: (row) => formatDateTime(row.lastLoginAt) },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right',
            render: (row) =>
              row.status === 'ACTIVE' && (
                <Button variant="ghost" size="sm" onClick={() => setTarget(row)}>
                  Deactivate
                </Button>
              ),
          },
        ]}
        rows={page.items}
        loading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        empty={{ title: 'No users' }}
      />
      <Pagination {...page} onPageChange={pager.setPage} onSizeChange={pager.setSize} />
      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={() => deactivate.mutate(target.id)}
        loading={deactivate.isPending}
        title="Deactivate user"
        message={`${target?.username} will no longer be able to sign in.`}
        tone="danger"
        confirmLabel="Deactivate"
      />
    </>
  );
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'system';
  return (
    <>
      <PageHeader title="Settings" description="System configuration and user accounts." />
      <div className="card overflow-hidden">
        <Tabs
          className="px-4"
          value={tab}
          onChange={(next) => setSearchParams(next === 'system' ? {} : { tab: next }, { replace: true })}
          tabs={[
            { value: 'system', label: 'System settings' },
            { value: 'users', label: 'Users' },
          ]}
        />
        {tab === 'users' ? <Users /> : <SystemSettings />}
      </div>
    </>
  );
}
