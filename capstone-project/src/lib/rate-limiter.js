import { redis } from './redis.js';
import { logger } from '../utils/logger.js';

// ─── Rate Limiter ──────────────────────────────────────────────────────────────
//
// Redis-backed sliding window counter.
//
// Algorithm:
//   1. INCR the key (atomically sets to 1 if it doesn't exist)
//   2. On first increment, set an EXPIRE on the key
//   3. If the count exceeds the threshold, deny the request
//
// Key format: `ratelimit:{widgetId}:{ipHash}`
// This gives us per-IP per-widget granularity so a single spammy visitor on
// one widget cannot degrade the experience for other widgets or other visitors.
//

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '10', 10);
const WINDOW_SECONDS = Math.ceil(WINDOW_MS / 1000);

/**
 * Check whether a request from `ipHash` to `widgetId` is within the rate limit.
 *
 * @param {string} widgetId
 * @param {string} ipHash  SHA-256 hex of the visitor's IP
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number }>}
 *   `resetAt` is a Unix timestamp (seconds) when the window expires.
 */
export async function checkRateLimit(widgetId, ipHash) {
  const key = `ratelimit:${widgetId}:${ipHash}`;

  try {
    // Pipeline: INCR + EXPIRE in a single round-trip
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, WINDOW_SECONDS, 'NX'); // Only set expiry on first increment
    const results = await pipeline.exec();

    // results[0] is the new count after INCR
    const count = results[0];
    const remaining = Math.max(0, MAX_REQUESTS - count);
    const resetAt = Math.floor(Date.now() / 1000) + WINDOW_SECONDS;

    if (count > MAX_REQUESTS) {
      logger.debug({ widgetId, count, MAX_REQUESTS }, 'Rate limit exceeded');
      return { allowed: false, remaining: 0, resetAt };
    }

    return { allowed: true, remaining, resetAt };
  } catch (err) {
    // If Redis is unavailable, fail open — don't block legitimate submissions
    logger.error({ err, widgetId, ipHash }, 'Rate limiter Redis error — failing open');
    return { allowed: true, remaining: MAX_REQUESTS, resetAt: 0 };
  }
}

/**
 * Reset the rate limit counter for a given widget + IP (test utility).
 *
 * @param {string} widgetId
 * @param {string} ipHash
 * @returns {Promise<void>}
 */
export async function resetRateLimit(widgetId, ipHash) {
  const key = `ratelimit:${widgetId}:${ipHash}`;
  await redis.del(key);
}
