import { Ban, Check, ChevronsUp, CircleX } from 'lucide-react';

// Decisions (POST /approvals/{id}/{key} { comment }). Comment is mandatory for reject and cancel.
export const DECISIONS = {
  approve: { label: 'Approve', icon: Check, reasonRequired: false, reasonLabel: 'Comment (optional)' },
  reject: { label: 'Reject', icon: CircleX, tone: 'danger', reasonRequired: true, reasonLabel: 'Reason for rejection' },
  escalate: { label: 'Escalate', icon: ChevronsUp, reasonRequired: false, reasonLabel: 'Comment (optional)' },
  cancel: { label: 'Cancel approval', icon: Ban, tone: 'danger', reasonRequired: true, reasonLabel: 'Reason for cancelling' },
};

export const DECISION_VARIANT = { approve: 'success', reject: 'danger-outline', escalate: 'secondary', cancel: 'ghost' };

export const isOpenApproval = (approval) => ['PENDING', 'IN_PROGRESS'].includes(approval.status);

/**
 * Actions offered for an approval. `waitingForMe` comes from GET /approvals/pending (the backend's
 * own routing by role, limit and delegation); the backend re-checks every decision.
 */
export function approvalPermissions(approval, can, { waitingForMe }) {
  const open = isOpenApproval(approval);
  return {
    canDecide: open && waitingForMe,
    canEscalate: open && can('approval.escalate'),
    canCancel: open && can('approval.escalate'),
  };
}
