import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Check, ChevronsUp, CircleX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVendorNames } from '@/hooks/useVendorNames';
import { useRequestTitles } from '@/hooks/useLookups';
import SummaryPanel from '@/components/common/SummaryPanel';
import Button from '@/components/common/Button';
import DataTable from '@/components/common/DataTable';
import DetailList, { IdText } from '@/components/common/DetailList';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Alert from '@/components/common/Alert';
import { DetailSkeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import { approvalKeys, approvalService } from '../approvalService';
import ApprovalTimeline from '../components/ApprovalTimeline';
import { waitingDays } from '../approvalUtils';

// Comment is mandatory for reject and cancel (ApprovalDecisionRequest).
const DECISIONS = {
  approve: { label: 'Approve', icon: Check, reasonRequired: false },
  reject: { label: 'Reject', icon: CircleX, tone: 'danger', reasonRequired: true },
  escalate: { label: 'Escalate', icon: ChevronsUp, reasonRequired: false },
  cancel: { label: 'Cancel approval', icon: Ban, tone: 'danger', reasonRequired: true },
};

const DECISION_VARIANT = { approve: 'success', reject: 'danger-outline', escalate: 'secondary', cancel: 'ghost' };

export default function ApprovalDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user, can } = useAuth();
  const vendorName = useVendorNames();
  const requestTitle = useRequestTitles();
  const [decision, setDecision] = useState(null);

  const approval = useQuery({ queryKey: approvalKeys.one(id), queryFn: ({ signal }) => approvalService.get(id, signal) });
  const history = useQuery({ queryKey: approvalKeys.history(id), queryFn: ({ signal }) => approvalService.history(id, signal) });

  const decide = useMutation({
    mutationFn: ({ key, comment }) => approvalService[key](id, comment),
    meta: { successMessage: 'Decision recorded' },
    onSuccess: (data) => {
      setDecision(null);
      queryClient.setQueryData(approvalKeys.one(id), data);
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });

  if (approval.isLoading) return <DetailSkeleton />;
  if (approval.error) return <ErrorState error={approval.error} onRetry={approval.refetch} />;

  const data = approval.data;
  const open = ['PENDING', 'IN_PROGRESS'].includes(data.status);
  const pendingStep = (data.steps || []).find((step) => step.status === 'PENDING');
  // The backend checks role, limit and delegation; the UI only hides buttons when nothing is pending.
  const canDecide = open && Boolean(pendingStep);
  const actions = [
    canDecide && 'approve',
    canDecide && 'reject',
    open && can('approval.escalate') && 'escalate',
    open && can('approval.escalate') && 'cancel',
  ].filter(Boolean);
  const active = decision && DECISIONS[decision];

  const title = requestTitle(data.procurementRequestId);
  const vendor = data.vendorId ? vendorName(data.vendorId) : 'Unknown vendor';
  const days = open ? waitingDays(data) : null;
  const who = (id) => (id && id === user?.userId ? 'you' : null);

  return (
    <>
      <Link to="/approvals" className="mb-4 inline-flex items-center gap-1.5 text-13 text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Approvals
      </Link>

      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold leading-tight tracking-[-0.01em]">{title || vendor}</h1>
                <StatusBadge status={data.status} />
                {data.riskLevel && <StatusBadge status={data.riskLevel} label={`${humanize(data.riskLevel)} risk`} />}
              </div>
              <p className="mt-1 text-13 text-slate-500">
                {title ? `${vendor} · ` : ''}
                {humanize(data.mode)} approval · Created {formatDate(data.createdAt)}
                {data.policyCode && ` · Policy ${data.policyCode}`}
              </p>
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="num text-2xl font-semibold leading-none tracking-tight text-slate-900">{formatCurrency(data.amount, data.currencyCode)}</p>
            <p className="mt-1.5 font-mono text-xs text-slate-500">{data.approvalNumber}</p>
            {days != null && (
              <p className={cn('mt-0.5 text-xs', pendingStep?.overdue ? 'font-medium text-danger' : 'text-slate-500')}>
                {pendingStep?.overdue ? 'Overdue · ' : ''}Waiting: {days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'}`}
              </p>
            )}
            {data.decidedAt && <p className="mt-0.5 text-xs text-slate-500">Decided {formatDateTime(data.decidedAt)}</p>}
          </div>
        </div>

        <ApprovalTimeline approval={data} user={user} className="mt-5" />

        {data.requiresReview && (
          <Alert tone="warning" title="Flagged for review" className="mt-4">
            {(data.reviewReasons || []).join('; ')}
          </Alert>
        )}
        {data.finalComment && (
          <Alert tone={data.status === 'APPROVED' ? 'success' : data.status === 'REJECTED' ? 'error' : 'info'} title="Final comment" className="mt-4">
            {data.finalComment}
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((key) => (
              <Button key={key} variant={DECISION_VARIANT[key]} icon={DECISIONS[key].icon} onClick={() => setDecision(key)}>
                {DECISIONS[key].label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SummaryPanel title="What is being approved" className="lg:col-span-2">
          <DetailList
            items={[
              { label: 'Amount', value: formatCurrency(data.amount, data.currencyCode) },
              { label: 'Vendor', value: vendor },
              { label: 'Risk', value: data.riskLevel ? <StatusBadge status={data.riskLevel} /> : null },
              {
                label: 'Recommendation',
                value: (
                  <Link className="text-brand-700 hover:underline" to={`/recommendations/${data.recommendationId}`}>
                    {data.recommendationNumber || <IdText value={data.recommendationId} />}
                  </Link>
                ),
              },
              {
                label: 'Quotation',
                value: data.quotationId ? (
                  <Link className="text-brand-700 hover:underline" to={`/quotations/${data.quotationId}`}>
                    Open quotation
                  </Link>
                ) : null,
              },
              {
                label: 'Procurement request',
                value: data.procurementRequestId ? (
                  <Link className="text-brand-700 hover:underline" to={`/procurement/${data.procurementRequestId}`}>
                    {title || 'Open request'}
                  </Link>
                ) : null,
              },
            ]}
          />
        </SummaryPanel>

        <SummaryPanel title="Approval levels">
          <ol className="space-y-4">
            {[...(data.steps || [])]
              .sort((a, b) => a.levelNumber - b.levelNumber)
              .map((step) => (
                <li key={step.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-13 font-medium text-slate-900">
                      Level {step.levelNumber} · {humanize(step.requiredRole)}
                    </p>
                    <StatusBadge status={step.status} />
                    {step.escalated && <StatusBadge status="ESCALATED" />}
                    {step.overdue && <StatusBadge status="OVERDUE" tone="red" label="Overdue" />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">Approval limit {formatCurrency(step.approvalLimit, data.currencyCode)}</p>
                  {step.dueAt && step.status === 'PENDING' && <p className="text-xs text-slate-500">Due {formatDateTime(step.dueAt)}</p>}
                  {step.decidedAt && (
                    <p className="text-xs text-slate-500">
                      Decided {formatDateTime(step.decidedAt)} by {who(step.decidedBy) || <IdText value={step.decidedBy} />}
                      {step.onBehalfOf && (
                        <>
                          {' '}
                          on behalf of {who(step.onBehalfOf) || <IdText value={step.onBehalfOf} />}
                        </>
                      )}
                    </p>
                  )}
                  {step.decisionComment && <p className="mt-1.5 rounded-lg bg-canvas px-2.5 py-1.5 text-xs text-slate-700">“{step.decisionComment}”</p>}
                </li>
              ))}
          </ol>
        </SummaryPanel>
      </div>

      <SummaryPanel className="mt-4" title="Decision history" bodyClassName="overflow-hidden p-0">
        <DataTable
          dense
          caption="Decision history"
          columns={[
            { key: 'occurredAt', header: 'When', className: 'whitespace-nowrap', render: (row) => formatDateTime(row.occurredAt) },
            { key: 'action', header: 'Action', render: (row) => <StatusBadge status={row.action} /> },
            { key: 'actorId', header: 'By', render: (row) => who(row.actorId) || <IdText value={row.actorId} /> },
            { key: 'onBehalfOf', header: 'On behalf of', render: (row) => (row.onBehalfOf ? who(row.onBehalfOf) || <IdText value={row.onBehalfOf} /> : '—') },
            { key: 'comment', header: 'Comment', render: (row) => row.comment || <span className="text-slate-400">—</span> },
          ]}
          rows={history.data || []}
          loading={history.isLoading}
          error={history.error}
          onRetry={history.refetch}
          empty={{ title: 'No decisions yet', description: 'Approvals, rejections and escalations are recorded here.' }}
        />
      </SummaryPanel>

      <ConfirmDialog
        open={Boolean(active)}
        onClose={() => setDecision(null)}
        onConfirm={(comment) => decide.mutate({ key: decision, comment })}
        loading={decide.isPending}
        title={active?.label}
        message={decision === 'approve' && pendingStep ? `Approve level ${pendingStep.levelNumber} for ${formatCurrency(data.amount, data.currencyCode)}?` : undefined}
        tone={active?.tone}
        confirmLabel={active?.label}
        reasonLabel="Comment"
        reasonRequired={active?.reasonRequired}
      />
    </>
  );
}
