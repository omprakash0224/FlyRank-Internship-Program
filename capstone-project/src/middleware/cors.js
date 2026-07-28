import cors from 'cors';

// ─── CORS Middleware ───────────────────────────────────────────────────────────
//
// Public widget endpoints must accept cross-origin requests from any external
// site. We deliberately allow all origins here because the embed script can
// be placed on any customer domain — a strict allowlist is not practical for
// the public API surface.
//
// Security notes:
//   • No `credentials: true` — public endpoints use no cookies
//   • Preflight cache: 600 s to reduce OPTIONS round-trips
//   • Methods/Headers restricted to what the embed script actually needs
//

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
