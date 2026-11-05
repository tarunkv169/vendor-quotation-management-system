import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { monolithPageParams } from '@/utils/pagination';

const api = http('vendor');

// Sort fields accepted by VendorController (ALLOWED_SORT_FIELDS).
export const VENDOR_SORT_FIELDS = ['name', 'email', 'createdAt', 'updatedAt'];

export const vendorService = {
  /**
   * The backend has three list endpoints; the right one is chosen from the filters:
   * keyword → /search, status → /status/{status}, otherwise the full list. All return a Spring Page.
   */
  list: ({ keyword, status, page = 0, size = 10, sortBy = 'name', direction = 'asc' } = {}, signal) => {
    const params = monolithPageParams({ page, size, sortBy, direction });
    if (keyword) return api.get(API.vendors.search, { ...params, keyword }, { signal });
    if (status) return api.get(API.vendors.byStatus(status), params, { signal });
    return api.get(API.vendors.root, params, { signal });
  },
  get: (id, signal) => api.get(API.vendors.one(id), undefined, { signal }),
  create: (payload) => api.post(API.vendors.root, payload),
  update: (id, payload) => api.put(API.vendors.one(id), payload),
  remove: (id) => api.delete(API.vendors.one(id)),
  activate: (id) => api.patch(API.vendors.activate(id)),
  deactivate: (id) => api.patch(API.vendors.deactivate(id)),
};

export const vendorKeys = {
  all: ['vendors'],
  list: (params) => ['vendors', 'list', params],
  one: (id) => ['vendors', id],
};
