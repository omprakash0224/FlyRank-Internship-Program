import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

// ─── Mock all infrastructure ──────────────────────────────────────────────────

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

// Mock the widget repository so we control what findWidgetById returns
vi.mock('../../src/repositories/widget.js', () => ({
  findWidgetById: vi.fn(),
}));

import * as widgetRepo from '../../src/repositories/widget.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const WIDGET_ID = 'cuid_test_widget_abc123';

const mockWidget = {
  id: WIDGET_ID,
  tenantId: 'tenant_test',
  name: 'Test Widget',
  type: 'SIGNUP_FORM',
  config: {
    fields: [{ name: 'email', type: 'email', label: 'Email', required: true }],
    copy: { title: 'Stay Updated', button: 'Subscribe', success: 'Thanks!' },
    styling: { theme: 'light', primaryColor: '#3b82f6' },
  },
  version: 3,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Config Route Tests ───────────────────────────────────────────────────────

describe('GET /widgets/:id/config', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns 200 with the widget config payload', async () => {
    widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

    const res = await request(app).get(`/widgets/${WIDGET_ID}/config`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(WIDGET_ID);
    expect(res.body.version).toBe(3);
    expect(res.body.type).toBe('SIGNUP_FORM');
    expect(res.body.fields).toHaveLength(1);
  });

  it('sets ETag header matching the widget version', async () => {
    widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

    const res = await request(app).get(`/widgets/${WIDGET_ID}/config`);

    expect(res.headers['etag']).toBe('"v3"');
  });

  it('sets Cache-Control: public, max-age=300', async () => {
    widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

    const res = await request(app).get(`/widgets/${WIDGET_ID}/config`);

    expect(res.headers['cache-control']).toBe('public, max-age=300');
  });

  it('returns 304 Not Modified when If-None-Match matches ETag', async () => {
    widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

    const res = await request(app)
      .get(`/widgets/${WIDGET_ID}/config`)
      .set('If-None-Match', '"v3"');

    expect(res.status).toBe(304);
  });

  it('returns 200 when If-None-Match does not match (stale ETag)', async () => {
    widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

    const res = await request(app)
      .get(`/widgets/${WIDGET_ID}/config`)
      .set('If-None-Match', '"v1"');

    expect(res.status).toBe(200);
  });

  it('returns 404 when widget does not exist', async () => {
    widgetRepo.findWidgetById.mockResolvedValue(null);

    const res = await request(app).get('/widgets/nonexistent/config');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for an inactive widget', async () => {
    widgetRepo.findWidgetById.mockResolvedValue({ ...mockWidget, isActive: false });

    const res = await request(app).get(`/widgets/${WIDGET_ID}/config`);

    expect(res.status).toBe(404);
  });

  it('sets Access-Control-Allow-Origin header (CORS)', async () => {
    widgetRepo.findWidgetById.mockResolvedValue(mockWidget);

    const res = await request(app)
      .get(`/widgets/${WIDGET_ID}/config`)
      .set('Origin', 'https://customer-site.example.com');

    // cors({ origin: '*' }) sets this header
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('handles OPTIONS preflight for config endpoint', async () => {
    const res = await request(app)
      .options(`/widgets/${WIDGET_ID}/config`)
      .set('Origin', 'https://customer-site.example.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(204);
  });
});
