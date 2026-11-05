import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Ban, BadgeCheck, Copy, Pencil, Play, Plus, RefreshCw, Send, ShieldCheck, Trash, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import SummaryPanel from '@/components/common/SummaryPanel';
import StepTimeline from '@/components/common/StepTimeline';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import DetailList, { IdText } from '@/components/common/DetailList';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Alert from '@/components/common/Alert';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { formatCurrency, formatFileSize, formatNumber } from '@/utils/formatCurrency';
import { normalizePage } from '@/utils/pagination';
import { validationKeys, validationService } from '@/features/validation/validationService';
import { quotationKeys, quotationService, QUOTATION_RULES } from '../quotationService';
import QuotationItemDialog from '../components/QuotationItemDialog';

const ACTIONS = {
  process: { label: 'Process', icon: Play, message: 'Queue this quotation for processing?' },
  retry: { label: 'Retry processing', icon: RefreshCw, message: 'Retry processing of this quotation?' },
  review: { label: 'Mark reviewed', icon: BadgeCheck, message: 'Confirm that the extracted data was reviewed? The quotation becomes validated.' },
  submit: { label: 'Submit', icon: Send, message: 'Submit this quotation? Items can no longer be changed afterwards.' },
  cancel: { label: 'Cancel quotation', icon: Ban, tone: 'danger', message: 'Cancel this quotation?' },
};

const ACTION_VARIANT = { review: 'success', submit: 'primary', process: 'primary', retry: 'secondary', cancel: 'danger-outline' };


const isManual = (data) => !data.fileName || data.fileName === 'manual_entry';

/** Lifecycle steps from the status and timestamps the backend returns (manual entries skip processing). */
function quotationSteps(data) {
  const at = (value) => (value ? formatDate(value) : undefined);
  const terminal = ['CANCELLED', 'REJECTED'].includes(data.status);
  const steps = [
    { key: 'received', label: 'Received', meta: at(data.createdAt), done: true },
    !isManual(data) && {
      key: 'processed',
      label: 'Processed',
      meta: data.status === 'FAILED' ? 'Failed' : at(data.lastProcessingAt),
      done: ['EXTRACTED', 'NEEDS_REVIEW', 'VALIDATED', 'SUBMITTED'].includes(data.status) || Boolean(data.reviewedAt),
      failed: data.status === 'FAILED',
    },
    !isManual(data) && { key: 'reviewed', label: 'Reviewed', meta: at(data.reviewedAt), done: Boolean(data.reviewedAt) || data.status === 'VALIDATED' },
    { key: 'submitted', label: 'Submitted', meta: at(data.submittedAt), done: data.status === 'SUBMITTED' || Boolean(data.submittedAt) },
  ].filter(Boolean);

  let currentAssigned = false;
  const result = steps.map((step) => {
    if (step.failed) {
      currentAssigned = true;
      return { ...step, state: 'rejected' };
    }
    if (step.done) return { ...step, state: 'done' };
    if (!currentAssigned && !terminal) {
      currentAssigned = true;
      return { ...step, state: 'current', meta: step.meta || 'Next' };
    }
    return { ...step, state: 'upcoming' };
  });
  if (terminal) result.push({ key: data.status, label: data.status === 'CANCELLED' ? 'Cancelled' : 'Rejected', state: 'rejected' });
  return result;
}


export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, canAccess } = useAuth();
  const [pending, setPending] = useState(null);
  const [itemDialog, setItemDialog] = useState({ open: false, item: null });
  const [itemToDelete, setItemToDelete] = useState(null);

  const quotation = useQuery({ queryKey: quotationKeys.one(id), queryFn: ({ signal }) => quotationService.get(id, signal) });
  const items = useQuery({ queryKey: quotationKeys.items(id), queryFn: ({ signal }) => quotationService.items(id, signal) });
  const validations = useQuery({
    queryKey: validationKeys.byQuotation(id),
    queryFn: ({ signal }) => validationService.byQuotation(id, { page: 0, size: 5 }, signal),
    enabled: can('validation.run') || can('comparison.manage'),
    meta: { silent: true },
  });

  const refresh = (data) => {
    if (data) queryClient.setQueryData(quotationKeys.one(id), data);
    queryClient.invalidateQueries({ queryKey: quotationKeys.all });
  };

  const action = useMutation({
    mutationFn: (key) => quotationService[key](id),
    meta: { successMessage: 'Quotation updated' },
    onSuccess: (data) => {
      refresh(data);
      setPending(null);
    },
  });
  const remove = useMutation({
    mutationFn: () => quotationService.remove(id),
    meta: { successMessage: 'Quotation deleted' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.all });
      navigate('/quotations', { replace: true });
    },
  });
  const verify = useMutation({
    mutationFn: (itemId) => quotationService.verifyItem(id, itemId),
    meta: { successMessage: 'Item verified' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quotationKeys.items(id) }),
  });
  const removeItem = useMutation({
    mutationFn: (itemId) => quotationService.removeItem(id, itemId),
    meta: { successMessage: 'Item removed' },
    onSuccess: () => {
      setItemToDelete(null);
      queryClient.invalidateQueries({ queryKey: quotationKeys.items(id) });
      refresh();
    },
  });

  const saveItem = async (payload) => {
    if (itemDialog.item) await quotationService.updateItem(id, itemDialog.item.id, payload);
    else await quotationService.addItem(id, payload);
    setItemDialog({ open: false, item: null });
    queryClient.invalidateQueries({ queryKey: quotationKeys.items(id) });
    refresh();
  };

  if (quotation.isLoading) return <DetailSkeleton />;
  if (quotation.error) return <ErrorState error={quotation.error} onRetry={quotation.refetch} />;

  const data = quotation.data;
  const { status } = data;
  const canManage = can('quotation.manage');
  const canReview = can('quotation.review');
  const itemsEditable = canManage && !QUOTATION_RULES.itemsLocked.includes(status);
  const available = [
    canManage && QUOTATION_RULES.process.includes(status) && 'process',
    canManage && QUOTATION_RULES.retry.includes(status) && 'retry',
    canReview && QUOTATION_RULES.review.includes(status) && 'review',
    canManage && QUOTATION_RULES.submit.includes(status) && 'submit',
    canManage && !QUOTATION_RULES.notCancellable.includes(status) && 'cancel',
  ].filter(Boolean);
  const active = pending && ACTIONS[pending];
  const validationPage = normalizePage(validations.data);

  const steps = quotationSteps(data);
  const itemRows = items.data || [];
  const showConfidence = itemRows.some((row) => row.confidenceScore != null);
  const money = (value) => formatCurrency(value, data.currency);

  return (
    <>
      <Link to="/quotations" className="mb-4 inline-flex items-center gap-1.5 text-13 text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Quotations
      </Link>

      {/* Summary card */}
      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold leading-tight tracking-[-0.01em]">{data.vendorName || 'Quotation'}</h1>
                <StatusBadge status={status} />
                <span className="num rounded-md border border-line px-1.5 text-xs text-slate-600">v{data.version ?? 1}</span>
              </div>
              <p className="mt-1 text-13 text-slate-500">
                {isManual(data) ? 'Manual entry' : data.fileName} · Quoted {formatDate(data.quotationDate)}
                {data.validUntil && ` · Valid until ${formatDate(data.validUntil)}`}
              </p>
              {data.purchaseRequestId && (
                <Link
                  to={`/procurement/${data.purchaseRequestId}`}
                  className="mt-2 inline-flex items-center gap-1 text-13 font-medium text-brand-700 hover:text-brand-800"
                >
                  View procurement request <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="num text-2xl font-semibold leading-none tracking-tight text-slate-900">{money(data.totalAmount)}</p>
            <p className="mt-1.5 text-13 text-slate-500">Quotation total ({data.currency || 'USD'})</p>
            <p className="mt-1 text-xs text-slate-500">
              {data.deliveryDays != null ? `Delivery in ${data.deliveryDays} days` : 'Delivery not stated'}
              {data.warrantyPeriod && ` · ${data.warrantyPeriod} warranty`}
            </p>
          </div>
        </div>

        <StepTimeline className="mt-5" steps={steps} label="Quotation progress" />

        {data.processingError && (
          <Alert tone="error" title="Processing failed" className="mt-4">
            {data.processingError}
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {available.map((key) => (
              <Button key={key} variant={ACTION_VARIANT[key] || 'primary'} icon={ACTIONS[key].icon} onClick={() => setPending(key)}>
                {ACTIONS[key].label}
              </Button>
            ))}
            {canManage && QUOTATION_RULES.editable.includes(status) && (
              <Button variant="secondary" icon={Pencil} to={`/quotations/${id}/edit`}>
                Edit
              </Button>
            )}
            {canManage && (
              <Button variant="secondary" icon={Copy} to={`/quotations/new?versionOf=${id}`}>
                New version
              </Button>
            )}
            {canManage && QUOTATION_RULES.editable.includes(status) && (
              <Button variant="ghost" icon={Trash} onClick={() => setPending('delete')}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SummaryPanel title="Commercial terms" className="lg:col-span-2">
          <DetailList
            items={[
              { label: 'Quotation date', value: formatDate(data.quotationDate) },
              { label: 'Valid until', value: formatDate(data.validUntil) },
              { label: 'Submission deadline', value: formatDate(data.submissionDeadline) },
              { label: 'Delivery', value: data.deliveryDays != null ? `${data.deliveryDays} days` : null },
              { label: 'Warranty', value: data.warrantyPeriod },
              {
                label: 'Vendor',
                value: data.vendorId ? (
                  canAccess('vendors') ? (
                    <Link className="text-brand-700 hover:underline" to={`/vendors/${data.vendorId}`}>
                      {data.vendorName || 'View vendor'}
                    </Link>
                  ) : (
                    data.vendorName
                  )
                ) : null,
              },
              { label: 'Payment terms', value: data.paymentTerms, full: true },
              { label: 'Notes', value: data.notes && <span className="whitespace-pre-line">{data.notes}</span>, full: true },
            ]}
          />
        </SummaryPanel>
        <SummaryPanel title="Amounts">
          <dl className="space-y-3 text-13">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Tax</dt>
              <dd className="num text-slate-900">{money(data.taxAmount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Discount</dt>
              <dd className="num text-slate-900">{data.discountAmount ? `− ${money(data.discountAmount)}` : money(data.discountAmount)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
              <dt className="font-medium text-slate-900">Total</dt>
              <dd className="num text-xl font-semibold text-slate-900">{money(data.totalAmount)}</dd>
            </div>
          </dl>
        </SummaryPanel>
      </div>

      <SummaryPanel
        className="mt-4"
        title="Line items"
        bodyClassName="overflow-hidden p-0"
        action={
          itemsEditable && (
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setItemDialog({ open: true, item: null })}>
              Add item
            </Button>
          )
        }
      >
        <DataTable
          dense
          caption="Quotation line items"
          columns={[
            {
              key: 'itemName',
              header: 'Item',
              className: 'min-w-56',
              render: (row) => (
                <div>
                  <p className="font-medium text-slate-900">{row.itemName}</p>
                  {(row.description || row.specification) && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{row.description || row.specification}</p>
                  )}
                </div>
              ),
            },
            { key: 'quantity', header: 'Qty', align: 'right', render: (row) => formatNumber(row.quantity) },
            { key: 'unit', header: 'Unit', render: (row) => row.unit || '—' },
            {
              key: 'unitPrice',
              header: 'Unit price',
              align: 'right',
              className: 'whitespace-nowrap',
              render: (row) => formatCurrency(row.unitPrice, row.currency || data.currency),
            },
            {
              key: 'lineTotal',
              header: 'Line total',
              align: 'right',
              className: 'whitespace-nowrap',
              render: (row) => <span className="font-medium text-slate-900">{formatCurrency(row.lineTotal, row.currency || data.currency)}</span>,
            },
            {
              key: 'deliveryDays',
              header: 'Delivery',
              className: 'whitespace-nowrap',
              render: (row) => (row.deliveryDays != null ? `${row.deliveryDays} days` : '—'),
            },
            showConfidence && { key: 'confidenceScore', header: 'Confidence', align: 'right', render: (row) => formatNumber(row.confidenceScore, 2) },
            {
              key: 'manuallyVerified',
              header: 'Verified',
              render: (row) =>
                row.manuallyVerified ? <StatusBadge status="VERIFIED" tone="green" label="Verified" /> : <span className="text-slate-400">—</span>,
            },
            (itemsEditable || canReview) && {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              align: 'right',
              render: (row) => (
                <div className="flex justify-end gap-1">
                  {canReview && !row.manuallyVerified && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={ShieldCheck}
                      aria-label={`Verify ${row.itemName}`}
                      onClick={() => verify.mutate(row.id)}
                      disabled={verify.isPending}
                    />
                  )}
                  {itemsEditable && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        icon={Pencil}
                        aria-label={`Edit ${row.itemName}`}
                        onClick={() => setItemDialog({ open: true, item: row })}
                      />
                      <Button variant="ghost" size="icon-sm" icon={X} aria-label={`Remove ${row.itemName}`} onClick={() => setItemToDelete(row)} />
                    </>
                  )}
                </div>
              ),
            },
          ].filter(Boolean)}
          rows={itemRows}
          loading={items.isLoading}
          error={items.error}
          onRetry={items.refetch}
          empty={{ title: 'No line items', description: itemsEditable ? 'Add at least one item before submitting.' : undefined }}
        />
        {itemRows.length > 0 && (
          <dl className="flex flex-wrap justify-end gap-x-8 gap-y-1 border-t border-line bg-slate-50/70 px-4 py-3 text-13">
            <div className="flex gap-2">
              <dt className="text-slate-500">Tax</dt>
              <dd className="num text-slate-900">{money(data.taxAmount)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-500">Discount</dt>
              <dd className="num text-slate-900">{data.discountAmount ? `− ${money(data.discountAmount)}` : money(data.discountAmount)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-slate-900">Total</dt>
              <dd className="num font-semibold text-slate-900">{money(data.totalAmount)}</dd>
            </div>
          </dl>
        )}
      </SummaryPanel>

      {/* Manual entries have no processing data; the panel is only shown for uploaded documents. */}
      <div className={`mt-4 grid gap-4 ${validations.isSuccess && !isManual(data) ? 'lg:grid-cols-2' : ''}`}>
        {!isManual(data) && (
          <SummaryPanel title="Processing">
            <DetailList
              columns={2}
              items={[
                { label: 'Source file', value: !isManual(data) ? `${data.fileName} (${formatFileSize(data.fileSize)})` : 'Manual entry' },
                { label: 'Extraction confidence', value: data.extractionConfidence != null ? formatNumber(data.extractionConfidence, 2) : null },
                { label: 'Processing attempts', value: data.processingAttempts },
                { label: 'Last processed', value: formatDateTime(data.lastProcessingAt) },
                { label: 'Reviewed', value: data.reviewedAt ? formatDateTime(data.reviewedAt) : null },
                { label: 'Submitted', value: data.submittedAt ? formatDateTime(data.submittedAt) : null },
              ]}
            />
          </SummaryPanel>
        )}
        {validations.isSuccess && (
          <SummaryPanel title="Validations" bodyClassName="overflow-hidden p-0">
            <DataTable
              dense
              caption="Validations"
              columns={[
                { key: 'id', header: 'Validation', render: (row) => <IdText value={row.id} /> },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'errorCount', header: 'Errors', align: 'right' },
                { key: 'warningCount', header: 'Warnings', align: 'right' },
                { key: 'validatedAt', header: 'Validated', render: (row) => formatDateTime(row.validatedAt) },
              ]}
              rows={validationPage.items}
              onRowClick={(row) => navigate(`/validation/${row.id}`)}
              empty={{ title: 'Not validated yet' }}
            />
          </SummaryPanel>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(active)}
        onClose={() => setPending(null)}
        onConfirm={() => action.mutate(pending)}
        loading={action.isPending}
        title={active?.label}
        message={active?.message}
        tone={active?.tone}
        confirmLabel={active?.label}
      />
      <ConfirmDialog
        open={pending === 'delete'}
        onClose={() => setPending(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title="Delete quotation"
        message="Delete this quotation? This cannot be undone."
        tone="danger"
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => removeItem.mutate(itemToDelete.id)}
        loading={removeItem.isPending}
        title="Remove item"
        message={`Remove "${itemToDelete?.itemName}"?`}
        tone="danger"
        confirmLabel="Remove"
      />
      <QuotationItemDialog
        open={itemDialog.open}
        item={itemDialog.item}
        currency={data.currency}
        onClose={() => setItemDialog({ open: false, item: null })}
        onSave={saveItem}
      />
    </>
  );
}
