import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { compactParams, pageableParams } from '@/utils/pagination';
import { reportStorageError } from '@/utils/features';

const api = http('document');

export const documentService = {
  // GET /documents?documentType&status&quotationId&vendorId&procurementRequestId&page&size → PageResponse
  search: ({ documentType, status, quotationId, vendorId, procurementRequestId, page = 0, size = 20, sortBy, direction } = {}, signal) =>
    api.get(API.documents.root, { ...compactParams({ documentType, status, quotationId, vendorId, procurementRequestId }), ...pageableParams({ page, size, sortBy, direction }) }, { signal }),
  get: (id, signal) => api.get(API.documents.one(id), undefined, { signal }),
  history: (id, signal) => api.get(API.documents.history(id), undefined, { signal }),
  // → { downloadUrl (pre-signed, short-lived), expiresAt, documentName, ... }
  download: (id) => api.get(API.documents.download(id)),
  upload: ({ file, documentType, quotationId, vendorId, procurementRequestId, description }, onUploadProgress) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(compactParams({ documentType, quotationId, vendorId, procurementRequestId, description })).forEach(([key, value]) => form.append(key, value));
    return api.post(API.documents.upload, form, { onUploadProgress, timeout: 120000 });
  },
  remove: (id) => api.delete(API.documents.one(id)),
  updateStatus: (id, status, reason) => api.patch(API.documents.status(id), { status, reason }),
};

export const documentKeys = {
  all: ['documents'],
  list: (params) => ['documents', 'list', params],
  one: (id) => ['documents', id],
  history: (id) => ['documents', id, 'history'],
};

// Opens the pre-signed URL returned by the backend (never builds storage URLs itself).
export async function openDocumentDownload(id) {
  try {
    const result = await documentService.download(id);
    if (result?.downloadUrl) window.open(result.downloadUrl, '_blank', 'noopener');
    return result;
  } catch (error) {
    reportStorageError(error); // marks storage as off for this session when the server says so
    throw error;
  }
}
