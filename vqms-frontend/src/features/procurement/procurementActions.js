import { Ban, Check, CircleX, FileText, Scale, Send } from 'lucide-react';
import { procurementService } from './procurementService';

// Status → workflow actions offered (the backend enforces the real state machine).
export const ACTIONS = {
  submit: { label: 'Submit', icon: Send, when: ['DRAFT'], owner: true, message: 'Submit this request for approval? It can no longer be edited.' },
  cancel: { label: 'Cancel request', icon: Ban, when: ['DRAFT', 'SUBMITTED'], owner: true, tone: 'danger', message: 'Cancel this procurement request?' },
  approve: { label: 'Approve', icon: Check, when: ['SUBMITTED'], decide: true, reason: 'Comment', reasonRequired: false },
  reject: { label: 'Reject', icon: CircleX, when: ['SUBMITTED'], decide: true, tone: 'danger', reason: 'Rejection reason', reasonRequired: true },
  requestQuotations: { label: 'Request quotations', icon: FileText, when: ['APPROVED'], workflow: true, message: 'Open this request for vendor quotations?' },
  startEvaluation: { label: 'Start evaluation', icon: Scale, when: ['QUOTATION_REQUESTED'], workflow: true, message: 'Close quotation collection and start the evaluation?' },
  complete: { label: 'Complete', icon: Check, when: ['UNDER_EVALUATION'], workflow: true, message: 'Mark this procurement request as completed?' },
};

export const ACTION_VARIANT = { approve: 'success', reject: 'danger-outline', cancel: 'danger-outline', submit: 'primary' };

/** Permissions for one request, mirroring the backend rules. */
export function requestPermissions(request, { user, can }) {
  const isOwner = request.requesterId === user?.userId;
  const isDraft = request.status === 'DRAFT';
  const canEdit = isDraft && (isOwner || can('procurement.viewAll'));
  const actions = Object.entries(ACTIONS).filter(([, action]) => {
    if (!action.when.includes(request.status)) return false;
    if (action.owner) return isOwner || can('procurement.viewAll');
    // Backend rule: a requester cannot approve or reject their own request.
    if (action.decide) return can('procurement.decide') && !isOwner;
    if (action.workflow) return can('procurement.workflow');
    return false;
  });
  return { isOwner, isDraft, canEdit, canDelete: canEdit, actions };
}

/** Runs a workflow action; approve/reject take the comment or reason. */
export function runProcurementAction(id, key, reason) {
  if (key === 'approve') return procurementService.approve(id, reason);
  if (key === 'reject') return procurementService.reject(id, reason);
  return procurementService[key](id);
}

/** Short, stable reference shown next to the title (the backend has no request number). */
export const requestReference = (id) => (id ? `PR-${String(id).slice(0, 8).toUpperCase()}` : '');
