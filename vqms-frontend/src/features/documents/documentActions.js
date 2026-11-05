import { aiExtractionEnabled, documentStorageEnabled } from '@/utils/features';

export const EXTRACTABLE_TYPES = ['QUOTATION_PDF', 'QUOTATION_EXCEL'];
export const DOWNLOADABLE_STATUSES = ['ACTIVE', 'PROCESSING', 'PROCESSED'];

// Status groups used by the KPI cards and filters.
export const PENDING_STATUSES = ['UPLOADING', 'PENDING_SCAN', 'PROCESSING'];
export const FAILED_STATUSES = ['FAILED', 'UPLOAD_FAILED', 'QUARANTINED'];

/** What the current user may do with a document (same rules as the detail page). */
export function documentPermissions(document, can) {
  const downloadable = documentStorageEnabled() && DOWNLOADABLE_STATUSES.includes(document.documentStatus);
  return {
    canDownload: downloadable,
    canExtract: aiExtractionEnabled() && can('extraction.start') && EXTRACTABLE_TYPES.includes(document.documentType) && downloadable,
    canDelete: can('document.upload') && document.documentStatus !== 'DELETED',
  };
}
