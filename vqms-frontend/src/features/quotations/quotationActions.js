import { Ban, BadgeCheck, Play, RefreshCw, Send } from 'lucide-react';
import { QUOTATION_RULES } from './quotationService';

// Workflow actions (POST /quotations/{id}/{action}); the backend enforces the real state machine.
export const ACTIONS = {
  process: { label: 'Process', icon: Play, message: 'Queue this quotation for processing?' },
  retry: { label: 'Retry processing', icon: RefreshCw, message: 'Retry processing of this quotation?' },
  review: { label: 'Mark reviewed', icon: BadgeCheck, message: 'Confirm that the extracted data was reviewed? The quotation becomes validated.' },
  submit: { label: 'Submit', icon: Send, message: 'Submit this quotation? Items can no longer be changed afterwards.' },
  cancel: { label: 'Cancel quotation', icon: Ban, tone: 'danger', message: 'Cancel this quotation?' },
};

export const ACTION_VARIANT = { review: 'success', submit: 'primary', process: 'primary', retry: 'secondary', cancel: 'danger-outline' };

export const isManual = (quotation) => !quotation.fileName || quotation.fileName === 'manual_entry';

/** What the current user may do with a quotation in its current status. */
export function quotationPermissions(quotation, can) {
  const { status } = quotation;
  const canManage = can('quotation.manage');
  const canReview = can('quotation.review');
  const actions = [
    canManage && QUOTATION_RULES.process.includes(status) && 'process',
    canManage && QUOTATION_RULES.retry.includes(status) && 'retry',
    canReview && QUOTATION_RULES.review.includes(status) && 'review',
    canManage && QUOTATION_RULES.submit.includes(status) && 'submit',
    canManage && !QUOTATION_RULES.notCancellable.includes(status) && 'cancel',
  ].filter(Boolean);
  const editable = canManage && QUOTATION_RULES.editable.includes(status);
  return {
    canManage,
    canReview,
    actions,
    canEdit: editable,
    canDelete: editable,
    canNewVersion: canManage,
    canValidate: can('validation.run'),
  };
}
