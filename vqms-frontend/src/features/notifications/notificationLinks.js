import { BadgeCheck, BadgeX, Bell, ClipboardCheck, ClipboardList, ClipboardX, FileText, Info, Inbox, Send, ShieldAlert, TriangleAlert } from 'lucide-react';

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
