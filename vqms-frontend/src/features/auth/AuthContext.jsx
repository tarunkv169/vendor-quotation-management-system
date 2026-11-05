import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authService } from './authService';
import { decodeJwt, isTokenExpired, tokenStorage } from './tokenStorage';
import { SESSION_EXPIRED_EVENT } from '@/services/apiClient';

export const AuthContext = createContext(null);

function sessionFromToken(token, fallback = {}) {
  const claims = decodeJwt(token) || {};
  return {
    userId: claims.userId || fallback.userId,
    username: claims.sub || fallback.username,
    role: claims.role || fallback.role,
    expiresAt: claims.exp ? claims.exp * 1000 : null,
  };
}

function initialSession() {
  const token = tokenStorage.getToken();
  if (!token || isTokenExpired(token)) {
    tokenStorage.clear();
    return null;
  }
  return sessionFromToken(token, tokenStorage.getUser() || {});
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(initialSession);

  const logout = useCallback(
    (reason) => {
      tokenStorage.clear();
      setSession(null);
      queryClient.clear();
      if (reason) toast.info(reason);
    },
    [queryClient],
  );

  const login = useCallback(async (credentials) => {
    const response = await authService.login(credentials);
    const next = sessionFromToken(response.token, response);
    tokenStorage.save(response.token, next);
    setSession(next);
    return next;
  }, []);

  const register = useCallback(async (payload) => {
    const response = await authService.register(payload);
    const next = sessionFromToken(response.token, response);
    tokenStorage.save(response.token, next);
    setSession(next);
    return next;
  }, []);

  // A 401 from any API call ends the session.
  useEffect(() => {
    const onExpired = () => {
      if (tokenStorage.getToken()) logout('Your session has expired. Please sign in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [logout]);

  // No refresh-token endpoint exists: log out when the JWT expires.
  useEffect(() => {
    if (!session?.expiresAt) return undefined;
    const delay = Math.max(session.expiresAt - Date.now(), 0);
    const timer = window.setTimeout(() => logout('Your session has expired. Please sign in again.'), Math.min(delay, 2 ** 31 - 1));
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  const value = useMemo(
    () => ({ user: session, isAuthenticated: Boolean(session), role: session?.role, login, register, logout }),
    [session, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
