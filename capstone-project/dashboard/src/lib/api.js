import { getToken, clearAuth } from './auth.js';

// ─── API Fetch Wrapper ────────────────────────────────────────────────────────
//
// Automatically injects the JWT Authorization header and handles:
//   - 401: clears auth and reloads to trigger login redirect
//   - Non-ok responses: throws an error with the API error message

const BASE = '/api';

/**
 * Make an authenticated API request.
 *
 * @param {string} path  — Relative path like '/dashboard/stats'
 * @param {RequestInit} [options]
 * @returns {Promise<any>}  Parsed JSON body
 */
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.reload();
    return;
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return body;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (credentials) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (data) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Dashboard API ────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: () => apiFetch('/dashboard/stats'),

  getSubmissions: ({ page = 1, limit = 20, widgetId } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (widgetId) params.set('widgetId', widgetId);
    return apiFetch(`/dashboard/submissions?${params}`);
  },

  getSubmission: (id) => apiFetch(`/dashboard/submissions/${id}`),
};

// ─── Widgets API ──────────────────────────────────────────────────────────────

export const widgetsApi = {
  list: ({ page = 1, limit = 50 } = {}) =>
    apiFetch(`/widgets?page=${page}&limit=${limit}`),
};
