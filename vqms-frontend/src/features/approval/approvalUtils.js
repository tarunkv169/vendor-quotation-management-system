import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';

/** The current (pending) step of an approval, if any. */
export const currentStep = (approval) => (approval.steps || []).find((step) => step.status === 'PENDING');

/** Days since the approval (or its current step) started waiting. */
export function waitingDays(approval) {
  const step = currentStep(approval);
  const since = step?.activatedAt || approval.createdAt;
  const date = since ? parseISO(since) : null;
  return date && isValid(date) ? Math.max(differenceInCalendarDays(new Date(), date), 0) : null;
}

export function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
