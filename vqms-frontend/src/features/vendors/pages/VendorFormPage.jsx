import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Building2, Info, Mail, MapPin, Phone, UserPlus, UserRoundPen } from 'lucide-react';
import Button from '@/components/common/Button';
import Input, { Textarea } from '@/components/common/Input';
import Alert from '@/components/common/Alert';
import StatusBadge from '@/components/common/StatusBadge';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { applyFieldErrors } from '@/utils/errors';
import { vendorKeys, vendorService } from '../vendorService';
import { vendorInitials, vendorLocation } from '../vendorUtils';

// Mirrors VendorRequest.
const schema = z.object({
  name: z.string().trim().min(1, 'Vendor name is required').max(150, 'Vendor name must not exceed 150 characters'),
  email: z.string().trim().min(1, 'Vendor email is required').email('Please provide a valid email address').max(150),
  phone: z.string().trim().max(20, 'Phone must not exceed 20 characters'),
  address: z.string().trim().max(255, 'Address must not exceed 255 characters'),
});

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="grid gap-x-8 gap-y-4 px-5 py-6 md:grid-cols-[220px_1fr]">
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

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
    control,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', phone: '', address: '' } });
  const values = useWatch({ control });

  useEffect(() => {
    if (vendor.data) reset({ name: vendor.data.name || '', email: vendor.data.email || '', phone: vendor.data.phone || '', address: vendor.data.address || '' });
  }, [vendor.data, reset]);

  const save = useMutation({
    mutationFn: (payload) => (editing ? vendorService.update(id, payload) : vendorService.create(payload)),
    meta: { silent: true, successMessage: editing ? 'Vendor updated' : 'Vendor registered' },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'vendor-count'] });
      queryClient.invalidateQueries({ queryKey: ['lookup'] });
      navigate(`/vendors/${saved.id}`, { replace: true });
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) setError('root', { message: error.message });
    },
  });

  if (editing && vendor.isLoading) return <DetailSkeleton />;
  if (editing && vendor.error) return <ErrorState error={vendor.error} onRetry={vendor.refetch} />;

  const HeaderIcon = editing ? UserRoundPen : UserPlus;
  const location = vendorLocation(values);

  return (
    <>
      <Link to={editing ? `/vendors/${id}` : '/vendors'} className="mb-4 inline-flex items-center gap-1.5 text-13 font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {editing ? 'Back to vendor' : 'Back to vendors'}
      </Link>

      <div className="mb-6 flex min-w-0 items-center gap-4">
        <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 sm:flex">
          <HeaderIcon className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{editing ? 'Edit vendor' : 'Register vendor'}</h1>
          <p className="mt-1 text-sm text-slate-500">Contact details used on quotations, comparisons and notifications.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((payload) => save.mutate(payload))} noValidate className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="min-w-0">
          {errors.root && (
            <Alert tone="error" className="mb-5">
              {errors.root.message}
            </Alert>
          )}
          <div className="card divide-y divide-line">
            <Section icon={Building2} title="Company" description="The legal or trading name shown to procurement staff.">
              <Input label="Vendor name" required placeholder="e.g. Acme Supplies Pvt Ltd" error={errors.name?.message} {...register('name')} />
            </Section>
            <Section icon={Mail} title="Contact" description="Where quotation requests and notifications are sent.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Email" type="email" required placeholder="sales@example.com" error={errors.email?.message} {...register('email')} />
                <Input label="Phone" type="tel" placeholder="+91 98765 43210" error={errors.phone?.message} {...register('phone')} />
              </div>
            </Section>
            <Section icon={MapPin} title="Address" description="Optional. Registered or billing address. The last part (usually the city) is shown as the location.">
              <Textarea label="Address" rows={3} placeholder="e.g. 12 MG Road, Pune" error={errors.address?.message} {...register('address')} />
            </Section>
            <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
              <p className="text-xs text-slate-500 sm:mr-auto">
                {editing ? 'Changes apply to future quotations and notifications.' : 'New vendors are active and can quote immediately.'}
              </p>
              <Button variant="secondary" onClick={() => navigate(-1)} disabled={save.isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending} disabled={editing && !isDirty} icon={editing ? undefined : UserPlus}>
                {editing ? 'Save changes' : 'Register vendor'}
              </Button>
            </div>
          </div>
        </div>

        {/* Live preview of the vendor as it appears in the list */}
        <aside className="card p-5" aria-label="Preview">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">Preview</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700" aria-hidden="true">
              {vendorInitials(values.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{values.name?.trim() || 'Vendor name'}</p>
              <p className="truncate text-xs text-slate-500">{values.email?.trim() || 'email@company.com'}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2.5 border-t border-line pt-4 text-13">
            <div className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className={values.phone?.trim() ? 'text-slate-800' : 'text-slate-400'}>{values.phone?.trim() || 'No phone'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className={location ? 'text-slate-800' : 'text-slate-400'}>{location || 'No location'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Info className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span>
                <StatusBadge status={editing ? vendor.data?.status : 'ACTIVE'} />
              </span>
            </div>
          </div>
        </aside>
      </form>
    </>
  );
}
