import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { compactParams, pageableParams } from '@/utils/pagination';

const api = http('validation');

export const validationService = {
  // GET /validations?procurementRequestId&vendorId&status → PageResponse<ValidationResponse>
  search: ({ procurementRequestId, vendorId, status, page = 0, size = 20, sortBy, direction } = {}, signal) =>
    api.get(API.validations.root, { ...compactParams({ procurementRequestId, vendorId, status }), ...pageableParams({ page, size, sortBy, direction }) }, { signal }),
  get: (id, signal) => api.get(API.validations.one(id), undefined, { signal }),
  byQuotation: (quotationId, { page = 0, size = 20 } = {}, signal) => api.get(API.validations.byQuotation(quotationId), pageableParams({ page, size }), { signal }),
  // POST { quotationId, extractionId?, documentId? }
  run: (payload) => api.post(API.validations.root, compactParams(payload)),
  revalidate: (id) => api.post(API.validations.revalidate(id)),
};

export const validationKeys = {
  all: ['validations'],
  list: (params) => ['validations', 'list', params],
  one: (id) => ['validations', id],
  byQuotation: (quotationId) => ['validations', 'quotation', quotationId],
};
