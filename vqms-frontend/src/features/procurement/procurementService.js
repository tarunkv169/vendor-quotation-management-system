import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { monolithPageParams } from '@/utils/pagination';

const api = http('procurement');

// Sort fields accepted by ProcurementRequestController (ALLOWED_SORT_FIELDS).
export const PROCUREMENT_SORT_FIELDS = ['title', 'quantity', 'status', 'requiredBy', 'submittedAt', 'approvedAt', 'rejectedAt', 'createdAt', 'updatedAt'];

export const procurementService = {
  /**
   * scope 'all' (ADMIN / PROCUREMENT_ADMIN) or 'mine' (requester).
   * keyword → /search, status → /status/{status}; the backend does not combine both.
   */
  list: ({ scope = 'mine', keyword, status, page = 0, size = 10, sortBy = 'createdAt', direction = 'desc' } = {}, signal) => {
    const params = monolithPageParams({ page, size, sortBy, direction });
    const mine = scope === 'mine';
    if (keyword) return api.get(mine ? API.procurement.mineSearch : API.procurement.search, { ...params, keyword }, { signal });
    if (status) return api.get(mine ? API.procurement.mineByStatus(status) : API.procurement.byStatus(status), params, { signal });
    return api.get(mine ? API.procurement.mine : API.procurement.root, params, { signal });
  },
  myApprovals: ({ page = 0, size = 10 } = {}, signal) => api.get(API.procurement.myApprovals, monolithPageParams({ page, size }), { signal }),
  get: (id, signal) => api.get(API.procurement.one(id), undefined, { signal }),
  create: (payload) => api.post(API.procurement.root, payload),
  update: (id, payload) => api.put(API.procurement.one(id), payload),
  remove: (id) => api.delete(API.procurement.one(id)),

  // Workflow (PATCH). approve takes ?comment, reject requires ?reason.
  submit: (id) => api.patch(API.procurement.action(id, 'submit')),
  cancel: (id) => api.patch(API.procurement.action(id, 'cancel')),
  approve: (id, comment) => api.patch(API.procurement.action(id, 'approve'), undefined, { params: comment ? { comment } : undefined }),
  reject: (id, reason) => api.patch(API.procurement.action(id, 'reject'), undefined, { params: { reason } }),
  requestQuotations: (id) => api.patch(API.procurement.action(id, 'request-quotations')),
  startEvaluation: (id) => api.patch(API.procurement.action(id, 'start-evaluation')),
  complete: (id) => api.patch(API.procurement.action(id, 'complete')),

  // Items
  items: (id, signal) => api.get(API.procurement.items(id), undefined, { signal }),
  addItem: (id, payload) => api.post(API.procurement.items(id), payload),
  updateItem: (id, itemId, payload) => api.put(API.procurement.item(id, itemId), payload),
  removeItem: (id, itemId) => api.delete(API.procurement.item(id, itemId)),
};

export const procurementKeys = {
  all: ['procurement'],
  list: (params) => ['procurement', 'list', params],
  one: (id) => ['procurement', id],
  items: (id) => ['procurement', id, 'items'],
};

// Reusable select options of requests visible to the current user.
export async function loadRequestOptions(canViewAll, signal) {
  const data = await procurementService.list({ scope: canViewAll ? 'all' : 'mine', page: 0, size: 100 }, signal);
  return (data?.content || []).map((request) => ({ value: request.id, label: `${request.title} (${request.status})`, title: request.title }));
}
