// Enum values copied from the backend (entity / enum classes). Keep in sync with the backend.

export const APP_NAME = 'VQMS';

export const VENDOR_STATUSES = ['ACTIVE', 'INACTIVE'];

export const PROCUREMENT_STATUSES = [
  'DRAFT', 'SUBMITTED', 'QUOTATION_REQUESTED', 'UNDER_EVALUATION', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED',
];

// Monolith quotation (the implementation the gateway routes /api/v1/quotations to).
export const QUOTATION_STATUSES = [
  'UPLOADED', 'QUEUED', 'PROCESSING', 'EXTRACTED', 'NEEDS_REVIEW', 'VALIDATED', 'FAILED', 'REJECTED', 'SUBMITTED', 'CANCELLED',
];

export const DOCUMENT_TYPES = [
  'QUOTATION_PDF', 'QUOTATION_EXCEL', 'VENDOR_CERTIFICATE', 'SUPPORTING_DOCUMENT', 'PROCUREMENT_ATTACHMENT',
];
export const DOCUMENT_STATUSES = [
  'UPLOADING', 'PENDING_SCAN', 'ACTIVE', 'PROCESSING', 'PROCESSED', 'FAILED', 'UPLOAD_FAILED', 'QUARANTINED', 'DELETED',
];
export const DOCUMENT_ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'png', 'jpg', 'jpeg'];
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

export const EXTRACTION_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'NEEDS_REVIEW', 'FAILED'];

export const VALIDATION_STATUSES = ['PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'NEEDS_REVIEW'];

export const COMPARISON_STATUSES = ['CREATED', 'CALCULATED', 'COMPLETED', 'FAILED'];
export const COMPARISON_CRITERIA = [
  'PRICE', 'DELIVERY_TIME', 'WARRANTY', 'TECHNICAL_COMPLIANCE', 'QUALITY', 'COMMERCIAL_TERMS',
];

export const RECOMMENDATION_STATUSES = ['GENERATED', 'NEEDS_REVIEW', 'SUBMITTED_FOR_APPROVAL', 'SUPERSEDED'];

export const APPROVAL_STATUSES = ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED'];

export const NOTIFICATION_CATEGORIES = [
  'APPROVAL_REQUIRED', 'APPROVAL_COMPLETED', 'APPROVAL_REJECTED', 'APPROVAL_ESCALATED',
  'VALIDATION_ATTENTION', 'QUOTATION_UPDATE', 'SYSTEM',
];

export const AUDIT_OUTCOMES = ['SUCCESS', 'FAILURE', 'INFO'];

export const REPORT_TYPES = ['PROCUREMENT_SUMMARY', 'APPROVAL_SPEND', 'VALIDATION_QUALITY'];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'JPY', 'AUD', 'CAD', 'SGD'];

export const PAGE_SIZES = [10, 20, 50];

// "PROCUREMENT_ADMIN" -> "Procurement admin"
export function humanize(value) {
  if (!value) return '—';
  const text = String(value).replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function toOptions(values) {
  return values.map((value) => ({ value, label: humanize(value) }));
}
