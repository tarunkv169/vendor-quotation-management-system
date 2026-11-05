import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { compactParams, pageableParams } from '@/utils/pagination';

const api = http('audit');

// Audit is read-only for the UI (POST /events is service-to-service).
export const auditService = {
  // ?actorId&aggregateType&aggregateId&eventType&sourceService&from&to (ISO instants)
  search: ({ actorId, aggregateType, aggregateId, eventType, sourceService, from, to, page = 0, size = 50 } = {}, signal) =>
    api.get(API.audit.events, { ...compactParams({ actorId, aggregateType, aggregateId, eventType, sourceService, from, to }), ...pageableParams({ page, size }) }, { signal }),
  get: (id, signal) => api.get(API.audit.event(id), undefined, { signal }),
  timeline: (aggregateType, aggregateId, signal) => api.get(API.audit.aggregate(aggregateType, aggregateId), undefined, { signal }),
  // ADMIN: hash-chain integrity check
  verify: () => api.get(API.audit.verify),
};

export const auditKeys = {
  all: ['audit'],
  list: (params) => ['audit', 'list', params],
  one: (id) => ['audit', id],
  timeline: (type, id) => ['audit', 'timeline', type, id],
};
