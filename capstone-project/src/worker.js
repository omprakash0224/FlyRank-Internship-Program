// src/worker.js
// Cloudflare Workers entrypoint — wraps the existing Express app via the
// Hono node-server adapter.  The Workers runtime calls `fetch()` for every
// inbound request instead of Node's `http.listen()`.
//
// How it works:
//   1. Cloudflare passes (request, env, ctx) to `fetch()`.
//   2. We copy `env` (secrets + [vars] from wrangler.toml) into process.env
//      so every piece of existing middleware (auth, rate-limiter, CORS, etc.)
//      can read them without any code changes.
//   3. `handle(app)` from @hono/node-server converts the Web Fetch Request
//      into an Express-compatible IncomingMessage and pipes the response back.
//
// Compatibility notes (see DEPLOYMENT.md § Option F):
//   • pino-pretty  — guarded in utils/logger.js; only loads in development
//   • jsonwebtoken  — works via nodejs_compat flag
//   • express       — works via nodejs_compat flag + Hono adapter
//   • @neondatabase/serverless — HTTP-based, compatible as-is
//   • @upstash/redis            — REST-based, compatible as-is

import { handle } from '@hono/node-server/cloudflare';
import { createApp } from './app.js';

// Create the Express app once at module load (cold start).
// Subsequent requests on the same isolate reuse this instance.
const app = createApp();

export default {
  /**
   * Cloudflare Workers fetch handler.
   *
   * @param {Request} request - The incoming Web Fetch API Request.
   * @param {Record<string, string>} env - Bound secrets and [vars] from wrangler.toml.
   * @param {ExecutionContext} ctx - Workers execution context (waitUntil, passThroughOnException).
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    // Inject Cloudflare-bound secrets and vars into process.env so that
    // all existing middleware reads them transparently (e.g. process.env.JWT_SECRET).
    // This avoids touching any of the existing auth / rate-limit / CORS code.
    Object.assign(process.env, env);

    return handle(app)(request, env, ctx);
  },
};
