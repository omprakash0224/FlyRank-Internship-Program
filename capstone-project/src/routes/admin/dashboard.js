import { Router } from 'express';
import {
  getDashboardStats,
  getDailySubmissions,
  listSubmissions,
  getSubmissionDetail,
  getSubmissionsSince,
} from '../../services/dashboard.js';
import { asyncHandler } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const dashboardRouter = Router();

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
//
// Returns aggregate statistics for the authenticated tenant:
//   totalSubmissions, todaySubmissions, totalWidgets, statusBreakdown, byWidget
//
dashboardRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await getDashboardStats(req.tenantId);
    res.json({ data: stats });
  })
);

// ─── GET /api/dashboard/stats/daily ──────────────────────────────────────────
//
// Returns per-day submission counts for the last N days (default 7, max 30).
// Query params:
//   days — number of days to return (default 7)
//
dashboardRouter.get(
  '/stats/daily',
  asyncHandler(async (req, res) => {
    const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 7));
    const data = await getDailySubmissions(req.tenantId, days);
    res.json({ data });
  })
);

// ─── GET /api/dashboard/submissions/stream ────────────────────────────────────
//
// SSE endpoint — streams new submissions to the dashboard in real time.
// Must be registered BEFORE /:id so Express doesn't interpret "stream" as an ID.
//
// Protocol:
//   event: ping          — keepalive every 15s
//   event: new-submission — JSON payload of new submission(s)
//   event: connected     — initial handshake with timestamp
//
dashboardRouter.get('/submissions/stream', (req, res) => {
  // req.tenantId is already resolved by requireAuth (which now accepts ?token=
  // as a fallback for EventSource connections that cannot send custom headers).
  const tenantId = req.tenantId;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: disable buffering
  res.flushHeaders();

  logger.info({ tenantId }, 'SSE client connected to /submissions/stream');

  // Helper to write SSE frames
  const send = (eventName, data) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Initial handshake
  send('connected', { connectedAt: new Date().toISOString() });

  // Track the latest submission we've seen
  let lastSeenAt = new Date();

  // Poll for new submissions every 3 seconds
  const pollInterval = setInterval(async () => {
    try {
      const newSubmissions = await getSubmissionsSince(tenantId, lastSeenAt);
      if (newSubmissions.length > 0) {
        lastSeenAt = newSubmissions[newSubmissions.length - 1].createdAt;
        send('new-submission', { submissions: newSubmissions });
        logger.debug(
          { tenantId, count: newSubmissions.length },
          'SSE: emitting new submissions'
        );
      }
    } catch (err) {
      logger.error({ err, tenantId }, 'SSE poll error');
    }
  }, 3000);

  // Keepalive ping every 15 seconds
  const pingInterval = setInterval(() => {
    send('ping', { ts: Date.now() });
  }, 15000);

  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(pollInterval);
    clearInterval(pingInterval);
    logger.info({ tenantId }, 'SSE client disconnected');
  });
});

// ─── GET /api/dashboard/submissions ──────────────────────────────────────────
//
// Paginated list of submissions for the tenant.
// Query params:
//   page     — 1-indexed (default 1)
//   limit    — items per page (default 20, max 100)
//   widgetId — optional filter by widget
//
dashboardRouter.get(
  '/submissions',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const widgetId = req.query.widgetId || undefined;

    const result = await listSubmissions(req.tenantId, page, limit, widgetId);

    res.json({
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  })
);

// ─── GET /api/dashboard/submissions/:id ──────────────────────────────────────
//
// Fetch a single submission detail (tenant-isolated).
// Returns 404 if not found or owned by a different tenant.
//
dashboardRouter.get(
  '/submissions/:id',
  asyncHandler(async (req, res) => {
    const submission = await getSubmissionDetail(req.params.id, req.tenantId);
    res.json({ data: submission });
  })
);
