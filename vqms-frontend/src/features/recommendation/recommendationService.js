import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { compactParams, pageableParams } from '@/utils/pagination';

const api = http('recommendation');

export const recommendationService = {
  search: ({ status, procurementRequestId, page = 0, size = 20, sortBy, direction } = {}, signal) =>
    api.get(API.recommendations.root, { ...compactParams({ status, procurementRequestId }), ...pageableParams({ page, size, sortBy, direction }) }, { signal }),
  get: (id, signal) => api.get(API.recommendations.one(id), undefined, { signal }),
  // RecommendationRequest { comparisonId, policyCode?, criteria? }
  generate: (payload) => api.post(API.recommendations.root, payload),
  regenerate: (id) => api.post(API.recommendations.regenerate(id)),
  ranking: (id, signal) => api.get(API.recommendations.ranking(id), undefined, { signal }),
  explanation: (id, signal) => api.get(API.recommendations.explanation(id), undefined, { signal }),
  // SubmitForApprovalRequest { comment, reviewAcknowledged }
  submitForApproval: (id, payload) => api.post(API.recommendations.submitForApproval(id), payload),
};

export const recommendationKeys = {
  all: ['recommendations'],
  list: (params) => ['recommendations', 'list', params],
  one: (id) => ['recommendations', id],
  ranking: (id) => ['recommendations', id, 'ranking'],
  explanation: (id) => ['recommendations', id, 'explanation'],
};
