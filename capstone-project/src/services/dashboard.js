import { prisma } from '../lib/prisma.js';

// ─── Dashboard Service ────────────────────────────────────────────────────────
//
// Provides aggregate statistics and submission queries for the owner dashboard.
// All queries are scoped to the authenticated tenant.
//

/**
 * Compute aggregate dashboard statistics for a tenant.
 *
 * Returns:
 *  - totalSubmissions: all-time count
 *  - todaySubmissions: submissions created today (UTC)
 *  - totalWidgets: active widget count
 *  - statusBreakdown: { PENDING, ENRICHED, STORED, FAILED }
 *  - byWidget: [{ widgetId, widgetName, count }] sorted desc
 *
 * @param {string} tenantId
 * @returns {Promise<object>}
 */
export async function getDashboardStats(tenantId) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    totalSubmissions,
    todaySubmissions,
    totalWidgets,
    statusGroups,
    widgetGroups,
  ] = await prisma.$transaction([
    // Total submissions for tenant
    prisma.submission.count({ where: { tenantId } }),

    // Submissions created today (UTC midnight boundary)
    prisma.submission.count({
      where: { tenantId, createdAt: { gte: todayStart } },
    }),

    // Active widget count
    prisma.widget.count({ where: { tenantId, isActive: true } }),

    // Group by status
    prisma.submission.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { status: true },
    }),

    // Group by widget — include widget name via join
    prisma.submission.groupBy({
      by: ['widgetId'],
      where: { tenantId },
      _count: { widgetId: true },
      orderBy: { _count: { widgetId: 'desc' } },
      take: 10,
    }),
  ]);

  // Resolve widget names for the by-widget breakdown
  const widgetIds = widgetGroups.map((g) => g.widgetId);
  const widgets = await prisma.widget.findMany({
    where: { id: { in: widgetIds } },
    select: { id: true, name: true, type: true },
  });
  const widgetMap = Object.fromEntries(widgets.map((w) => [w.id, w]));

  const statusBreakdown = { PENDING: 0, ENRICHED: 0, STORED: 0, FAILED: 0 };
  for (const group of statusGroups) {
    statusBreakdown[group.status] = group._count.status;
  }

  const byWidget = widgetGroups.map((g) => ({
    widgetId: g.widgetId,
    widgetName: widgetMap[g.widgetId]?.name ?? 'Unknown',
    widgetType: widgetMap[g.widgetId]?.type ?? 'UNKNOWN',
    count: g._count.widgetId,
  }));

  return {
    totalSubmissions,
    todaySubmissions,
    totalWidgets,
    statusBreakdown,
    byWidget,
  };
}

/**
 * Paginated list of submissions for a tenant, optionally filtered by widget.
 *
 * @param {string} tenantId
 * @param {number} page   1-indexed
 * @param {number} limit
 * @param {string|undefined} widgetId   Optional filter
 * @returns {Promise<{ items: object[], total: number, page: number, limit: number }>}
 */
export async function listSubmissions(tenantId, page, limit, widgetId) {
  const skip = (page - 1) * limit;
  const where = { tenantId, ...(widgetId ? { widgetId } : {}) };

  const [items, total] = await prisma.$transaction([
    prisma.submission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        widget: { select: { name: true, type: true } },
      },
    }),
    prisma.submission.count({ where }),
  ]);

  return { items, total, page, limit };
}

/**
 * Fetch a single submission by ID, with tenant ownership check.
 *
 * @param {string} id
 * @param {string} tenantId
 * @returns {Promise<object>}
 * @throws {import('../utils/errors.js').NotFoundError}
 */
export async function getSubmissionDetail(id, tenantId) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      widget: { select: { name: true, type: true, config: true } },
    },
  });

  if (!submission || submission.tenantId !== tenantId) {
    const { NotFoundError } = await import('../utils/errors.js');
    throw new NotFoundError('Submission');
  }

  return submission;
}

/**
 * Fetch the most recent submission timestamp for a tenant.
 * Used by the SSE poller to detect new submissions.
 *
 * @param {string} tenantId
 * @returns {Promise<Date|null>}
 */
export async function getLatestSubmissionDate(tenantId) {
  const row = await prisma.submission.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

/**
 * Fetch submissions created after a given timestamp (for SSE streaming).
 *
 * @param {string} tenantId
 * @param {Date} since
 * @returns {Promise<object[]>}
 */
export async function getSubmissionsSince(tenantId, since) {
  return prisma.submission.findMany({
    where: { tenantId, createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
    include: {
      widget: { select: { name: true, type: true } },
    },
  });
}
