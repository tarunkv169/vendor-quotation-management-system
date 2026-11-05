import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Scale, Trash, X } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import SummaryPanel from '@/components/common/SummaryPanel';
import StepTimeline from '@/components/common/StepTimeline';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import DetailList from '@/components/common/DetailList';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Alert from '@/components/common/Alert';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { formatDate, formatDateTime, formatRelative } from '@/utils/formatDate';
import { formatCurrency, formatNumber } from '@/utils/formatCurrency';
import { normalizePage } from '@/utils/pagination';
import { quotationKeys, quotationService } from '@/features/quotations/quotationService';
import { procurementKeys, procurementService } from '../procurementService';
import ItemDialog from '../components/ItemDialog';
import { ACTIONS, ACTION_VARIANT, requestPermissions, runProcurementAction } from '../procurementActions';

const FLOW = [
  { key: 'DRAFT', label: 'Draft', date: 'createdAt' },
  { key: 'SUBMITTED', label: 'Submitted', date: 'submittedAt' },
  { key: 'APPROVED', label: 'Approved', date: 'approvedAt' },
  { key: 'QUOTATION_REQUESTED', label: 'Quotations' },
  { key: 'UNDER_EVALUATION', label: 'Evaluation' },
  { key: 'COMPLETED', label: 'Completed' },
];

/** Progress steps derived from the request status and the timestamps the backend returns. */
function workflowSteps(data) {
  const at = (field) => (field && data[field] ? formatDate(data[field]) : undefined);
  if (data.status === 'REJECTED' || data.status === 'CANCELLED') {
    const reached = data.approvedAt ? 2 : data.submittedAt ? 1 : 0;
    return [
      ...FLOW.slice(0, reached + 1).map((step) => ({ key: step.key, label: step.label, meta: at(step.date), state: 'done' })),
      {
        key: data.status,
        label: data.status === 'REJECTED' ? 'Rejected' : 'Cancelled',
        meta: at(data.status === 'REJECTED' ? 'rejectedAt' : 'cancelledAt'),
        state: 'rejected',
      },
    ];
  }
  const current = Math.max(FLOW.findIndex((step) => step.key === data.status), 0);
  return FLOW.map((step, index) => {
    const state = index < current || (index === current && data.status === 'COMPLETED') ? 'done' : index === current ? 'current' : 'upcoming';
    return { key: step.key, label: step.label, meta: at(step.date) || (state === 'current' ? 'In progress' : undefined), state };
  });
}

export default function ProcurementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, can } = useAuth();
  const [pending, setPending] = useState(null); // action key or 'delete' / 'deleteItem'
  const [itemDialog, setItemDialog] = useState({ open: false, item: null });
  const [itemToDelete, setItemToDelete] = useState(null);

  const request = useQuery({ queryKey: procurementKeys.one(id), queryFn: ({ signal }) => procurementService.get(id, signal) });
  const items = useQuery({ queryKey: procurementKeys.items(id), queryFn: ({ signal }) => procurementService.items(id, signal) });
  const quotations = useQuery({
    queryKey: quotationKeys.byRequest(id, 0),
    queryFn: ({ signal }) => quotationService.byRequest(id, { page: 0, size: 20 }, signal),
  });

  const refresh = (data) => {
    if (data) queryClient.setQueryData(procurementKeys.one(id), data);
    queryClient.invalidateQueries({ queryKey: procurementKeys.all });
  };

  const runAction = useMutation({
    mutationFn: ({ key, reason }) => runProcurementAction(id, key, reason),
    meta: { successMessage: 'Request updated' },
    onSuccess: (data) => {
      refresh(data);
      setPending(null);
    },
  });
  const remove = useMutation({
    mutationFn: () => procurementService.remove(id),
    meta: { successMessage: 'Request deleted' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.all });
      navigate('/procurement', { replace: true });
    },
  });
  const removeItem = useMutation({
    mutationFn: (itemId) => procurementService.removeItem(id, itemId),
    meta: { successMessage: 'Item removed' },
    onSuccess: () => {
      setItemToDelete(null);
      queryClient.invalidateQueries({ queryKey: procurementKeys.items(id) });
      refresh();
    },
  });

  const saveItem = async (payload) => {
    if (itemDialog.item) await procurementService.updateItem(id, itemDialog.item.id, payload);
    else await procurementService.addItem(id, payload);
    setItemDialog({ open: false, item: null });
    queryClient.invalidateQueries({ queryKey: procurementKeys.items(id) });
    refresh();
  };

  if (request.isLoading) return <DetailSkeleton />;
  if (request.error) return <ErrorState error={request.error} onRetry={request.refetch} />;

  const data = request.data;
  const { isOwner, canEdit, actions: available } = requestPermissions(data, { user, can });
  const active = pending && ACTIONS[pending];
  const quotationPage = normalizePage(quotations.data);

  const steps = workflowSteps(data);
  const waitingDays = data.status === 'SUBMITTED' && data.submittedAt ? differenceInCalendarDays(new Date(), parseISO(data.submittedAt)) : null;
  const itemCount = items.data?.length;

  return (
    <>
      <Link to="/procurement" className="mb-4 inline-flex items-center gap-1.5 text-13 text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Procurement requests
      </Link>

      {/* Summary card */}
      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold leading-tight tracking-[-0.01em]">{data.title}</h1>
                <StatusBadge status={data.status} />
              </div>
              <p className="mt-1 text-13 text-slate-500">
                {isOwner ? 'Requested by you' : 'Requested by another user'} · Created {formatDate(data.createdAt)}
                {data.updatedAt && ` · Updated ${formatRelative(data.updatedAt)}`}
              </p>
              {data.description && <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-slate-700">{data.description}</p>}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="num text-2xl font-semibold leading-none tracking-tight text-slate-900">{data.budget != null ? formatCurrency(data.budget) : '—'}</p>
            <p className="mt-1.5 text-13 text-slate-500">{data.budget != null ? 'Budget' : 'No budget set'}</p>
            <p className="mt-1 text-xs text-slate-500">Needed by {formatDate(data.requiredBy)}</p>
            {waitingDays != null && (
              <p className="mt-0.5 text-xs text-slate-500">Waiting: {waitingDays === 0 ? 'since today' : `${waitingDays} ${waitingDays === 1 ? 'day' : 'days'}`}</p>
            )}
          </div>
        </div>

        <StepTimeline className="mt-5" steps={steps} label="Request progress" />

        {data.status === 'REJECTED' && data.rejectionReason && (
          <Alert tone="error" title="Rejection reason" className="mt-4">
            {data.rejectionReason}
          </Alert>
        )}
        {data.approvalComment && (
          <Alert tone="success" title="Approver comment" className="mt-4">
            {data.approvalComment}
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {available.map(([key, action]) => (
              <Button key={key} variant={ACTION_VARIANT[key] || 'primary'} icon={action.icon} onClick={() => setPending(key)}>
                {action.label}
              </Button>
            ))}
            {canEdit && (
              <Button variant="secondary" icon={Pencil} to={`/procurement/${id}/edit`}>
                Edit
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" icon={Trash} onClick={() => setPending('delete')} aria-label="Delete request">
                Delete
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SummaryPanel title="Request details" className="lg:col-span-2">
          <DetailList
            items={[
              { label: 'Quantity', value: `${formatNumber(data.quantity)} ${data.unit || ''}` },
              { label: 'Budget', value: data.budget != null ? formatCurrency(data.budget) : 'Not set' },
              { label: 'Required by', value: formatDateTime(data.requiredBy) },
              { label: 'Line items', value: itemCount != null ? formatNumber(itemCount) : '—' },
              { label: 'Quotations received', value: quotations.data ? formatNumber(quotationPage.totalElements) : '—' },
              { label: 'Status', value: <StatusBadge status={data.status} /> },
            ]}
          />
        </SummaryPanel>
        <SummaryPanel title="Activity">
          <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-line">
            {[
              ['Created', data.createdAt, 'bg-slate-400'],
              ['Submitted for approval', data.submittedAt, 'bg-blue-500'],
              ['Approved', data.approvedAt, 'bg-success'],
              ['Rejected', data.rejectedAt, 'bg-danger'],
              ['Cancelled', data.cancelledAt, 'bg-slate-500'],
            ]
              .filter(([, date]) => date)
              .map(([label, date, dot]) => (
                <li key={label} className="relative flex gap-3">
                  <span className={`relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-surface ${dot}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-13 font-medium text-slate-900">{label}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(date)}</p>
                  </div>
                </li>
              ))}
          </ol>
        </SummaryPanel>
      </div>

      <SummaryPanel
        className="mt-4"
        title="Line items"
        bodyClassName="overflow-hidden p-0"
        action={
          canEdit && (
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setItemDialog({ open: true, item: null })}>
              Add item
            </Button>
          )
        }
      >
        <DataTable
          dense
          caption="Line items"
          columns={[
            {
              key: 'description',
              header: 'Item',
              className: 'min-w-56',
              render: (row) => (
                <div>
                  <p className="font-medium text-slate-900">{row.description}</p>
                  {row.specification && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{row.specification}</p>}
                </div>
              ),
            },
            { key: 'category', header: 'Category', render: (row) => row.category || <span className="text-slate-400">—</span> },
            { key: 'quantity', header: 'Qty', align: 'right', className: 'whitespace-nowrap', render: (row) => `${formatNumber(row.quantity)} ${row.unit}` },
            { key: 'expectedUnitPrice', header: 'Expected unit price', align: 'right', className: 'whitespace-nowrap', render: (row) => formatCurrency(row.expectedUnitPrice) },
            { key: 'priority', header: 'Priority', render: (row) => (row.priority ? <StatusBadge status={row.priority} /> : <span className="text-slate-400">—</span>) },
            canEdit && {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              align: 'right',
              render: (row) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" icon={Pencil} aria-label={`Edit ${row.description}`} onClick={() => setItemDialog({ open: true, item: row })} />
                  <Button variant="ghost" size="icon-sm" icon={X} aria-label={`Remove ${row.description}`} onClick={() => setItemToDelete(row)} />
                </div>
              ),
            },
          ].filter(Boolean)}
          rows={items.data || []}
          loading={items.isLoading}
          error={items.error}
          onRetry={items.refetch}
          empty={{ title: 'No line items', description: canEdit ? 'Add the items you need quoted.' : 'This request has no separate line items.' }}
        />
      </SummaryPanel>

      <SummaryPanel
        className="mt-4"
        title="Quotations"
        bodyClassName="overflow-hidden p-0"
        action={
          <div className="flex gap-2">
            {can('quotation.manage') && (
              <Button variant="secondary" size="sm" icon={Plus} to={`/quotations/new?requestId=${id}`}>
                Add quotation
              </Button>
            )}
            {can('comparison.manage') && (
              <Button variant="secondary" size="sm" icon={Scale} to={`/comparison/new?procurementRequestId=${id}`}>
                Compare
              </Button>
            )}
          </div>
        }
      >
        <DataTable
          dense
          caption="Quotations for this request"
          columns={[
            { key: 'vendorName', header: 'Vendor', render: (row) => <span className="font-medium text-slate-900">{row.vendorName || '—'}</span> },
            { key: 'quotationDate', header: 'Date', className: 'whitespace-nowrap', render: (row) => formatDate(row.quotationDate) },
            { key: 'deliveryDays', header: 'Delivery', render: (row) => (row.deliveryDays != null ? `${row.deliveryDays} days` : '—') },
            {
              key: 'totalAmount',
              header: 'Total',
              align: 'right',
              className: 'whitespace-nowrap',
              render: (row) => <span className="font-medium text-slate-900">{formatCurrency(row.totalAmount, row.currency)}</span>,
            },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
          rows={quotationPage.items}
          loading={quotations.isLoading}
          error={quotations.error}
          onRetry={quotations.refetch}
          onRowClick={(row) => navigate(`/quotations/${row.id}`)}
          empty={{
            title: 'No quotations received yet',
            description:
              data.status === 'QUOTATION_REQUESTED'
                ? 'Vendors can submit quotations for this request now.'
                : 'Quotations can be collected once the request is approved and opened for quotations.',
          }}
        />
      </SummaryPanel>

      <ConfirmDialog
        open={Boolean(active)}
        onClose={() => setPending(null)}
        onConfirm={(reason) => runAction.mutate({ key: pending, reason })}
        loading={runAction.isPending}
        title={active?.label}
        message={active?.message}
        tone={active?.tone}
        confirmLabel={active?.label}
        reasonLabel={active?.reason}
        reasonRequired={active?.reasonRequired}
      />
      <ConfirmDialog
        open={pending === 'delete'}
        onClose={() => setPending(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title="Delete request"
        message="Delete this draft request? This cannot be undone."
        tone="danger"
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => removeItem.mutate(itemToDelete.id)}
        loading={removeItem.isPending}
        title="Remove item"
        message={`Remove "${itemToDelete?.description}" from this request?`}
        tone="danger"
        confirmLabel="Remove"
      />
      <ItemDialog open={itemDialog.open} item={itemDialog.item} onClose={() => setItemDialog({ open: false, item: null })} onSave={saveItem} />
    </>
  );
}
