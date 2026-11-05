import axios from 'axios';
import { resolveBaseUrl } from './serviceRegistry';
import { normalizeError } from '@/utils/errors';
import { tokenStorage } from '@/features/auth/tokenStorage';

export const SESSION_EXPIRED_EVENT = 'vqms:session-expired';

function correlationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

const clients = new Map();

/**
 * One Axios instance per backend service (all pointing at the gateway unless overridden).
 * Request:  Bearer token + X-Correlation-Id.
 * Response: every failure becomes an ApiError; 401 ends the session.
 * Pass { skipAuthRedirect: true } in a request config to handle 401 yourself (login form).
 */
export function createServiceClient(serviceKey) {
  if (clients.has(serviceKey)) return clients.get(serviceKey);

  const client = axios.create({
    baseURL: resolveBaseUrl(serviceKey),
    timeout: 30000,
    headers: { Accept: 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = tokenStorage.getToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-Correlation-Id'] = correlationId();
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (axios.isCancel(error)) return Promise.reject(error);
      const apiError = normalizeError(error);
      if (apiError.status === 401 && !error.config?.skipAuthRedirect) {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      return Promise.reject(apiError);
    },
  );

  clients.set(serviceKey, client);
  return client;
}

// Small helpers so service modules stay one-liners. `signal` comes from TanStack Query (cancellation).
export function http(serviceKey) {
  const client = createServiceClient(serviceKey);
  return {
    get: (url, params, config = {}) => client.get(url, { params, ...config }).then((r) => r.data),
    post: (url, body, config = {}) => client.post(url, body, config).then((r) => r.data),
    put: (url, body, config = {}) => client.put(url, body, config).then((r) => r.data),
    patch: (url, body, config = {}) => client.patch(url, body, config).then((r) => r.data),
    delete: (url, config = {}) => client.delete(url, config).then((r) => r.data),
    raw: client,
  };
}
