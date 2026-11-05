import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/common/PageHeader';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import SummaryPanel from '@/components/common/SummaryPanel';
import DetailList from '@/components/common/DetailList';
import StatusBadge from '@/components/common/StatusBadge';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { applyFieldErrors } from '@/utils/errors';
import { formatDateTime } from '@/utils/formatDate';
import { ROLE_LABELS } from '@/utils/permissions';
import { authService } from '../authService';

// Mirrors ProfileUpdateRequest: all fields optional.
const schema = z.object({
  fullName: z.string().trim().max(150, 'Full name cannot exceed 150 characters'),
  username: z.string().trim().min(3, 'Username must be between 3 and 100 characters').max(100),
  email: z.string().trim().email('Email must be valid'),
  newPassword: z.union([z.literal(''), z.string().min(6, 'Password must be at least 6 characters')]),
});

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['profile', user.userId];

  const profile = useQuery({ queryKey, queryFn: ({ signal }) => authService.me(user.userId, signal) });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { fullName: '', username: '', email: '', newPassword: '' } });

  useEffect(() => {
    if (profile.data) {
      reset({ fullName: profile.data.fullName || '', username: profile.data.username || '', email: profile.data.email || '', newPassword: '' });
    }
  }, [profile.data, reset]);

  const update = useMutation({
    mutationFn: (values) => authService.updateProfile(user.userId, { ...values, newPassword: values.newPassword || undefined }),
    meta: { successMessage: 'Profile updated', silent: true },
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) setError('root', { message: error.message });
    },
  });

  if (profile.isLoading) return <DetailSkeleton />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.refetch} />;

  const data = profile.data;
  return (
    <>
      <PageHeader title="Profile" description="Your account details." />
      <div className="grid gap-6 lg:grid-cols-3">
        <SummaryPanel title="Account" className="lg:col-span-1">
          <DetailList
            columns={1}
            items={[
              { label: 'Role', value: ROLE_LABELS[data.role] || data.role },
              { label: 'Status', value: <StatusBadge status={data.status} /> },
              { label: 'Last sign-in', value: formatDateTime(data.lastLoginAt) },
              { label: 'Member since', value: formatDateTime(data.createdAt) },
            ]}
          />
        </SummaryPanel>
        <SummaryPanel title="Edit profile" className="lg:col-span-2">
          <form onSubmit={handleSubmit((values) => update.mutate(values))} className="grid gap-4 sm:grid-cols-2" noValidate>
            {errors.root && <p className="text-sm text-red-600 sm:col-span-2">{errors.root.message}</p>}
            <Input label="Full name" error={errors.fullName?.message} {...register('fullName')} />
            <Input label="Username" required error={errors.username?.message} {...register('username')} />
            <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} className="sm:col-span-2" />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              hint="Leave empty to keep the current password."
              error={errors.newPassword?.message}
              {...register('newPassword')}
              className="sm:col-span-2"
            />
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" loading={update.isPending} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        </SummaryPanel>
      </div>
    </>
  );
}
