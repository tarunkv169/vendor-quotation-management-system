import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { compactParams, pageableParams } from '@/utils/pagination';

const api = http('comparison');

export const comparisonService = {
  // GET /comparisons?status&procurementRequestId → PageResponse<ComparisonResponse>
  search: ({ status, procurementRequestId, page = 0, size = 20, sortBy, direction } = {}, signal) =>
    api.get(API.comparisons.root, { ...compactParams({ status, procurementRequestId }), ...pageableParams({ page, size, sortBy, direction }) }, { signal }),
  get: (id, signal) => api.get(API.comparisons.one(id), undefined, { signal }),
  // ComparisonRequest { procurementRequestId, criteria[{criterion, weight, minimumScore}], quotationIds?, currencyCode?, requireAllItems, manualScores? }
  create: (payload) => api.post(API.comparisons.root, payload),
  calculate: (id) => api.post(API.comparisons.calculate(id)),
  // → { comparison, results: VendorComparisonResponse[], lineComparisons[] }
  results: (id, signal) => api.get(API.comparisons.results(id), undefined, { signal }),
  ranking: (id, signal) => api.get(API.comparisons.ranking(id), undefined, { signal }),
  complete: (id) => api.post(API.comparisons.complete(id)),
};

export const comparisonKeys = {
  all: ['comparisons'],
  list: (params) => ['comparisons', 'list', params],
  one: (id) => ['comparisons', id],
  results: (id) => ['comparisons', id, 'results'],
};
