import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { monolithPageParams } from '@/utils/pagination';

const api = http('identity');

// SystemSettingRequest { settingKey, settingValue, settingType, description, category }
export const settingsService = {
  list: ({ page = 0, size = 20 } = {}, signal) => api.get(API.settings.root, monolithPageParams({ page, size }), { signal }),
  get: (key, signal) => api.get(API.settings.one(key), undefined, { signal }),
  create: (payload) => api.post(API.settings.root, payload),
  update: (key, payload) => api.put(API.settings.one(key), payload),
  remove: (key) => api.delete(API.settings.one(key)),
};

export const settingsKeys = {
  all: ['settings'],
  list: (params) => ['settings', 'list', params],
};
