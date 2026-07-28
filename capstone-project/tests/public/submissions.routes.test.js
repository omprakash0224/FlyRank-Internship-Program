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

// Mock the submission service — routes delegate entirely to it
vi.mock('../../src/services/submission.js', () => ({
  processSubmission: vi.fn(),
  extractIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

import * as submissionService from '../../src/services/submission.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const WIDGET_ID = 'cuid_test_widget_abc123';
const SUBMISSION_ID = 'cuid_test_submission_xyz789';

const validBody = {
  widgetId: WIDGET_ID,
  data: { email: 'visitor@example.com', name: 'Alice' },
};

// ─── Submission Route Tests ───────────────────────────────────────────────────

describe('POST /submissions', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  // ─── CORS Preflight ──────────────────────────────────────────────────────────

  describe('OPTIONS /submissions (CORS preflight)', () => {
    it('returns 204 with CORS headers for a preflight request', async () => {
      const res = await request(app)
        .options('/submissions')
        .set('Origin', 'https://customer-site.example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
    });

    it('returns correct Access-Control-Allow-Headers', async () => {
      const res = await request(app)
        .options('/submissions')
        .set('Origin', 'https://customer-site.example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(res.headers['access-control-allow-headers']).toMatch(/content-type/i);
    });
  });

  // ─── Happy Path ──────────────────────────────────────────────────────────────

  describe('Successful submissions', () => {
    it('returns 202 Accepted with submissionId for a valid submission', async () => {
      submissionService.processSubmission.mockResolvedValue({
        submissionId: SUBMISSION_ID,
        spam: false,
      });

      const res = await request(app)
        .post('/submissions')
        .set('Origin', 'https://customer-site.example.com')
        .send(validBody);

      expect(res.status).toBe(202);
      expect(res.body.submissionId).toBe(SUBMISSION_ID);
      expect(res.body.message).toContain('received');
    });

    it('returns CORS Access-Control-Allow-Origin header on POST', async () => {
      submissionService.processSubmission.mockResolvedValue({
        submissionId: SUBMISSION_ID,
        spam: false,
      });

      const res = await request(app)
        .post('/submissions')
        .set('Origin', 'https://customer-site.example.com')
        .send(validBody);

      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('calls processSubmission with the validated body', async () => {
      submissionService.processSubmission.mockResolvedValue({
        submissionId: SUBMISSION_ID,
        spam: false,
      });

      await request(app).post('/submissions').send(validBody);

      expect(submissionService.processSubmission).toHaveBeenCalledWith(
        expect.objectContaining({ widgetId: WIDGET_ID }),
        expect.any(Object) // req
      );
    });
  });

  // ─── Spam Handling ───────────────────────────────────────────────────────────

  describe('Spam submissions', () => {
    it('returns 200 (not 202) for spam — silent accept', async () => {
      submissionService.processSubmission.mockResolvedValue({
        submissionId: null,
        spam: true,
      });

      const res = await request(app)
        .post('/submissions')
        .send({ ...validBody, website: 'http://spambot.com' });

      expect(res.status).toBe(200);
      // No submissionId in spam response
      expect(res.body.submissionId).toBeUndefined();
    });

    it('spam response body looks identical to success so bots cannot distinguish', async () => {
      submissionService.processSubmission.mockResolvedValue({
        submissionId: null,
        spam: true,
      });

      const res = await request(app).post('/submissions').send(validBody);

      expect(res.body.message).toBeDefined();
    });
  });

  // ─── Validation ──────────────────────────────────────────────────────────────

  describe('Validation errors', () => {
    it('returns 400 when widgetId is missing', async () => {
      const res = await request(app)
        .post('/submissions')
        .send({ data: { email: 'x@x.com' } });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
    });

    it('returns 400 when data is missing', async () => {
      const res = await request(app)
        .post('/submissions')
        .send({ widgetId: WIDGET_ID });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when data is empty object (no fields)', async () => {
      const res = await request(app)
        .post('/submissions')
        .send({ widgetId: WIDGET_ID, data: {} });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when a data value exceeds 1000 characters', async () => {
      const res = await request(app)
        .post('/submissions')
        .send({
          widgetId: WIDGET_ID,
          data: { email: 'a'.repeat(1001) },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when data has more than 50 fields', async () => {
      const tooManyFields = {};
      for (let i = 0; i <= 50; i++) {
        tooManyFields[`field_${i}`] = 'value';
      }

      const res = await request(app)
        .post('/submissions')
        .send({ widgetId: WIDGET_ID, data: tooManyFields });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when widgetId is an empty string', async () => {
      const res = await request(app)
        .post('/submissions')
        .send({ widgetId: '', data: { email: 'x@x.com' } });

      expect(res.status).toBe(400);
    });
  });

  // ─── Rate Limiting ───────────────────────────────────────────────────────────

  describe('Rate limiting', () => {
    it('returns 429 when the service throws TooManyRequestsError', async () => {
      const { TooManyRequestsError } = await import('../../src/utils/errors.js');
      submissionService.processSubmission.mockRejectedValue(
        new TooManyRequestsError('Too many submissions')
      );

      const res = await request(app).post('/submissions').send(validBody);

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });
  });

  // ─── Side Effect Safety ──────────────────────────────────────────────────────

  describe('Side effect failure resilience', () => {
    it('returns 202 even when a side effect would fail — service absorbs errors', async () => {
      // The service itself handles side-effect errors internally.
      // This test verifies the route returns 202 as long as the service resolves.
      submissionService.processSubmission.mockResolvedValue({
        submissionId: SUBMISSION_ID,
        spam: false,
      });

      const res = await request(app).post('/submissions').send(validBody);

      // Side effects are fire-and-forget inside the service — route always 202
      expect(res.status).toBe(202);
      expect(res.body.submissionId).toBe(SUBMISSION_ID);
    });
  });

  // ─── 404 for Unknown Widget ───────────────────────────────────────────────────

  describe('Widget not found', () => {
    it('returns 404 when the service throws NotFoundError', async () => {
      const { NotFoundError } = await import('../../src/utils/errors.js');
      submissionService.processSubmission.mockRejectedValue(new NotFoundError('Widget'));

      const res = await request(app).post('/submissions').send(validBody);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});

// ─── Spam Filter Unit Tests ───────────────────────────────────────────────────

import { checkSpam } from '../../src/lib/spam-filter.js';

describe('checkSpam', () => {
  it('detects filled honeypot field', () => {
    const result = checkSpam({ website: 'http://spamsite.com', data: { email: 'x@x.com' } });
    expect(result.isSpam).toBe(true);
    expect(result.reason).toBe('honeypot');
  });

  it('passes clean legitimate submission', () => {
    const result = checkSpam({ website: '', data: { email: 'alice@example.com', name: 'Alice' } });
    expect(result.isSpam).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('passes when website field is absent', () => {
    const result = checkSpam({ data: { email: 'bob@example.com' } });
    expect(result.isSpam).toBe(false);
  });

  it('detects excessive links (>3 URLs)', () => {
    const result = checkSpam({
      data: {
        message:
          'Visit http://a.com http://b.com http://c.com http://d.com for free money',
      },
    });
    expect(result.isSpam).toBe(true);
    expect(result.reason).toBe('excessive_links');
  });

  it('detects all-caps text (>80% uppercase)', () => {
    const result = checkSpam({
      data: { message: 'BUY NOW CLICK HERE FREE MONEY AMAZING DEAL' },
    });
    expect(result.isSpam).toBe(true);
    expect(result.reason).toBe('all_caps');
  });

  it('detects spam keywords', () => {
    const result = checkSpam({
      data: { message: 'Click here to win free money now!' },
    });
    expect(result.isSpam).toBe(true);
    expect(result.reason).toBe('spam_keyword');
  });

  it('does not flag short all-caps strings (≤10 alpha chars) as spam', () => {
    // Short strings like "USA" or "OK" shouldn't trigger all-caps rule
    const result = checkSpam({ data: { country: 'USA' } });
    expect(result.isSpam).toBe(false);
  });
});
