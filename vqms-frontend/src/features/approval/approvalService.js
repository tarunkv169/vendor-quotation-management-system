import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { compactParams, pageableParams } from '@/utils/pagination';

const api = http('approval');

export const approvalService = {
  search: ({ status, procurementRequestId, page = 0, size = 20, sortBy, direction } = {}, signal) =>
    api.get(API.approvals.root, { ...compactParams({ status, procurementRequestId }), ...pageableParams({ page, size, sortBy, direction }) }, { signal }),
  // Approvals waiting for the current user (array).
  pending: (signal) => api.get(API.approvals.pending, undefined, { signal }),
  get: (id, signal) => api.get(API.approvals.one(id), undefined, { signal }),
  history: (id, signal) => api.get(API.approvals.history(id), undefined, { signal }),
  create: (recommendationId) => api.post(API.approvals.root, { recommendationId }),
  approve: (id, comment) => api.post(API.approvals.action(id, 'approve'), { comment }),
  reject: (id, comment) => api.post(API.approvals.action(id, 'reject'), { comment }),
  escalate: (id, comment) => api.post(API.approvals.action(id, 'escalate'), { comment }),
  cancel: (id, comment) => api.post(API.approvals.action(id, 'cancel'), { comment }),

  // Delegations: { delegateId, validFrom, validUntil, reason }
  myDelegations: (signal) => api.get(API.approvals.myDelegations, undefined, { signal }),
  delegate: (payload) => api.post(API.approvals.delegations, payload),
  revokeDelegation: (id) => api.delete(API.approvals.delegation(id)),

  // Policies
  policies: (signal) => api.get(API.approvals.policies, undefined, { signal }),
  policy: (id, signal) => api.get(API.approvals.policy(id), undefined, { signal }),
  createPolicy: (payload) => api.post(API.approvals.policies, payload),
  updatePolicy: (id, payload) => api.put(API.approvals.policy(id), payload),
  deactivatePolicy: (id) => api.patch(API.approvals.deactivatePolicy(id)),
};

export const approvalKeys = {
  all: ['approvals'],
  list: (params) => ['approvals', 'list', params],
  pending: ['approvals', 'pending'],
  one: (id) => ['approvals', id],
  history: (id) => ['approvals', id, 'history'],
  delegations: ['approvals', 'delegations'],
  policies: ['approvals', 'policies'],
};
