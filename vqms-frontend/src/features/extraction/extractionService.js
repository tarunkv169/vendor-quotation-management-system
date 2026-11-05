import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';

const api = http('extraction');

export const extractionService = {
  // POST { documentId, force } → 202 { extractionId, documentId, status, statusUrl, duplicate }
  start: (documentId, force = false) => api.post(API.extractions.root, { documentId, force }),
  get: (id, signal) => api.get(API.extractions.one(id), undefined, { signal }),
  // → ExtractionResponse[] (newest attempts of that document)
  byDocument: (documentId, signal) => api.get(API.extractions.byDocument(documentId), undefined, { signal }),
  retry: (id) => api.post(API.extractions.retry(id)),
};

export const extractionKeys = {
  all: ['extractions'],
  one: (id) => ['extractions', id],
  byDocument: (documentId) => ['extractions', 'document', documentId],
};

export const EXTRACTION_ACTIVE = ['PENDING', 'PROCESSING'];
