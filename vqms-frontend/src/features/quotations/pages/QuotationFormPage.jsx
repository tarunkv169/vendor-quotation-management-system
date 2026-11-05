import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash, Upload } from 'lucide-react';
import { useRequestOptions, useVendorOptions } from '@/hooks/useLookups';
import PageHeader from '@/components/common/PageHeader';
import Input, { Textarea } from '@/components/common/Input';
import Select from '@/components/common/Select';
import EntitySelect, { isUuid } from '@/components/common/EntitySelect';
import Button from '@/components/common/Button';
import SummaryPanel from '@/components/common/SummaryPanel';
import Alert from '@/components/common/Alert';
import Tabs from '@/components/common/Tabs';
import FileDrop from '@/components/common/FileDrop';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { applyFieldErrors } from '@/utils/errors';
import { CURRENCIES } from '@/utils/constants';
import { quotationKeys, quotationService, QUOTATION_RULES } from '../quotationService';
import { emptyQuotationItem, fromQuotation, quotationSchema, toQuotationPayload } from '../components/quotationSchemas';
import QuotationItemFields from '../components/QuotationItemFields';

const today = () => new Date().toISOString().slice(0, 10);

function UploadForm({ requestOptions, vendorOptions, defaultRequestId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [requestId, setRequestId] = useState(defaultRequestId || '');
  const [vendorId, setVendorId] = useState('');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const upload = useMutation({
    mutationFn: () => quotationService.upload(requestId, vendorId, file, (event) => setProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0)),
    meta: { silent: true, successMessage: 'Quotation uploaded' },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      navigate(`/quotations/${saved.id}`, { replace: true });
    },
    onError: (err) => setError(err.message),
  });

  const ready = isUuid(requestId) && isUuid(vendorId) && file;
  return (
    <SummaryPanel title="Upload quotation file">
      <div className="grid gap-4 sm:grid-cols-2">
        {error && <Alert tone="error" className="sm:col-span-2">{error}</Alert>}
        <EntitySelect label="Procurement request" required options={requestOptions.data} loading={requestOptions.isLoading} value={requestId} onChange={(event) => setRequestId(event.target.value)} />
        <EntitySelect label="Vendor" required options={vendorOptions.data} loading={vendorOptions.isLoading} value={vendorId} onChange={(event) => setVendorId(event.target.value)} />
        <FileDrop className="sm:col-span-2" file={file} onFile={setFile} progress={upload.isPending ? progress : null} />
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={() => navigate(-1)} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button icon={Upload} onClick={() => upload.mutate()} disabled={!ready} loading={upload.isPending}>
            Upload
          </Button>
        </div>
      </div>
    </SummaryPanel>
  );
}

export default function QuotationFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const versionOf = searchParams.get('versionOf');
  const sourceId = id || versionOf;
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('manual');
  const requestOptions = useRequestOptions();
  const vendorOptions = useVendorOptions();

  const source = useQuery({ queryKey: quotationKeys.one(sourceId), queryFn: ({ signal }) => quotationService.get(sourceId, signal), enabled: Boolean(sourceId) });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      ...fromQuotation({}),
      purchaseRequestId: searchParams.get('requestId') || '',
      quotationDate: today(),
      currency: 'USD',
    },
  });
  const items = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (source.data) reset(fromQuotation(source.data));
  }, [source.data, reset]);

  const save = useMutation({
    mutationFn: (values) => {
      if (editing) return quotationService.update(id, toQuotationPayload(values, { includeItems: false }));
      if (versionOf) return quotationService.newVersion(versionOf, toQuotationPayload(values));
      return quotationService.create(toQuotationPayload(values));
    },
    meta: { silent: true, successMessage: editing ? 'Quotation updated' : versionOf ? 'New version created' : 'Quotation created' },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      navigate(`/quotations/${saved.id}`, { replace: true });
    },
    onError: (error) => {
      if (!applyFieldErrors(error, setError)) setError('root', { message: error.message });
    },
  });

  if (sourceId && source.isLoading) return <DetailSkeleton />;
  if (sourceId && source.error) return <ErrorState error={source.error} onRetry={source.refetch} />;
  if (editing && source.data && !QUOTATION_RULES.editable.includes(source.data.status)) {
    return <Alert tone="warning" title="This quotation can no longer be edited">Quotations can be edited while uploaded, needing review or failed. Create a new version instead.</Alert>;
  }

  const title = editing ? 'Edit quotation' : versionOf ? 'New quotation version' : 'New quotation';

  return (
    <>
      <PageHeader title={title} description="Totals are calculated by the backend from the line items, tax and discount." />
      {!editing && !versionOf && (
        <Tabs
          className="mb-6"
          value={mode}
          onChange={setMode}
          tabs={[
            { value: 'manual', label: 'Manual entry' },
            { value: 'upload', label: 'Upload file' },
          ]}
        />
      )}

      {mode === 'upload' && !editing && !versionOf ? (
        <UploadForm requestOptions={requestOptions} vendorOptions={vendorOptions} defaultRequestId={searchParams.get('requestId')} />
      ) : (
        <form onSubmit={handleSubmit((values) => save.mutate(values))} className="space-y-6" noValidate>
          {errors.root && <Alert tone="error">{errors.root.message}</Alert>}
          <SummaryPanel title="Quotation">
            <div className="grid gap-4 sm:grid-cols-6">
              <EntitySelect
                label="Procurement request"
                required
                options={requestOptions.data}
                loading={requestOptions.isLoading}
                error={errors.purchaseRequestId?.message}
                {...register('purchaseRequestId')}
                className="sm:col-span-3"
              />
              <EntitySelect
                label="Vendor"
                required
                options={vendorOptions.data}
                loading={vendorOptions.isLoading}
                error={errors.vendorId?.message}
                {...register('vendorId')}
                className="sm:col-span-3"
              />
              <Input label="Quotation date" type="date" required error={errors.quotationDate?.message} {...register('quotationDate')} className="sm:col-span-2" />
              <Input label="Valid until" type="date" error={errors.validUntil?.message} {...register('validUntil')} className="sm:col-span-2" />
              <Input label="Submission deadline" type="date" error={errors.submissionDeadline?.message} {...register('submissionDeadline')} className="sm:col-span-2" />
              <Select label="Currency" required options={CURRENCIES.map((code) => ({ value: code, label: code }))} {...register('currency')} className="sm:col-span-2" />
              <Input label="Tax amount" type="number" min="0" step="0.01" error={errors.taxAmount?.message} {...register('taxAmount')} className="sm:col-span-2" />
              <Input label="Discount amount" type="number" min="0" step="0.01" error={errors.discountAmount?.message} {...register('discountAmount')} className="sm:col-span-2" />
              <Input label="Delivery days" type="number" min="0" step="1" error={errors.deliveryDays?.message} {...register('deliveryDays')} className="sm:col-span-2" />
              <Input label="Warranty period" placeholder="e.g. 12 months" error={errors.warrantyPeriod?.message} {...register('warrantyPeriod')} className="sm:col-span-4" />
              <Textarea label="Payment terms" rows={2} error={errors.paymentTerms?.message} {...register('paymentTerms')} className="sm:col-span-3" />
              <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register('notes')} className="sm:col-span-3" />
            </div>
          </SummaryPanel>

          {!editing && (
            <SummaryPanel title="Line items" action={
                <Button variant="secondary" size="sm" icon={Plus} onClick={() => items.append({ ...emptyQuotationItem })}>
                  Add item
                </Button>
              }>
              {items.fields.length === 0 ? (
                <p className="text-sm text-slate-500">No items added.</p>
              ) : (
                <ol className="space-y-5">
                  {items.fields.map((item, index) => (
                    <li key={item.id} className="rounded-md border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700">Item {index + 1}</p>
                        <Button variant="ghost" size="sm" icon={Trash} onClick={() => items.remove(index)} aria-label={`Remove item ${index + 1}`}>
                          Remove
                        </Button>
                      </div>
                      <QuotationItemFields register={register} errors={errors.items?.[index]} prefix={`items.${index}.`} />
                    </li>
                  ))}
                </ol>
              )}
            </SummaryPanel>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate(-1)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing ? 'Save changes' : versionOf ? 'Create version' : 'Create quotation'}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
