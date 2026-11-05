import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { pageableParams } from '@/utils/pagination';

const api = http('notification');

export const notificationService = {
  // GET /notifications/my?unreadOnly&page&size → PageResponse<NotificationResponse>
  my: ({ unreadOnly = false, page = 0, size = 20 } = {}, signal) =>
    api.get(API.notifications.my, { unreadOnly, ...pageableParams({ page, size }) }, { signal }),
  // → { unread: number }
  unreadCount: (signal) => api.get(API.notifications.unreadCount, undefined, { signal }),
  get: (id, signal) => api.get(API.notifications.one(id), undefined, { signal }),
  markRead: (id) => api.patch(API.notifications.read(id)),
  // → { marked: number }
  markAllRead: () => api.patch(API.notifications.readAll),
  // ADMIN / PROCUREMENT_ADMIN: NotificationRequest
  send: (payload) => api.post(API.notifications.root, payload),
};

export const notificationKeys = {
  all: ['notifications'],
  list: (params) => ['notifications', 'list', params],
  unread: ['notifications', 'unread-count'],
  one: (id) => ['notifications', id],
};
