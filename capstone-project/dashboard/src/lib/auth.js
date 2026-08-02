// ─── Token Storage ────────────────────────────────────────────────────────────

const TOKEN_KEY = 'widget_platform_token';
const TENANT_KEY = 'widget_platform_tenant';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getTenant() {
  try {
    return JSON.parse(localStorage.getItem(TENANT_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setTenant(tenant) {
  localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}
