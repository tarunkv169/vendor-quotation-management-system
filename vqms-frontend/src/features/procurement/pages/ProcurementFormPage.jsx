import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import Input, { Textarea } from '@/components/common/Input';
import Button from '@/components/common/Button';
import Alert from '@/components/common/Alert';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { applyFieldErrors } from '@/utils/errors';
import { toInputDateTime } from '@/utils/formatDate';
import { procurementKeys, procurementService } from '../procurementService';
import { emptyItem, requestSchema, toRequestPayload } from '../components/procurementSchemas';
import ItemFields from '../components/ItemFields';
import FormSection from '@/components/common/FormSection';

const EMPTY = { title: '', description: '', quantity: '1', unit: '', requiredBy: '', budget: '', items: [] };

export default function ProcurementFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const request = useQuery({ queryKey: procurementKeys.one(id), queryFn: ({ signal }) => procurementService.get(id, signal), enabled: editing });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(requestSchema), defaultValues: EMPTY });
  const items = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (request.data) {
      const data = request.data;
      reset({
        title: data.title || '',
        description: data.description || '',
        quantity: String(data.quantity ?? 1),
        unit: data.unit || '',
        requiredBy: toInputDateTime(data.requiredBy),
        budget: data.budget != null ? String(data.budget) : '',
        items: [],
      });
    }
  }, [request.data, reset]);

  const save = useMutation({
    mutationFn: (values) => {
      const payload = toRequestPayload(values);
      // On edit, items are maintained on the detail page through the item endpoints.
      if (editing) delete payload.items;
      return editing ? procurementService.update(id, payload) : procurementService.create(payload);
    },
    meta: { silent: true, successMessage: editing ? 'Request updated' : 'Draft request created' },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.all });
      navigate(`/procurement/${saved.id}`, { replace: true });
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) setError('root', { message: error.message });
    },
  });

  if (editing && request.isLoading) return <DetailSkeleton />;
  if (editing && request.error) return <ErrorState error={request.error} onRetry={request.refetch} />;
  if (editing && request.data?.status !== 'DRAFT') {
    return <Alert tone="warning" title="This request can no longer be edited">Only draft requests can be changed.</Alert>;
  }

  return (
    <>
      <PageHeader
        title={editing ? 'Edit procurement request' : 'New procurement request'}
        description={editing ? 'Changes apply to the draft only.' : 'Describe what you need. Vendors are invited to quote once the request is approved.'}
      />
      <form onSubmit={handleSubmit((values) => save.mutate(values))} className="max-w-5xl" noValidate>
        {errors.root && <Alert tone="error" className="mb-5">{errors.root.message}</Alert>}
        <div className="card divide-y divide-line">
          <FormSection title="Request" description="What is needed and why. Approvers and vendors read this first.">
            <Input label="Title" required placeholder="e.g. 10 laptops for the sales team" error={errors.title?.message} {...register('title')} />
            <Textarea label="Description" required rows={4} hint="Business reason, specifications and any constraints." error={errors.description?.message} {...register('description')} />
          </FormSection>
          <FormSection title="Quantity and budget" description="Budget is optional and used during evaluation.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Quantity" type="number" min="1" step="1" required error={errors.quantity?.message} {...register('quantity')} inputClassName="num" />
              <Input label="Unit" required placeholder="e.g. pcs, licences" error={errors.unit?.message} {...register('unit')} />
              <Input label="Budget" type="number" min="0" step="0.01" placeholder="0.00" error={errors.budget?.message} {...register('budget')} inputClassName="num" />
            </div>
          </FormSection>
          <FormSection title="Timeline" description="The date by which the goods or services must be delivered.">
            <Input label="Required by" type="datetime-local" required error={errors.requiredBy?.message} {...register('requiredBy')} className="sm:max-w-xs" />
          </FormSection>
          {!editing && (
            <FormSection
              title="Line items"
              description="Optional. Items can also be added after the draft is saved."
              aside={
                <Button variant="secondary" size="sm" icon={Plus} onClick={() => items.append({ ...emptyItem })}>
                  Add item
                </Button>
              }
            >
              {items.fields.length === 0 ? (
                <div className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-13 text-slate-500">
                  No line items yet.{' '}
                  <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => items.append({ ...emptyItem })}>
                    Add the first item
                  </button>
                </div>
              ) : (
                <ol className="space-y-4">
                  {items.fields.map((item, index) => (
                    <li key={item.id} className="rounded-md border border-line">
                      <div className="flex items-center justify-between border-b border-line bg-slate-50/70 px-4 py-2">
                        <p className="text-13 font-medium text-slate-700">Item {index + 1}</p>
                        <Button variant="ghost" size="sm" icon={Trash} onClick={() => items.remove(index)} aria-label={`Remove item ${index + 1}`}>
                          Remove
                        </Button>
                      </div>
                      <div className="p-4">
                        <ItemFields register={register} errors={errors.items?.[index]} prefix={`items.${index}.`} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </FormSection>
          )}
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 rounded-b-lg bg-surface/95 px-5 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
            <p className="text-xs text-slate-500 sm:mr-auto">{editing ? 'Only draft requests can be edited.' : 'Saved as a draft. You can submit it for approval from the request page.'}</p>
            <Button variant="secondary" onClick={() => navigate(-1)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing ? 'Save changes' : 'Save draft'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

