// The Identity Service issues a bearer JWT (no cookies, no refresh token), so the token is kept in
// localStorage to survive reloads and is removed on logout or expiry.

const TOKEN_KEY = 'vqms.token';
const USER_KEY = 'vqms.user';

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): the session simply lasts for this tab.
  }
}

let memoryToken = safeGet(TOKEN_KEY);

export const tokenStorage = {
  getToken: () => memoryToken,
  getUser: () => {
    const raw = safeGet(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(token, user) {
    memoryToken = token;
    safeSet(TOKEN_KEY, token);
    safeSet(USER_KEY, JSON.stringify(user));
  },
  clear() {
    memoryToken = null;
    safeSet(TOKEN_KEY, null);
    safeSet(USER_KEY, null);
  },
};

// Reads (does not verify) the JWT payload: the backend verifies the signature on every call.
export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenExpired(token, skewSeconds = 30) {
  const claims = token ? decodeJwt(token) : null;
  if (!claims?.exp) return !claims;
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
