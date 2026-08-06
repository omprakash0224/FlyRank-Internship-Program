import cors from 'cors';

// ─── CORS Middleware ───────────────────────────────────────────────────────────
//
// This module exports two CORS policies for two separate security tiers:
//
//   1. publicCors  — Tier 1 (Public widget API)
//      Applied per-route on /api/public/* (widget config + form submissions).
//      Uses origin: '*' because the embed script is placed on arbitrary
//      customer domains. No credentials are involved.
//
//   2. dashboardCors — Tier 2 (Dashboard admin & auth API)
//      Applied globally on /api/auth and /api/* in cross-origin deployments.
//      Restricts access to a single, explicitly configured dashboard origin
//      and enables credentials: true so the JWT Authorization header is
//      forwarded by the browser.
//      Safe no-op when DASHBOARD_ORIGIN is unset (same-domain deployments
//      never need cross-origin headers).
//
// Security notes:
//   • publicCors: No `credentials: true` — public endpoints use no cookies
//   • dashboardCors: credentials: true required for Authorization header
//   • Preflight cache: 600 s on both policies to reduce OPTIONS round-trips
//

// ─── Tier 1: Public Widget API ────────────────────────────────────────────────

/**
 * CORS options for the public API (unauthenticated widget config + submissions).
 *
 * @type {import('cors').CorsOptions}
 */
const publicCorsOptions = {
  origin: '*', // Any site may embed the widget
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  exposedHeaders: ['ETag'],
  maxAge: 600, // Preflight cache: 10 minutes
};

/**
 * Express CORS middleware for public routes.
 * Handles both actual requests and OPTIONS preflight with a 204 response.
 *
 * @type {import('express').RequestHandler}
 */
export const publicCors = cors(publicCorsOptions);

/**
 * Explicit OPTIONS handler for preflight requests.
 * Mount this BEFORE POST on the same path so Express resolves it first.
 *
 * Usage:
 *   router.options('/submissions', handlePreflight);
 *   router.post('/submissions', publicCors, ...);
 *
 * @type {import('express').RequestHandler}
 */
export function handlePreflight(req, res) {
  // cors() already sets the headers; we just need the 204
  res.status(204).send();
}

// ─── Tier 2: Dashboard Admin & Auth API ──────────────────────────────────────

/**
 * CORS options for authenticated dashboard routes (/api/auth, /api/*).
 *
 * Restricts cross-origin access to the single known dashboard origin set via
 * the DASHBOARD_ORIGIN environment variable. Falls back to `false` (deny all
 * cross-origin requests) when the variable is unset, which is the correct
 * behaviour for same-domain deployments where the browser never sends an
 * Origin header.
 *
 * credentials: true is required so the browser forwards the Authorization
 * header (and any future cookies) on cross-origin requests.
 *
 * @type {import('cors').CorsOptions}
 */
const dashboardCorsOptions = {
  // false = block all cross-origin if DASHBOARD_ORIGIN is not configured
  origin: process.env.DASHBOARD_ORIGIN || false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Required to forward the JWT Authorization header
  maxAge: 600, // Preflight cache: 10 minutes
};

/**
 * Express CORS middleware for authenticated dashboard routes.
 *
 * Mount this BEFORE requireAuth in app.js. CORS preflight (OPTIONS) requests
 * do not carry an Authorization header, so placing requireAuth first would
 * reject all preflights with 401 before CORS headers are ever written.
 *
 * This middleware is a safe no-op when DASHBOARD_ORIGIN is unset.
 *
 * @type {import('express').RequestHandler}
 */
export const dashboardCors = cors(dashboardCorsOptions);

