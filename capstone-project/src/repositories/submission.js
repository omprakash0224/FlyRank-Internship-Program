import { prisma } from '../lib/prisma.js';

// ─── Submission Repository ────────────────────────────────────────────────────
//
// Pure data-access layer for the Submission model.
// No business rules, no enrichment, no side effects.
// All ownership checks and pipeline logic live in the service layer.
//

/**
 * @typedef {import('@prisma/client').Submission} Submission
 */

/**
 * Insert a new submission record with PENDING status.
 *
 * @param {{
 *   widgetId: string,
 *   tenantId: string,
 *   data: Record<string, string>,
 *   ipHash: string,
 *   userAgent?: string,
 *   referrer?: string,
 * }} data
 * @returns {Promise<Submission>}
 */
export async function createSubmission(data) {
  return prisma.submission.create({
    data: {
      widgetId: data.widgetId,
      tenantId: data.tenantId,
      data: data.data,
      ipHash: data.ipHash,
      userAgent: data.userAgent ?? null,
      referrer: data.referrer ?? null,
      status: 'PENDING',
    },
  });
}

/**
 * Update a submission's status and optionally attach enriched metadata.
 *
 * @param {string} id
 * @param {'ENRICHED' | 'STORED' | 'FAILED'} status
 * @param {Record<string, unknown>} [enriched]
 * @returns {Promise<Submission>}
 */
export async function updateSubmissionStatus(id, status, enriched) {
  return prisma.submission.update({
    where: { id },
    data: {
      status,
      ...(enriched !== undefined && { enriched }),
    },
  });
}

/**
 * Paginated list of submissions for a specific widget.
 *
 * @param {string} widgetId
 * @param {number} page  1-indexed
 * @param {number} limit
 * @returns {Promise<{ items: Submission[], total: number }>}
 */
export async function findSubmissionsByWidget(widgetId, page, limit) {
  const skip = (page - 1) * limit;
  const [items, total] = await prisma.$transaction([
    prisma.submission.findMany({
      where: { widgetId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.submission.count({ where: { widgetId } }),
  ]);
  return { items, total };
}

/**
 * Paginated list of submissions for a tenant (across all widgets).
 *
 * @param {string} tenantId
 * @param {number} page  1-indexed
 * @param {number} limit
 * @returns {Promise<{ items: Submission[], total: number }>}
 */
export async function findSubmissionsByTenant(tenantId, page, limit) {
  const skip = (page - 1) * limit;
  const [items, total] = await prisma.$transaction([
    prisma.submission.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.submission.count({ where: { tenantId } }),
  ]);
  return { items, total };
}

/**
 * Fetch a single submission by ID.
 *
 * @param {string} id
 * @returns {Promise<Submission | null>}
 */
export async function findSubmissionById(id) {
  return prisma.submission.findUnique({ where: { id } });
}

/**
 * Hard-delete a submission. For use in tests only.
 *
 * @param {string} id
 * @returns {Promise<Submission>}
 */
export async function hardDeleteSubmission(id) {
  return prisma.submission.delete({ where: { id } });
}
