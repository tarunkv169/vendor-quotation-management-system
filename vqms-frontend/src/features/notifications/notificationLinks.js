import { BadgeCheck, BadgeX, Bell, ClipboardCheck, ClipboardList, ClipboardX, FileText, Info, Inbox, Lightbulb, Scale, Send, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';

// Where a notification's reference opens in the UI (referenceType comes from the publishing service).
const REFERENCE_ROUTES = {
  APPROVAL: '/approvals',
  RECOMMENDATION: '/recommendations',
  VALIDATION: '/validation',
  QUOTATION: '/quotations',
  COMPARISON: '/comparison',
  PROCUREMENT_REQUEST: '/procurement',
  DOCUMENT: '/documents',
};

export const CATEGORY_ICONS = {
  APPROVAL_REQUIRED: BadgeCheck,
  APPROVAL_COMPLETED: BadgeCheck,
  APPROVAL_REJECTED: BadgeX,
  APPROVAL_ESCALATED: TriangleAlert,
  VALIDATION_ATTENTION: ShieldAlert,
  QUOTATION_UPDATE: FileText,
  QUOTATION_RECEIVED: Inbox,
  REQUEST_SUBMITTED: ClipboardList,
  REQUEST_APPROVED: ClipboardCheck,
  REQUEST_REJECTED: ClipboardX,
  QUOTATIONS_REQUESTED: Send,
  REQUEST_COMPLETED: ClipboardCheck,
  SYSTEM: Info,
};

export const iconFor = (notification) => CATEGORY_ICONS[notification?.category] || Bell;

/** Route of the record a notification is about, or null. */
export function notificationLink(notification) {
  const base = REFERENCE_ROUTES[String(notification?.referenceType || '').toUpperCase()];
  return base && notification.referenceId ? `${base}/${notification.referenceId}` : null;
}

// Icon tile colours per category (same tones as the KPI cards).
const CATEGORY_TONES = {
  APPROVAL_REQUIRED: 'bg-brand-50 text-brand-600',
  APPROVAL_COMPLETED: 'bg-emerald-50 text-success',
  APPROVAL_REJECTED: 'bg-red-50 text-danger',
  APPROVAL_ESCALATED: 'bg-amber-50 text-warning',
  VALIDATION_ATTENTION: 'bg-amber-50 text-warning',
  QUOTATION_UPDATE: 'bg-blue-50 text-blue-700',
  QUOTATION_RECEIVED: 'bg-blue-50 text-blue-700',
  REQUEST_SUBMITTED: 'bg-brand-50 text-brand-600',
  REQUEST_APPROVED: 'bg-emerald-50 text-success',
  REQUEST_REJECTED: 'bg-red-50 text-danger',
  QUOTATIONS_REQUESTED: 'bg-violet-50 text-violet-800',
  REQUEST_COMPLETED: 'bg-emerald-50 text-success',
  SYSTEM: 'bg-slate-100 text-slate-600',
};
export const toneFor = (notification) => CATEGORY_TONES[notification?.category] || 'bg-slate-100 text-slate-600';

/** Categories that ask the recipient to do something (decide, review or follow up). */
export const ACTION_CATEGORIES = ['APPROVAL_REQUIRED', 'APPROVAL_ESCALATED', 'REQUEST_SUBMITTED', 'VALIDATION_ATTENTION'];
/** Unread notification that asks the recipient to act. */
export const needsAction = (notification) => !notification.read && ACTION_CATEGORIES.includes(notification.category);

// Per-browser preference: show a pop-up when a new notification arrives (the bell reads it).
const POPUP_KEY = 'vqms.notifications.popups';
export function popupsEnabled() {
  try {
    return window.localStorage.getItem(POPUP_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setPopupsEnabled(enabled) {
  try {
    window.localStorage.setItem(POPUP_KEY, enabled ? 'on' : 'off');
  } catch {
    // storage blocked: the default (on) stays in effect
  }
}

/**
 * Category groups shown in the UI. They are derived from the backend's NotificationCategory values; the
 * backend has no comparison or recommendation category, so those two groups only collect general (SYSTEM)
 * notifications whose reference is a comparison or recommendation.
 */
export const CATEGORY_GROUPS = [
  { key: 'approvals', label: 'Approvals', icon: BadgeCheck, tone: 'bg-brand-50 text-brand-600', categories: ['APPROVAL_REQUIRED', 'APPROVAL_COMPLETED', 'APPROVAL_REJECTED', 'APPROVAL_ESCALATED'] },
  { key: 'quotations', label: 'Quotations', icon: FileText, tone: 'bg-blue-50 text-blue-700', categories: ['QUOTATION_UPDATE', 'QUOTATION_RECEIVED', 'QUOTATIONS_REQUESTED'] },
  { key: 'validation', label: 'Validation', icon: ShieldCheck, tone: 'bg-red-50 text-red-700', categories: ['VALIDATION_ATTENTION'] },
  { key: 'requests', label: 'Procurement requests', icon: ClipboardList, tone: 'bg-emerald-50 text-emerald-700', categories: ['REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'REQUEST_COMPLETED'] },
  { key: 'comparison', label: 'Comparison', icon: Scale, tone: 'bg-violet-50 text-violet-800', referenceType: 'COMPARISON', optional: true },
  { key: 'recommendations', label: 'Recommendations', icon: Lightbulb, tone: 'bg-amber-50 text-amber-800', referenceType: 'RECOMMENDATION', optional: true },
  { key: 'system', label: 'System', icon: Info, tone: 'bg-slate-100 text-slate-600', categories: ['SYSTEM'] },
];

/** Group key of a notification (see CATEGORY_GROUPS). */
export function groupOf(notification) {
  const category = notification?.category;
  const reference = String(notification?.referenceType || '').toUpperCase();
  if (!category || category === 'SYSTEM') {
    const byReference = CATEGORY_GROUPS.find((group) => group.referenceType && group.referenceType === reference);
    if (byReference) return byReference.key;
  }
  return CATEGORY_GROUPS.find((group) => group.categories?.includes(category))?.key || 'system';
}
export const groupConfig = (key) => CATEGORY_GROUPS.find((group) => group.key === key) || CATEGORY_GROUPS[CATEGORY_GROUPS.length - 1];

// Per-browser, per-group pop-up switches (only affect the toast the bell shows; delivery is unchanged).
const GROUP_KEY = 'vqms.notifications.popupGroups';
function readGroups() {
  try {
    return JSON.parse(window.localStorage.getItem(GROUP_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
export const popupGroupEnabled = (key) => readGroups()[key] !== false;
export function setPopupGroupEnabled(key, enabled) {
  try {
    window.localStorage.setItem(GROUP_KEY, JSON.stringify({ ...readGroups(), [key]: enabled }));
  } catch {
    // storage blocked: every group stays on
  }
}
