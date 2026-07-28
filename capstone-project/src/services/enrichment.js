import { logger } from '../utils/logger.js';

// ─── Enrichment Service ───────────────────────────────────────────────────────
//
// Resolves a visitor's IP address to geographic and device metadata using a
// 3-provider fallback chain.
//
// Provider status is controlled by the env var:
//   MOCK_GEO_PROVIDER_STATUS="primary:up,secondary:down,tertiary:up"
//
// In production these would be real HTTP calls to ipapi.co, ipinfo.io, and
// abstractapi.com. For this capstone they are deterministic mocks that can be
// toggled up/down for testing the fallback logic without network calls.
//

// ─── Provider Status Parsing ──────────────────────────────────────────────────

/**
 * Parse the MOCK_GEO_PROVIDER_STATUS env var into a lookup map.
 *
 * @returns {Record<string, 'up' | 'down'>}
 */
function parseProviderStatus() {
  const raw = process.env.MOCK_GEO_PROVIDER_STATUS ?? 'primary:up,secondary:up,tertiary:up';
  const status = {};
  for (const segment of raw.split(',')) {
    const [name, state] = segment.trim().split(':');
    if (name && state) {
      status[name.trim()] = state.trim();
    }
  }
  return status;
}

// ─── Mock Provider Implementations ───────────────────────────────────────────

/**
 * @typedef {Object} GeoData
 * @property {string} country    ISO 3166-1 alpha-2 country code (or 'unknown')
 * @property {string} [city]
 * @property {string} [region]
 * @property {number} [lat]
 * @property {number} [lon]
 * @property {string} provider   Which provider resolved the data
 */

/**
 * Mock of ipapi.co (primary provider).
 *
 * @param {string} ip
 * @returns {Promise<GeoData>}
 */
async function enrichWithPrimary(ip) {
  const status = parseProviderStatus();
  if (status['primary'] === 'down') {
    throw new Error('Primary geo provider is down (mock)');
  }
  // Deterministic mock data
  return {
    country: 'US',
    city: 'San Francisco',
    region: 'California',
    lat: 37.7749,
    lon: -122.4194,
    provider: 'primary',
  };
}

/**
 * Mock of ipinfo.io (secondary provider).
 *
 * @param {string} ip
 * @returns {Promise<GeoData>}
 */
async function enrichWithSecondary(ip) {
  const status = parseProviderStatus();
  if (status['secondary'] === 'down') {
    throw new Error('Secondary geo provider is down (mock)');
  }
  return {
    country: 'US',
    city: 'New York',
    region: 'New York',
    lat: 40.7128,
    lon: -74.006,
    provider: 'secondary',
  };
}

/**
 * Mock of abstractapi.com (tertiary provider — designed to always succeed).
 *
 * @param {string} ip
 * @returns {Promise<GeoData>}
 */
async function enrichWithTertiary(ip) {
  const status = parseProviderStatus();
  if (status['tertiary'] === 'down') {
    throw new Error('Tertiary geo provider is down (mock)');
  }
  return {
    country: 'US',
    city: 'Austin',
    region: 'Texas',
    lat: 30.2672,
    lon: -97.7431,
    provider: 'tertiary',
  };
}

// ─── Fallback Chain ───────────────────────────────────────────────────────────

/** @type {Array<{ name: string, fn: (ip: string) => Promise<GeoData>, timeoutMs: number }>} */
const PROVIDERS = [
  { name: 'primary', fn: enrichWithPrimary, timeoutMs: 2000 },
  { name: 'secondary', fn: enrichWithSecondary, timeoutMs: 2000 },
  { name: 'tertiary', fn: enrichWithTertiary, timeoutMs: 3000 },
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
 * If all providers fail, returns graceful degradation data.
 *
 * @param {string} ip  Raw IP address string (IPv4 or IPv6)
 * @returns {Promise<GeoData>}
 */
export async function enrichIp(ip) {
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
 * Regex-based — intentionally lightweight (no npm dep for capstone).
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
