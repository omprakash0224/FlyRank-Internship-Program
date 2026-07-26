import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

// ─── Mock external dependencies so health check doesn't hit real services ────

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/lib/redis.js', () => ({
  redis: {},
  pingRedis: vi.fn().mockResolvedValue(true),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  it('returns 200 with status "ok" when all dependencies are healthy', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dependencies.database).toBe('ok');
    expect(res.body.dependencies.redis).toBe('ok');
  });

  it('returns a timestamp in ISO 8601 format', async () => {
    const res = await request(app).get('/health');
    expect(() => new Date(res.body.timestamp)).not.toThrow();
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes version, uptime, and latencyMs fields', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('latencyMs');
    expect(typeof res.body.latencyMs).toBe('number');
  });

  it('returns 503 with status "degraded" when database is down', async () => {
    // Override the DB mock to throw an error
    const { prisma } = await import('../../src/lib/prisma.js');
    prisma.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.database).toBe('error');
  });

  it('returns 503 with status "degraded" when Redis is down', async () => {
    const { pingRedis } = await import('../../src/lib/redis.js');
    pingRedis.mockResolvedValueOnce(false);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.redis).toBe('error');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
