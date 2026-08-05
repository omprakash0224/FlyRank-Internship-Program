import { logger } from '../utils/logger.js';

// ─── Enrichment Service ───────────────────────────────────────────────────────
//
// Resolves a visitor's IP address to geographic metadata using a
// 3-provider fallback chain. All providers are free and HTTPS-only.
//
// Provider chain (tried in order):
//   1. ipwho.is        – unlimited, no API key required
//   2. ipapi.co        – 1 000 req/day free, no API key required
//   3. freeipapi.com   – unlimited, no API key required
//
// If all providers fail (network error, rate-limit, timeout) the service
// returns graceful degradation data rather than blocking the submission.
//
// Per-provider timeout is controlled by:
//   GEO_TIMEOUT_MS=3000   (default: 3 000 ms)
//

// ─── Private / Loopback IP Guard ─────────────────────────────────────────────

/** Matches RFC-1918 private ranges, loopback, and link-local addresses. */
const PRIVATE_IP_RE =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|^::$|localhost)/i;

// ─── Provider Implementations ─────────────────────────────────────────────────

/**
 * @typedef {Object} GeoData
 * @property {string} country    ISO 3166-1 alpha-2 country code, 'private', or 'unknown'
 * @property {string} [city]
 * @property {string} [region]
 * @property {number} [lat]
 * @property {number} [lon]
 * @property {string} provider   Which provider resolved the data
 */

/**
 * Primary provider — ipwho.is (unlimited, no key, HTTPS).
 *
 * @param {string} ip
 * @returns {Promise<GeoData>}
 */
async function enrichWithPrimary(ip) {
  const res = await fetch(`https://ipwho.is/${ip}`);
  if (!res.ok) throw new Error(`ipwho.is responded ${res.status}`);
  const d = await res.json();
  if (!d.success) throw new Error(`ipwho.is: ${d.message ?? 'unknown error'}`);
  return {
    country: d.country_code ?? 'unknown',
    city: d.city,
    region: d.region,
    lat: d.latitude,
    lon: d.longitude,
    provider: 'ipwho.is',
  };
}

/**
 * Secondary provider — ipapi.co (1 000 req/day free, no key, HTTPS).
 *
 * @param {string} ip
 * @returns {Promise<GeoData>}
 */
async function enrichWithSecondary(ip) {
  const res = await fetch(`https://ipapi.co/${ip}/json/`);
  if (!res.ok) throw new Error(`ipapi.co responded ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(`ipapi.co: ${d.reason ?? d.error}`);
  return {
    country: d.country_code ?? 'unknown',
    city: d.city,
    region: d.region,
    lat: d.latitude,
    lon: d.longitude,
    provider: 'ipapi.co',
  };
}

/**
 * Tertiary provider — freeipapi.com (unlimited, no key, HTTPS).
 *
 * @param {string} ip
 * @returns {Promise<GeoData>}
 */
async function enrichWithTertiary(ip) {
  const res = await fetch(`https://freeipapi.com/api/json/${ip}`);
  if (!res.ok) throw new Error(`freeipapi.com responded ${res.status}`);
  const d = await res.json();
  return {
    country: d.countryCode ?? 'unknown',
    city: d.cityName,
    region: d.regionName,
    lat: d.latitude,
    lon: d.longitude,
    provider: 'freeipapi.com',
  };
}

// ─── Fallback Chain ───────────────────────────────────────────────────────────

/** @type {Array<{ name: string, fn: (ip: string) => Promise<GeoData>, timeoutMs: number }>} */
const TIMEOUT_MS = Number(process.env.GEO_TIMEOUT_MS ?? 3000);

const PROVIDERS = [
  { name: 'ipwho.is', fn: enrichWithPrimary, timeoutMs: TIMEOUT_MS },
  { name: 'ipapi.co', fn: enrichWithSecondary, timeoutMs: TIMEOUT_MS },
  { name: 'freeipapi.com', fn: enrichWithTertiary, timeoutMs: TIMEOUT_MS },
];

/**
 * Create a Promise that rejects after `ms` milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<never>}
 */
function createTimeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Enrichment provider timed out after ${ms}ms`)), ms)
  );
}

/**
 * Resolve IP → geo data using the 3-provider fallback chain.
 * Each provider is raced against its individual timeout.
 * Private / loopback IPs are short-circuited without a network call.
 * If all providers fail, returns graceful degradation data.
 *
 * @param {string} ip  Raw IP address string (IPv4 or IPv6)
 * @returns {Promise<GeoData>}
 */
export async function enrichIp(ip) {
  // Short-circuit for private / loopback addresses — no network call needed.
  if (PRIVATE_IP_RE.test(ip)) {
    logger.debug({ ip }, 'Private/loopback IP — skipping geo lookup');
    return { country: 'private', provider: 'local' };
  }

  for (const provider of PROVIDERS) {
    try {
      const result = await Promise.race([
        provider.fn(ip),
        createTimeout(provider.timeoutMs),
      ]);
      if (result) {
        logger.debug({ provider: provider.name, ip }, 'Geo enrichment succeeded');
        return result;
      }
    } catch (err) {
      logger.warn(
        { provider: provider.name, err: err.message },
        'Enrichment provider failed, trying next'
      );
    }
  }

  // Graceful degradation — all providers failed
  logger.warn({ ip }, 'All enrichment providers failed — returning unknown');
  return { country: 'unknown', provider: 'none' };
}

// ─── User-Agent Parser ────────────────────────────────────────────────────────

/**
 * Extract basic browser/OS info from a User-Agent string.
 * Regex-based — intentionally lightweight (no npm dep).
 *
 * @param {string | undefined} ua
 * @returns {{ browser: string, os: string }}
 */
export function parseUserAgent(ua) {
  if (!ua) return { browser: 'unknown', os: 'unknown' };

  let browser = 'unknown';
  let os = 'unknown';

  // Browser detection (order matters — Edge contains Chrome)
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua) || /Opera\//i.test(ua)) browser = 'Opera';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  else if (/MSIE|Trident/i.test(ua)) browser = 'Internet Explorer';

  // OS detection
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua) && !/Android/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

  return { browser, os };
}
