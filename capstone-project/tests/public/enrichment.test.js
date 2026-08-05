import { describe, it, expect, afterEach, vi } from 'vitest';
import { enrichIp } from '../../src/services/enrichment.js';

// ─── Enrichment Service Tests ─────────────────────────────────────────────────
//
// fetch is stubbed globally so no real HTTP calls are made.
// Each test configures the stub to simulate provider success/failure,
// exercising the same fallback behaviours as the former mock chain.
//

/** Helper — build a resolved fetch stub for a given JSON body. */
function okFetch(body) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

/** Helper — build a rejected fetch stub (network error). */
function failFetch(message = 'Network error') {
  return vi.fn().mockRejectedValue(new Error(message));
}

/** Helper — build a non-OK fetch stub (e.g. 429 / 503). */
function errorFetch(status = 503) {
  return vi.fn().mockResolvedValue({ ok: false, status });
}

// ─── ipwho.is response shape ──────────────────────────────────────────────────
const IPWHO_OK = {
  success: true,
  country_code: 'DE',
  city: 'Berlin',
  region: 'Berlin',
  latitude: 52.52,
  longitude: 13.405,
};

// ─── ipapi.co response shape ──────────────────────────────────────────────────
const IPAPI_OK = {
  country_code: 'FR',
  city: 'Paris',
  region: 'Île-de-France',
  latitude: 48.8566,
  longitude: 2.3522,
};

// ─── freeipapi.com response shape ────────────────────────────────────────────
const FREEIPAPI_OK = {
  countryCode: 'JP',
  cityName: 'Tokyo',
  regionName: 'Tokyo',
  latitude: 35.6895,
  longitude: 139.6917,
};

describe('enrichIp — fallback chain', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── All providers up — should use the primary (ipwho.is) ─────────────────

  it('uses ipwho.is (primary) when all providers succeed', async () => {
    vi.stubGlobal(
      'fetch',
      okFetch(IPWHO_OK) // only the first call is needed
    );
    const result = await enrichIp('1.2.3.4');
    expect(result.provider).toBe('ipwho.is');
    expect(result.country).toBe('DE');
    expect(result.city).toBe('Berlin');
  });

  // ── Primary fails → falls back to ipapi.co ───────────────────────────────

  it('falls back to ipapi.co when ipwho.is fails', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ipwho.is down')) // primary fails
      .mockResolvedValueOnce({ ok: true, json: async () => IPAPI_OK }); // secondary OK

    vi.stubGlobal('fetch', fetchMock);
    const result = await enrichIp('1.2.3.4');
    expect(result.provider).toBe('ipapi.co');
    expect(result.country).toBe('FR');
    expect(result.city).toBe('Paris');
  });

  // ── Primary + secondary fail → falls back to freeipapi.com ───────────────

  it('falls back to freeipapi.com when ipwho.is and ipapi.co both fail', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ipwho.is down'))
      .mockRejectedValueOnce(new Error('ipapi.co down'))
      .mockResolvedValueOnce({ ok: true, json: async () => FREEIPAPI_OK });

    vi.stubGlobal('fetch', fetchMock);
    const result = await enrichIp('1.2.3.4');
    expect(result.provider).toBe('freeipapi.com');
    expect(result.country).toBe('JP');
    expect(result.city).toBe('Tokyo');
  });

  // ── All providers fail → graceful degradation ─────────────────────────────

  it('returns graceful degradation when all providers fail', async () => {
    vi.stubGlobal('fetch', failFetch('All providers down'));
    const result = await enrichIp('1.2.3.4');
    expect(result.provider).toBe('none');
    expect(result.country).toBe('unknown');
  });

  // ── Non-OK HTTP status is treated as failure ──────────────────────────────

  it('treats a non-OK HTTP status from ipwho.is as a failure and falls back', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 }) // primary → 429
      .mockResolvedValueOnce({ ok: true, json: async () => IPAPI_OK }); // secondary OK

    vi.stubGlobal('fetch', fetchMock);
    const result = await enrichIp('5.6.7.8');
    expect(result.provider).toBe('ipapi.co');
  });

  // ── ipwho.is success:false is treated as failure ──────────────────────────

  it('treats ipwho.is success:false as a failure and falls back', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, message: 'IP not found' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => IPAPI_OK });

    vi.stubGlobal('fetch', fetchMock);
    const result = await enrichIp('0.0.0.0');
    expect(result.provider).toBe('ipapi.co');
  });

  // ── ipapi.co error field is treated as failure ────────────────────────────

  it('treats ipapi.co error:true as a failure and falls back to freeipapi.com', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ipwho.is down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: true, reason: 'Reserved IP Address' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => FREEIPAPI_OK });

    vi.stubGlobal('fetch', fetchMock);
    const result = await enrichIp('1.2.3.4');
    expect(result.provider).toBe('freeipapi.com');
  });

  // ── Every successful response has the required shape ──────────────────────

  it('includes country and provider in every successful response', async () => {
    vi.stubGlobal('fetch', okFetch(IPWHO_OK));
    const result = await enrichIp('8.8.8.8');
    expect(result).toHaveProperty('country');
    expect(result).toHaveProperty('provider');
  });

  // ── Private / loopback IPs are short-circuited ────────────────────────────

  it('short-circuits for loopback IPv4 without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await enrichIp('127.0.0.1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.provider).toBe('local');
    expect(result.country).toBe('private');
  });

  it('short-circuits for loopback IPv6 without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await enrichIp('::1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.provider).toBe('local');
  });

  it('short-circuits for RFC-1918 10.x.x.x without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await enrichIp('10.0.0.1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.country).toBe('private');
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
