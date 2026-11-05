import { Link } from 'react-router-dom';
import { ArrowRight, Check, TriangleAlert, X } from 'lucide-react';
import Button from '@/components/common/Button';
import StatusBadge from '@/components/common/StatusBadge';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import { humanize } from '@/utils/constants';
import ApprovalTimeline from './ApprovalTimeline';
import { currentStep, waitingDays } from '../approvalUtils';

const RISK_TAG = {
  HIGH: 'bg-red-50 text-red-700',
  MEDIUM: 'bg-amber-50 text-amber-800',
  LOW: 'bg-slate-100 text-slate-600',
};

/**
 * Approval as a card: what is being approved, the amount, the step timeline and (when the
 * signed-in user can decide) Approve / Reject. The backend re-checks role, limit and delegation.
 */
export default function ApprovalCard({ approval, vendorName, requestTitle, user, actionable = false, onDecide }) {
  const vendor = approval.vendorId ? vendorName(approval.vendorId) : 'Unknown vendor';
  const title = requestTitle?.(approval.procurementRequestId);
  const open = ['PENDING', 'IN_PROGRESS'].includes(approval.status);
  const days = open ? waitingDays(approval) : null;
  const step = currentStep(approval);

  return (
    <article className="card p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/approvals/${approval.id}`} className="truncate text-[17px] font-semibold text-slate-900 hover:text-brand-700">
                {title || vendor}
              </Link>
              {approval.riskLevel && (
                <span className={cn('inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium', RISK_TAG[approval.riskLevel] || RISK_TAG.LOW)}>
                  {approval.riskLevel === 'HIGH' && <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
                  {humanize(approval.riskLevel)} risk
                </span>
              )}
              {!open && <StatusBadge status={approval.status} />}
            </div>
            <p className="mt-1 text-13 text-slate-500">
              {title ? `${vendor} · ` : ''}
              {humanize(approval.mode)} approval · {formatDate(approval.createdAt)}
              {approval.recommendationNumber && (
                <>
                  {' · '}
                  <Link to={`/recommendations/${approval.recommendationId}`} className="hover:text-slate-800 hover:underline">
                    {approval.recommendationNumber}
                  </Link>
                </>
              )}
            </p>
            {approval.requiresReview && approval.reviewReasons?.length > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-13 text-amber-800">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {approval.reviewReasons.join('; ')}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="num text-2xl font-semibold leading-none tracking-tight text-slate-900">{formatCurrency(approval.amount, approval.currencyCode)}</p>
          <p className="mt-1.5 font-mono text-xs text-slate-500">{approval.approvalNumber}</p>
          {days != null && (
            <p className={cn('mt-0.5 text-xs', step?.overdue ? 'font-medium text-danger' : 'text-slate-500')}>
              {step?.overdue ? 'Overdue · ' : ''}Waiting: {days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'}`}
            </p>
          )}
          {!open && approval.decidedAt && <p className="mt-0.5 text-xs text-slate-500">Decided {formatDate(approval.decidedAt)}</p>}
        </div>
      </div>

      <ApprovalTimeline approval={approval} user={user} className="mt-4" />

      {approval.finalComment && !open && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-13 text-slate-700">“{approval.finalComment}”</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {actionable && (
          <>
            <Button variant="success" icon={Check} onClick={() => onDecide(approval, 'approve')}>
              Approve
            </Button>
            <Button variant="danger-outline" icon={X} onClick={() => onDecide(approval, 'reject')}>
              Reject
            </Button>
          </>
        )}
        <Button variant="secondary" to={`/approvals/${approval.id}`}>
          View details <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
