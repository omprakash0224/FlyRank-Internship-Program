import { prisma } from '../lib/prisma.js';

// ─── Widget Repository ────────────────────────────────────────────────────────
//
// Pure data-access layer. No business rules, no ownership checks.
// All tenant scoping and authorization must happen in the service layer.
//

/**
 * Create a new widget for a tenant.
 *
 * @param {string} tenantId
 * @param {{ name: string, type: string, config: object }} data
 * @returns {Promise<import('@prisma/client').Widget>}
 */
export async function createWidget(tenantId, data) {
  return prisma.widget.create({
    data: {
      tenantId,
      name: data.name,
      type: data.type,
      config: data.config,
    },
  });
}

/**
 * Fetch a single widget by its ID.
 * Returns null if not found — caller decides how to handle absence.
 *
 * @param {string} id
 * @returns {Promise<import('@prisma/client').Widget | null>}
 */
export async function findWidgetById(id) {
  return prisma.widget.findUnique({
    where: { id },
  });
}

/**
 * Paginated list of active widgets for a tenant.
 *
 * @param {string} tenantId
 * @param {number} page  1-indexed page number
 * @param {number} limit  Items per page
 * @returns {Promise<{ items: import('@prisma/client').Widget[], total: number }>}
 */
export async function findWidgetsByTenant(tenantId, page, limit) {
  const skip = (page - 1) * limit;

  const [items, total] = await prisma.$transaction([
    prisma.widget.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.widget.count({
      where: { tenantId, isActive: true },
    }),
  ]);

  return { items, total };
}

/**
 * Partially update a widget's fields.
 * Only the supplied keys are updated; others are left unchanged.
 *
 * @param {string} id
 * @param {Partial<{ name: string, type: string, config: object, isActive: boolean, version: number }>} data
 * @returns {Promise<import('@prisma/client').Widget>}
 */
export async function updateWidget(id, data) {
  return prisma.widget.update({
    where: { id },
    data,
  });
}

/**
 * Soft-delete a widget by setting isActive to false.
 * The record remains in the database for audit / submission history.
 *
 * @param {string} id
 * @returns {Promise<import('@prisma/client').Widget>}
 */
export async function softDeleteWidget(id) {
  return prisma.widget.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * Hard-delete a widget. Intended for use in tests only.
 *
 * @param {string} id
 * @returns {Promise<import('@prisma/client').Widget>}
 */
export async function hardDeleteWidget(id) {
  return prisma.widget.delete({
    where: { id },
  });
}
