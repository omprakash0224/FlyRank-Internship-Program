import { Redis } from '@upstash/redis';

/**
 * Upstash Redis REST client.
 *
 * @upstash/redis uses HTTP under the hood — no persistent TCP connection,
 * no need for connection pooling, works in serverless and traditional Node.js.
 *
 * Configure via:
 *   UPSTASH_REDIS_REST_URL  — e.g. https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — from Upstash console → REST API tab
 */
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Ping Redis to verify connectivity.
 * @returns {Promise<boolean>}
 */
async function pingRedis() {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export { redis, pingRedis };
