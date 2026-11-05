import StepTimeline from '@/components/common/StepTimeline';
import { formatDate } from '@/utils/formatDate';
import { humanize } from '@/utils/constants';

const STATE = { APPROVED: 'done', PENDING: 'current', REJECTED: 'rejected', WAITING: 'upcoming', CANCELLED: 'upcoming' };

/**
 * Approval levels exactly as returned by the Approval Service (no invented stages).
 * "You" marks the pending step routed to the signed-in user's role, and steps the user decided.
 */
export default function ApprovalTimeline({ approval, user, className }) {
  const steps = [...(approval.steps || [])].sort((a, b) => a.levelNumber - b.levelNumber);
  if (!steps.length) return null;

  return (
    <StepTimeline
      className={className}
      label="Approval steps"
      steps={steps.map((step) => {
        const mine = step.status === 'PENDING' && user?.role && (step.requiredRole === user.role || (step.escalated && step.escalationRole === user.role));
        let meta;
        if (step.status === 'APPROVED' || step.status === 'REJECTED') {
          meta = `${step.decidedBy && step.decidedBy === user?.userId ? 'You' : humanize(step.status)} · ${formatDate(step.decidedAt)}`;
        } else if (step.status === 'PENDING') {
          meta = [mine ? 'You' : 'Pending', step.dueAt && `${step.overdue ? 'overdue since' : 'due'} ${formatDate(step.dueAt)}`].filter(Boolean).join(' · ');
        } else if (step.status === 'CANCELLED') {
          meta = 'Cancelled';
        } else {
          meta = `Level ${step.levelNumber}`;
        }
        return {
          key: step.id,
          label: humanize(step.escalated && step.status === 'PENDING' ? step.escalationRole : step.requiredRole),
          meta,
          state: STATE[step.status] || 'upcoming',
        };
      })}
    />
  );
}
