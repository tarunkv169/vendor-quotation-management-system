/** What the current user may do with a recommendation in its current status (same rules as the detail page). */
export function recommendationPermissions(recommendation, can) {
  const submittable = ['GENERATED', 'NEEDS_REVIEW'].includes(recommendation.status);
  return {
    canRegenerate: can('recommendation.generate') && recommendation.status !== 'SUPERSEDED',
    canSubmit: can('recommendation.submit') && submittable && Boolean(recommendation.recommendedQuotationId),
    canStartApproval: can('approval.create') && recommendation.status === 'SUBMITTED_FOR_APPROVAL',
  };
}

/**
 * Approval stage of a recommendation, derived from its own status and (when visible to the user) the
 * latest approval workflow created for it:
 *   GENERATED / NEEDS_REVIEW            -> DRAFT (not submitted yet)
 *   SUBMITTED_FOR_APPROVAL              -> SUBMITTED, or APPROVED / REJECTED / CANCELLED once the approval is decided
 *   SUPERSEDED                          -> SUPERSEDED
 */
export function approvalStage(recommendation, approval) {
  if (recommendation.status === 'SUPERSEDED') return 'SUPERSEDED';
  if (recommendation.status !== 'SUBMITTED_FOR_APPROVAL') return 'DRAFT';
  if (['APPROVED', 'REJECTED', 'CANCELLED'].includes(approval?.status)) return approval.status;
  return 'SUBMITTED';
}

export const APPROVAL_STAGES = {
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  SUBMITTED: { label: 'Submitted for approval', className: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-50 text-success', dot: 'bg-emerald-500' },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-danger', dot: 'bg-red-500' },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  SUPERSEDED: { label: 'Superseded', className: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
};

/** Latest approval per recommendation id. */
export function latestApprovalByRecommendation(approvals = []) {
  const map = new Map();
  for (const approval of approvals) {
    const current = map.get(approval.recommendationId);
    if (!current || String(approval.createdAt || '') > String(current.createdAt || '')) map.set(approval.recommendationId, approval);
  }
  return map;
}
