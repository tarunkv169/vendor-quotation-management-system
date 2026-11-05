import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { monolithPageParams } from '@/utils/pagination';

// The gateway routes /api/v1/quotations to the monolith quotation module (see docs/BACKEND_API_INVENTORY.md, B1).
const api = http('quotation');

export const quotationService = {
  list: (signal) => api.get(API.quotations.root, undefined, { signal }), // plain array
  byRequest: (requestId, { page = 0, size = 10 } = {}, signal) =>
    api.get(API.quotations.byRequest(requestId), monolithPageParams({ page, size }), { signal }),
  byVendor: (vendorId, { page = 0, size = 10 } = {}, signal) =>
    api.get(API.quotations.byVendor(vendorId), monolithPageParams({ page, size }), { signal }),
  get: (id, signal) => api.get(API.quotations.one(id), undefined, { signal }),
  create: (payload) => api.post(API.quotations.manual, payload),
  upload: (requestId, vendorId, file, onUploadProgress) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(API.quotations.upload(requestId), form, { params: { vendorId }, onUploadProgress, timeout: 120000 });
  },
  update: (id, payload) => api.put(API.quotations.one(id), payload),
  remove: (id) => api.delete(API.quotations.one(id)),
  newVersion: (id, payload) => api.post(API.quotations.action(id, 'version'), payload),

  // Workflow (POST, no body)
  process: (id) => api.post(API.quotations.action(id, 'process')),
  review: (id) => api.post(API.quotations.action(id, 'review')),
  submit: (id) => api.post(API.quotations.action(id, 'submit')),
  cancel: (id) => api.post(API.quotations.action(id, 'cancel')),
  retry: (id) => api.post(API.quotations.action(id, 'retry')),

  // Items
  items: (id, signal) => api.get(API.quotations.items(id), undefined, { signal }),
  addItem: (id, payload) => api.post(API.quotations.items(id), payload),
  updateItem: (id, itemId, payload) => api.put(API.quotations.item(id, itemId), payload),
  removeItem: (id, itemId) => api.delete(API.quotations.item(id, itemId)),
  verifyItem: (id, itemId) => api.post(API.quotations.verifyItem(id, itemId)),
};

export const quotationKeys = {
  all: ['quotations'],
  list: ['quotations', 'list'],
  byRequest: (requestId, page) => ['quotations', 'request', requestId, page],
  byVendor: (vendorId, page) => ['quotations', 'vendor', vendorId, page],
  one: (id) => ['quotations', id],
  items: (id) => ['quotations', id, 'items'],
};

// Status rules enforced by QuotationServiceImpl, used to show only meaningful actions.
export const QUOTATION_RULES = {
  editable: ['UPLOADED', 'NEEDS_REVIEW', 'FAILED'],
  itemsLocked: ['SUBMITTED', 'VALIDATED', 'CANCELLED'],
  process: ['UPLOADED'],
  retry: ['FAILED'],
  review: ['EXTRACTED', 'NEEDS_REVIEW'],
  submit: ['UPLOADED', 'VALIDATED', 'NEEDS_REVIEW'],
  notCancellable: ['CANCELLED', 'VALIDATED'],
};
