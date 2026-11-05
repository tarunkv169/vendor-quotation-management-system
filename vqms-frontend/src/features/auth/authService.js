import { http } from '@/services/apiClient';
import { API } from '@/services/apiEndpoints';
import { monolithPageParams } from '@/utils/pagination';

const api = http('identity');

// /auth/me and /auth/profile identify the user by the X-User-Id header (backend design).
const userHeader = (userId) => ({ headers: { 'X-User-Id': userId } });

export const authService = {
  // 401 on login means wrong credentials, not an expired session.
  login: (credentials) => api.post(API.auth.login, credentials, { skipAuthRedirect: true }),
  register: (payload) => api.post(API.auth.register, payload, { skipAuthRedirect: true }),
  me: (userId, signal) => api.get(API.auth.me, undefined, { ...userHeader(userId), signal }),
  updateProfile: (userId, payload) => api.patch(API.auth.profile, payload, userHeader(userId)),
  listUsers: ({ page, size }, signal) => api.get(API.auth.users, monolithPageParams({ page, size }), { signal }),
  getUser: (id, signal) => api.get(API.auth.user(id), undefined, { signal }),
  updateUser: (id, payload) => api.put(API.auth.user(id), payload),
  deactivateUser: (id) => api.patch(API.auth.deactivateUser(id)),
};
