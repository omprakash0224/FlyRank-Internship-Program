/**
 * tests/e2e/embed.test.js
 *
 * End-to-end integration tests for the Milestone 4 embed / config-delivery flow.
 *
 * These tests exercise the full request path through the Express app using
 * Supertest — no real browser, no real database, no real Redis.
 * Infrastructure is mocked at the module level exactly as in the other test
 * suites, so the tests remain deterministic and run in CI without services.
 *
 * Coverage:
 *   M4.1 — Config endpoint (ETag, Cache-Control, 304, CORS)   [supplement]
 *   M4.2 — Static file serving: GET /widget.js returns 200
 *   M4.6 — Full embed flow: config load → form submit → 202
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

// ─── Mock Infrastructure ──────────────────────────────────────────────────────
// Matches the pattern used across all other test suites.

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    tenant: { findUnique: vi.fn() },
  },
}));

vi.mock('../../src/lib/redis.js', () => ({
  redis: {},
  pingRedis: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/repositories/widget.js', () => ({
  findWidgetById: vi.fn(),
}));

vi.mock('../../src/services/submission.js', () => ({
  processSubmission: vi.fn(),
  extractIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

import * as widgetRepo from '../../src/repositories/widget.js';
import * as submissionService from '../../src/services/submission.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const WIDGET_ID     = 'cuid_e2e_widget_abc';
const SUBMISSION_ID = 'cuid_e2e_submission_xyz';

/** Full widget record returned by the mocked repository. */
const mockWidget = {
  id: WIDGET_ID,
  tenantId: 'tenant_e2e',
  name: 'E2E Test Widget',
  type: 'SIGNUP_FORM',
  config: {
    fields: [
      { name: 'email', type: 'email', label: 'Email', required: true },
      { name: 'name',  type: 'text',  label: 'Name',  required: false },
    ],
    copy: {
      title:   'Stay Updated',
      button:  'Subscribe',
      success: 'Thanks for subscribing!',
    },
    styling: { theme: 'light', primaryColor: '#3b82f6' },
  },
  version: 3,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Milestone 4 — Config Delivery & Embed Script (E2E)', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M4.2 — Static file serving
  // ───────────────────────────────────────────────────────────────────────────

  describe('GET /widget.js (static file serving)', () => {
    it('returns 200 with Content-Type: application/javascript', async () => {
      const res = await request(app).get('/widget.js');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/javascript/);
    });

    it('response body contains the IIFE wrapper (sanity check)', async () => {
      const res = await request(app).get('/widget.js');

      // The embed script is an IIFE — confirm key fingerprints are present
      expect(res.text).toContain('data-widget-id');
      expect(res.text).toContain('attachShadow');
      expect(res.text).toContain('/submissions');
    });

    it('serves widget.js with Cache-Control header', async () => {
      const res = await request(app).get('/widget.js');

      // setHeaders callback in app.js applies public, max-age=60 for widget.js
      expect(res.headers['cache-control']).toMatch(/public/);
    });

    it('returns 404 for a non-existent static file', async () => {
      const res = await request(app).get('/nonexistent-file.js');

      // Falls through static middleware to 404 handler
      expect(res.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M4.1 — Config endpoint (supplementary E2E-level checks)
  // ───────────────────────────────────────────────────────────────────────────

  describe('GET /widgets/:id/config (config delivery)', () => {
    it('returns 200 with the correct public config shape', async () => {
      widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

      const res = await request(app).get(`/widgets/${WIDGET_ID}/config`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id:      WIDGET_ID,
        version: 3,
        type:    'SIGNUP_FORM',
        fields:  expect.arrayContaining([
          expect.objectContaining({ name: 'email', type: 'email' }),
        ]),
        copy: expect.objectContaining({
          title:  'Stay Updated',
          button: 'Subscribe',
        }),
        styling: expect.objectContaining({ primaryColor: '#3b82f6' }),
      });
    });

    it('sets ETag header matching widget version', async () => {
      widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

      const res = await request(app).get(`/widgets/${WIDGET_ID}/config`);

      expect(res.headers['etag']).toBe('"v3"');
    });

    it('sets Cache-Control: public, max-age=300', async () => {
      widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

      const res = await request(app).get(`/widgets/${WIDGET_ID}/config`);

      expect(res.headers['cache-control']).toBe('public, max-age=300');
    });

    it('returns 304 Not Modified for If-None-Match matching ETag (conditional GET)', async () => {
      widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

      const res = await request(app)
        .get(`/widgets/${WIDGET_ID}/config`)
        .set('If-None-Match', '"v3"');

      expect(res.status).toBe(304);
      expect(res.body).toEqual({}); // No body on 304
    });

    it('returns 200 for a stale If-None-Match (outdated ETag)', async () => {
      widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

      const res = await request(app)
        .get(`/widgets/${WIDGET_ID}/config`)
        .set('If-None-Match', '"v1"');

      expect(res.status).toBe(200);
    });

    it('returns 404 for an unknown widget ID', async () => {
      widgetRepo.findWidgetById.mockResolvedValue(null);

      const res = await request(app).get('/widgets/unknown-id/config');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for an inactive widget', async () => {
      widgetRepo.findWidgetById.mockResolvedValue({ ...mockWidget, isActive: false });

      const res = await request(app).get(`/widgets/${WIDGET_ID}/config`);

      expect(res.status).toBe(404);
    });

    it('sets Access-Control-Allow-Origin: * (CORS open for any origin)', async () => {
      widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

      const res = await request(app)
        .get(`/widgets/${WIDGET_ID}/config`)
        .set('Origin', 'https://customer-site.example.com');

      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('handles OPTIONS preflight for the config endpoint', async () => {
      const res = await request(app)
        .options(`/widgets/${WIDGET_ID}/config`)
        .set('Origin', 'https://customer-site.example.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M4.6 — Full embed flow: config → submit → response
  // ───────────────────────────────────────────────────────────────────────────

  describe('Full embed flow (config load → form submit → dashboard)', () => {
    it('happy path: visitor fetches config then submits → 202 Accepted', async () => {
      widgetRepo.findWidgetById.mockResolvedValue(mockWidget);
      submissionService.processSubmission.mockResolvedValue({
        submissionId: SUBMISSION_ID,
        spam: false,
      });

      // Step 1 — embed script fetches widget config (ETag-aware GET)
      const configRes = await request(app)
        .get(`/widgets/${WIDGET_ID}/config`)
        .set('Origin', 'https://customer-site.example.com');

      expect(configRes.status).toBe(200);
      expect(configRes.body.id).toBe(WIDGET_ID);

      const etag = configRes.headers['etag'];

      // Step 2 — embed script submits form data
      const submitRes = await request(app)
        .post('/submissions')
        .set('Origin', 'https://customer-site.example.com')
        .set('Content-Type', 'application/json')
        .send({
          widgetId: WIDGET_ID,
          data: { email: 'visitor@example.com', name: 'Alice' },
        });

      expect(submitRes.status).toBe(202);
      expect(submitRes.body.submissionId).toBe(SUBMISSION_ID);

      // Step 3 — confirm processSubmission was called with the right widgetId
      expect(submissionService.processSubmission).toHaveBeenCalledOnce();
      const [calledBody] = submissionService.processSubmission.mock.calls[0];
      expect(calledBody.widgetId).toBe(WIDGET_ID);

      // ETag was present (will be used by embed script on repeat visits)
      expect(etag).toBe('"v3"');
    });

    it('second visit uses cached config: 304 Not Modified', async () => {
      widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

      // Simulate the embed script sending the cached ETag on a repeat page load
      const res = await request(app)
        .get(`/widgets/${WIDGET_ID}/config`)
        .set('If-None-Match', '"v3"');

      expect(res.status).toBe(304);
      // No body — embed script keeps using its in-memory config
    });

    it('spam submission returns 200 without storing (silent accept)', async () => {
      submissionService.processSubmission.mockResolvedValue({ spam: true });

      const res = await request(app)
        .post('/submissions')
        .set('Origin', 'https://customer-site.example.com')
        .send({
          widgetId: WIDGET_ID,
          // honeypot field filled — server detects spam
          data: { email: 'bot@spam.com', website: 'http://spamsite.com' },
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Submission received');
      // submissionId must NOT be present (nothing was stored)
      expect(res.body.submissionId).toBeUndefined();
    });

    it('cross-origin submission includes correct CORS headers', async () => {
      submissionService.processSubmission.mockResolvedValue({
        submissionId: SUBMISSION_ID,
        spam: false,
      });

      const res = await request(app)
        .post('/submissions')
        .set('Origin', 'http://localhost:8080') // different-port "external" site
        .send({
          widgetId: WIDGET_ID,
          data: { email: 'user@example.com' },
        });

      expect(res.status).toBe(202);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('config after widget update reflects new version (cache bust via ETag)', async () => {
      // Simulates admin updating widget: version bumps from 3 → 4
      widgetRepo.findWidgetById.mockResolvedValue({ ...mockWidget, version: 4 });

      const res = await request(app)
        .get(`/widgets/${WIDGET_ID}/config`)
        // Old ETag no longer matches → server sends fresh config
        .set('If-None-Match', '"v3"');

      expect(res.status).toBe(200);
      expect(res.headers['etag']).toBe('"v4"');
      expect(res.body.version).toBe(4);
    });
  });
});
