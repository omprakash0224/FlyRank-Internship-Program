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
 *  - yesterdaySubmissions: submissions created yesterday (UTC) — for today trend
 *  - last7dSubmissions: submissions in the last 7 days — for total trend
 *  - prev7dSubmissions: submissions in the 7 days before that — for total trend
 *  - totalWidgets: active widget count (now)
 *  - prevTotalWidgets: active widget count 7 days ago (for widget delta)
 *  - statusBreakdown: { PENDING, ENRICHED, STORED, FAILED } — all-time
 *  - last7dEnriched: ENRICHED count in last 7 days — for enrichment trend
 *  - prev7dEnriched: ENRICHED count in prev 7 days — for enrichment trend
 *  - last7dTotal: total submissions in last 7 days (denominator for rate)
 *  - prev7dTotal: total submissions in prev 7 days (denominator for rate)
 *  - byWidget: [{ widgetId, widgetName, count }] sorted desc
 *
 * @param {string} tenantId
 * @returns {Promise<object>}
 */
export async function getDashboardStats(tenantId) {
  const now = new Date();

  // ── Time boundaries ────────────────────────────────────────────────────────
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const fourteenDaysAgo = new Date(todayStart);
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

  const [
    totalSubmissions,
    todaySubmissions,
    yesterdaySubmissions,
    last7dSubmissions,
    prev7dSubmissions,
    totalWidgets,
    prevTotalWidgets,
    statusGroups,
    last7dStatusGroups,
    prev7dStatusGroups,
    widgetGroups,
  ] = await prisma.$transaction([
    // All-time total
    prisma.submission.count({ where: { tenantId } }),

    // Today (UTC midnight → now)
    prisma.submission.count({
      where: { tenantId, createdAt: { gte: todayStart } },
    }),

    // Yesterday (UTC midnight to today midnight)
    prisma.submission.count({
      where: { tenantId, createdAt: { gte: yesterdayStart, lt: todayStart } },
    }),

    // Last 7 days (for total trend)
    prisma.submission.count({
      where: { tenantId, createdAt: { gte: sevenDaysAgo } },
    }),

    // Prior 7 days / 8–14 days ago (for total trend comparison)
    prisma.submission.count({
      where: { tenantId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),

    // Active widgets now
    prisma.widget.count({ where: { tenantId, isActive: true } }),

    // Active widgets created before 7 days ago (proxy for "count 7 days ago")
    prisma.widget.count({
      where: { tenantId, isActive: true, createdAt: { lt: sevenDaysAgo } },
    }),

    // All-time status breakdown
    prisma.submission.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { status: true },
    }),

    // Last 7 days status breakdown (for enrichment rate trend)
    prisma.submission.groupBy({
      by: ['status'],
      where: { tenantId, createdAt: { gte: sevenDaysAgo } },
      _count: { status: true },
    }),

    // Prev 7 days status breakdown (for enrichment rate comparison)
    prisma.submission.groupBy({
      by: ['status'],
      where: { tenantId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
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

  // ── Compute status breakdowns ──────────────────────────────────────────────
  const statusBreakdown = { PENDING: 0, ENRICHED: 0, STORED: 0, FAILED: 0 };
  for (const group of statusGroups) {
    statusBreakdown[group.status] = group._count.status;
  }

  const last7dEnriched = last7dStatusGroups.find((g) => g.status === 'ENRICHED')?._count.status ?? 0;
  const prev7dEnriched = prev7dStatusGroups.find((g) => g.status === 'ENRICHED')?._count.status ?? 0;

  // ── Widget delta ───────────────────────────────────────────────────────────
  // Widgets added in the last 7 days = current count - count that existed 7d ago
  const widgetDelta = totalWidgets - prevTotalWidgets;

  const byWidget = widgetGroups.map((g) => ({
    widgetId: g.widgetId,
    widgetName: widgetMap[g.widgetId]?.name ?? 'Unknown',
    widgetType: widgetMap[g.widgetId]?.type ?? 'UNKNOWN',
    count: g._count.widgetId,
  }));

  return {
    totalSubmissions,
    todaySubmissions,
    yesterdaySubmissions,
    last7dSubmissions,
    prev7dSubmissions,
    totalWidgets,
    widgetDelta,
    statusBreakdown,
    last7dEnriched,
    prev7dEnriched,
    last7dSubmissions,
    prev7dSubmissions,
    byWidget,
  };
}


/**
 * Get per-day submission counts for the last `days` days (default 7).
 *
 * Returns an array ordered oldest → newest:
 *   [{ date: 'Mon Aug 03', count: 5 }, ...]
 *
 * @param {string} tenantId
 * @param {number} days
 * @returns {Promise<Array<{ date: string, count: number, isoDate: string }>>}
 */
export async function getDailySubmissions(tenantId, days = 7) {
  // Build array of day boundaries (UTC midnight) from oldest to today
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.push(d);
  }

  // Fetch all submissions in the window in a single query
  const since = buckets[0];
  const rows = await prisma.submission.findMany({
    where: { tenantId, createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Count submissions per day bucket
  const result = buckets.map((bucketStart, idx) => {
    const bucketEnd = idx < buckets.length - 1 ? buckets[idx + 1] : new Date(8640000000000000);
    const count = rows.filter(
      (r) => r.createdAt >= bucketStart && r.createdAt < bucketEnd
    ).length;

    // Format: "Mon Aug 03"
    const label = bucketStart.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      timeZone: 'UTC',
    });

    return {
      date: label,
      count,
      isoDate: bucketStart.toISOString().slice(0, 10),
    };
  });

  return result;
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
