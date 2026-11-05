import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageHeader from '@/components/common/PageHeader';
import FormSection, { FormActions } from '@/components/common/FormSection';
import Input, { Textarea } from '@/components/common/Input';
import Alert from '@/components/common/Alert';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { applyFieldErrors } from '@/utils/errors';
import { vendorKeys, vendorService } from '../vendorService';

// Mirrors VendorRequest.
const schema = z.object({
  name: z.string().trim().min(1, 'Vendor name is required').max(150, 'Vendor name must not exceed 150 characters'),
  email: z.string().trim().min(1, 'Vendor email is required').email('Please provide a valid email address').max(150),
  phone: z.string().trim().max(20, 'Phone must not exceed 20 characters'),
  address: z.string().trim().max(255, 'Address must not exceed 255 characters'),
});

export default function VendorFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const vendor = useQuery({ queryKey: vendorKeys.one(id), queryFn: ({ signal }) => vendorService.get(id, signal), enabled: editing });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', phone: '', address: '' } });

  useEffect(() => {
    if (vendor.data) reset({ name: vendor.data.name || '', email: vendor.data.email || '', phone: vendor.data.phone || '', address: vendor.data.address || '' });
  }, [vendor.data, reset]);

  const save = useMutation({
    mutationFn: (values) => (editing ? vendorService.update(id, values) : vendorService.create(values)),
    meta: { silent: true, successMessage: editing ? 'Vendor updated' : 'Vendor registered' },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
      navigate(`/vendors/${saved.id}`, { replace: true });
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) setError('root', { message: error.message });
    },
  });

  if (editing && vendor.isLoading) return <DetailSkeleton />;
  if (editing && vendor.error) return <ErrorState error={vendor.error} onRetry={vendor.refetch} />;

  return (
    <>
      <PageHeader
        title={editing ? 'Edit vendor' : 'Register vendor'}
        description="Contact details used on quotations, comparisons and notifications."
      />
      <form onSubmit={handleSubmit((values) => save.mutate(values))} className="max-w-5xl" noValidate>
        {errors.root && (
          <Alert tone="error" className="mb-5">
            {errors.root.message}
          </Alert>
        )}
        <div className="card divide-y divide-line">
          <FormSection title="Company" description="The legal or trading name shown to procurement staff.">
            <Input label="Vendor name" required placeholder="e.g. Acme Supplies Pvt Ltd" error={errors.name?.message} {...register('name')} />
          </FormSection>
          <FormSection title="Contact" description="Where quotation requests and notifications are sent.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Email" type="email" required placeholder="sales@example.com" error={errors.email?.message} {...register('email')} />
              <Input label="Phone" type="tel" placeholder="+91 98765 43210" error={errors.phone?.message} {...register('phone')} />
            </div>
          </FormSection>
          <FormSection title="Address" description="Optional. Registered or billing address.">
            <Textarea label="Address" rows={3} error={errors.address?.message} {...register('address')} />
          </FormSection>
          <FormActions
            note={editing ? 'Changes apply to future quotations and notifications.' : 'New vendors are active and can quote immediately.'}
            onCancel={() => navigate(-1)}
            loading={save.isPending}
            submitLabel={editing ? 'Save changes' : 'Register vendor'}
          />
        </div>
      </form>
    </>
  );
}
