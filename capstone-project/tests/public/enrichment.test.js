import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enrichIp } from '../../src/services/enrichment.js';

// ─── Enrichment Fallback Chain Tests ──────────────────────────────────────────
//
// We control provider status via the MOCK_GEO_PROVIDER_STATUS env var.
// Each test configures the env before calling enrichIp().
//

describe('Enrichment Service — Fallback Chain', () => {
  const originalEnv = process.env.MOCK_GEO_PROVIDER_STATUS;

  afterEach(() => {
    // Restore env after each test
    if (originalEnv !== undefined) {
      process.env.MOCK_GEO_PROVIDER_STATUS = originalEnv;
    } else {
      delete process.env.MOCK_GEO_PROVIDER_STATUS;
    }
  });

  it('uses the primary provider when it is up', async () => {
    process.env.MOCK_GEO_PROVIDER_STATUS = 'primary:up,secondary:up,tertiary:up';
    const result = await enrichIp('1.2.3.4');
    expect(result.provider).toBe('primary');
    expect(result.country).toBe('US');
    expect(result.city).toBeDefined();
  });

  it('falls back to secondary when primary is down', async () => {
    process.env.MOCK_GEO_PROVIDER_STATUS = 'primary:down,secondary:up,tertiary:up';
    const result = await enrichIp('1.2.3.4');
    expect(result.provider).toBe('secondary');
    expect(result.country).toBe('US');
  });

  it('falls back to tertiary when primary and secondary are both down', async () => {
    process.env.MOCK_GEO_PROVIDER_STATUS = 'primary:down,secondary:down,tertiary:up';
    const result = await enrichIp('1.2.3.4');
    expect(result.provider).toBe('tertiary');
    expect(result.country).toBe('US');
  });

  it('returns graceful degradation when all providers are down', async () => {
    process.env.MOCK_GEO_PROVIDER_STATUS = 'primary:down,secondary:down,tertiary:down';
    const result = await enrichIp('1.2.3.4');
    expect(result.provider).toBe('none');
    expect(result.country).toBe('unknown');
  });

  it('includes a provider field in every successful response', async () => {
    process.env.MOCK_GEO_PROVIDER_STATUS = 'primary:up,secondary:up,tertiary:up';
    const result = await enrichIp('192.168.1.1');
    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('country');
  });
});

// ─── User-Agent Parser Tests ───────────────────────────────────────────────────

import { parseUserAgent } from '../../src/services/enrichment.js';

describe('parseUserAgent', () => {
  it('detects Chrome on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Chrome');
    expect(result.os).toBe('Windows');
  });

  it('detects Firefox on macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:126.0) Gecko/20100101 Firefox/126.0';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Firefox');
    expect(result.os).toBe('macOS');
  });

  it('detects Edge browser', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Edge');
  });

  it('detects Android OS', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
    const result = parseUserAgent(ua);
    expect(result.os).toBe('Android');
  });

  it('returns unknown for undefined UA', () => {
    const result = parseUserAgent(undefined);
    expect(result.browser).toBe('unknown');
    expect(result.os).toBe('unknown');
  });

  it('returns unknown for empty string UA', () => {
    const result = parseUserAgent('');
    expect(result.browser).toBe('unknown');
    expect(result.os).toBe('unknown');
  });
});
