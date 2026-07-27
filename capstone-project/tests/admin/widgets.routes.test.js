import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { issueToken } from '../../src/middleware/auth.js';

// ─── Mock all infrastructure so no real DB/Redis is needed ───────────────────

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../src/lib/redis.js', () => ({
  redis: {},
  pingRedis: vi.fn().mockResolvedValue(true),
}));

// Mock the widget service — routes delegate entirely to the service
vi.mock('../../src/services/widget.js', () => ({
  createWidget: vi.fn(),
  getWidget: vi.fn(),
  listWidgets: vi.fn(),
  updateWidget: vi.fn(),
  deleteWidget: vi.fn(),
  generateSnippet: vi.fn(),
}));

import { prisma } from '../../src/lib/prisma.js';
import * as widgetService from '../../src/services/widget.js';
import { ForbiddenError, NotFoundError } from '../../src/utils/errors.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant_integration_test';
const WIDGET_ID = 'widget_integration_test';

const mockTenant = {
  id: TENANT_ID,
  name: 'Test Corp',
  email: 'test@example.com',
  apiKey: 'ak_test',
  createdAt: new Date(),
};

const mockWidget = {
  id: WIDGET_ID,
  tenantId: TENANT_ID,
  name: 'Integration Widget',
  type: 'SIGNUP_FORM',
  config: {
    fields: [{ name: 'email', type: 'email', label: 'Email' }],
    copy: { button: 'Subscribe', success: 'Thanks!' },
    styling: { theme: 'light', primaryColor: '#3b82f6' },
  },
  version: 1,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const validBody = {
  name: 'Integration Widget',
  type: 'SIGNUP_FORM',
  config: {
    fields: [{ name: 'email', type: 'email', label: 'Email' }],
  },
};

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function authHeader(tenantId = TENANT_ID) {
  return `Bearer ${issueToken(tenantId)}`;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Admin Widget Routes', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    // attachTenant middleware will call prisma.tenant.findUnique
    prisma.tenant.findUnique.mockResolvedValue(mockTenant);
  });

  // ─── Auth Guard ────────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('returns 401 when no Authorization header is provided', async () => {
      const res = await request(app).get('/api/widgets');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when an invalid token is provided', async () => {
      const res = await request(app)
        .get('/api/widgets')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });

    it('returns 401 when the Authorization scheme is not Bearer', async () => {
      const res = await request(app)
        .get('/api/widgets')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/widgets ─────────────────────────────────────────────────────

  describe('POST /api/widgets', () => {
    it('creates a widget and returns 201', async () => {
      widgetService.createWidget.mockResolvedValue(mockWidget);

      const res = await request(app)
        .post('/api/widgets')
        .set('Authorization', authHeader())
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(WIDGET_ID);
      expect(res.body.data.name).toBe('Integration Widget');
      expect(widgetService.createWidget).toHaveBeenCalledWith(TENANT_ID, expect.any(Object));
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/widgets')
        .set('Authorization', authHeader())
        .send({ name: 'Missing type and config' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
    });

    it('returns 400 with field-level errors for an invalid type enum', async () => {
      const res = await request(app)
        .post('/api/widgets')
        .set('Authorization', authHeader())
        .send({ ...validBody, type: 'BANNER' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when config fields array is empty', async () => {
      const res = await request(app)
        .post('/api/widgets')
        .set('Authorization', authHeader())
        .send({ ...validBody, config: { fields: [] } });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/widgets ──────────────────────────────────────────────────────

  describe('GET /api/widgets', () => {
    it('returns 200 with a pagination envelope', async () => {
      widgetService.listWidgets.mockResolvedValue({
        items: [mockWidget],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/widgets')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.meta.totalPages).toBe(1);
    });

    it('passes page and limit query params to the service', async () => {
      widgetService.listWidgets.mockResolvedValue({ items: [], total: 0, page: 2, limit: 5 });

      await request(app)
        .get('/api/widgets?page=2&limit=5')
        .set('Authorization', authHeader());

      expect(widgetService.listWidgets).toHaveBeenCalledWith(TENANT_ID, 2, 5);
    });

    it('returns 400 for invalid pagination params', async () => {
      const res = await request(app)
        .get('/api/widgets?page=abc')
        .set('Authorization', authHeader());

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/widgets/:id ──────────────────────────────────────────────────

  describe('GET /api/widgets/:id', () => {
    it('returns 200 with the widget data for a valid owner', async () => {
      widgetService.getWidget.mockResolvedValue(mockWidget);

      const res = await request(app)
        .get(`/api/widgets/${WIDGET_ID}`)
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(WIDGET_ID);
    });

    it('returns 404 when the widget does not exist', async () => {
      widgetService.getWidget.mockRejectedValue(new NotFoundError('Widget'));

      const res = await request(app)
        .get('/api/widgets/nonexistent')
        .set('Authorization', authHeader());

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 403 when accessing another tenant\'s widget (tenant isolation)', async () => {
      widgetService.getWidget.mockRejectedValue(
        new ForbiddenError('You do not have access to this resource')
      );

      const res = await request(app)
        .get(`/api/widgets/${WIDGET_ID}`)
        .set('Authorization', authHeader('tenant_different'));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ─── PATCH /api/widgets/:id ────────────────────────────────────────────────

  describe('PATCH /api/widgets/:id', () => {
    it('returns 200 with the updated widget', async () => {
      const updated = { ...mockWidget, name: 'Renamed', version: 2 };
      widgetService.updateWidget.mockResolvedValue(updated);

      const res = await request(app)
        .patch(`/api/widgets/${WIDGET_ID}`)
        .set('Authorization', authHeader())
        .send({ name: 'Renamed' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Renamed');
      expect(res.body.data.version).toBe(2);
    });

    it('returns 400 when the update body is empty', async () => {
      const res = await request(app)
        .patch(`/api/widgets/${WIDGET_ID}`)
        .set('Authorization', authHeader())
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 403 when patching another tenant\'s widget', async () => {
      widgetService.updateWidget.mockRejectedValue(new ForbiddenError('Access denied'));

      const res = await request(app)
        .patch(`/api/widgets/${WIDGET_ID}`)
        .set('Authorization', authHeader())
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /api/widgets/:id ───────────────────────────────────────────────

  describe('DELETE /api/widgets/:id', () => {
    it('returns 204 No Content on successful soft-delete', async () => {
      widgetService.deleteWidget.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/widgets/${WIDGET_ID}`)
        .set('Authorization', authHeader());

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });

    it('returns 404 when deleting a non-existent widget', async () => {
      widgetService.deleteWidget.mockRejectedValue(new NotFoundError('Widget'));

      const res = await request(app)
        .delete('/api/widgets/ghost')
        .set('Authorization', authHeader());

      expect(res.status).toBe(404);
    });

    it('returns 403 when deleting another tenant\'s widget', async () => {
      widgetService.deleteWidget.mockRejectedValue(new ForbiddenError('Access denied'));

      const res = await request(app)
        .delete(`/api/widgets/${WIDGET_ID}`)
        .set('Authorization', authHeader());

      expect(res.status).toBe(403);
    });
  });

  // ─── POST /api/widgets/:id/snippet ────────────────────────────────────────

  describe('POST /api/widgets/:id/snippet', () => {
    it('returns 200 with snippet, widgetId, and version', async () => {
      const snippetResult = {
        snippet: `<script src="http://localhost:3000/widget.js" data-widget-id="${WIDGET_ID}" async defer></script>`,
        widgetId: WIDGET_ID,
        version: 1,
      };
      widgetService.generateSnippet.mockResolvedValue(snippetResult);

      const res = await request(app)
        .post(`/api/widgets/${WIDGET_ID}/snippet`)
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.data.snippet).toContain(`data-widget-id="${WIDGET_ID}"`);
      expect(res.body.data.widgetId).toBe(WIDGET_ID);
      expect(typeof res.body.data.version).toBe('number');
    });

    it('returns 403 when generating a snippet for another tenant\'s widget', async () => {
      widgetService.generateSnippet.mockRejectedValue(new ForbiddenError('Access denied'));

      const res = await request(app)
        .post(`/api/widgets/${WIDGET_ID}/snippet`)
        .set('Authorization', authHeader());

      expect(res.status).toBe(403);
    });
  });
});
