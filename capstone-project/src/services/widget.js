import * as widgetRepo from '../repositories/widget.js';
import { assertOwnership } from '../middleware/tenant.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// ─── Widget Service ───────────────────────────────────────────────────────────
//
// Business logic layer. Enforces tenant ownership, version bumping,
// and snippet generation. Delegates all DB access to the repository.
//

/**
 * Create a new widget owned by the given tenant.
 *
 * @param {string} tenantId
 * @param {{ name: string, type: string, config: object }} dto
 * @returns {Promise<import('@prisma/client').Widget>}
 */
export async function createWidget(tenantId, dto) {
  const widget = await widgetRepo.createWidget(tenantId, dto);
  logger.info({ widgetId: widget.id, tenantId }, 'Widget created');
  return widget;
}

/**
 * Fetch a single widget, asserting the requesting tenant owns it.
 *
 * @param {string} id
 * @param {string} tenantId  The authenticated tenant's ID
 * @throws {NotFoundError}  If the widget does not exist
 * @throws {ForbiddenError} If the widget belongs to a different tenant
 * @returns {Promise<import('@prisma/client').Widget>}
 */
export async function getWidget(id, tenantId) {
  const widget = await widgetRepo.findWidgetById(id);
  if (!widget) {
    throw new NotFoundError('Widget');
  }
  assertOwnership(widget.tenantId, tenantId);
  return widget;
}

/**
 * List active widgets for the given tenant with pagination.
 *
 * @param {string} tenantId
 * @param {number} page  1-indexed page
 * @param {number} limit  Items per page (max 100)
 * @returns {Promise<{ items: import('@prisma/client').Widget[], total: number, page: number, limit: number }>}
 */
export async function listWidgets(tenantId, page, limit) {
  const { items, total } = await widgetRepo.findWidgetsByTenant(tenantId, page, limit);
  return { items, total, page, limit };
}

/**
 * Partially update a widget, automatically incrementing its version for cache busting.
 * Only the supplied fields are changed; `version` is always incremented.
 *
 * @param {string} id
 * @param {string} tenantId  The authenticated tenant's ID
 * @param {Partial<{ name: string, type: string, config: object, isActive: boolean }>} dto
 * @throws {NotFoundError}  If the widget does not exist
 * @throws {ForbiddenError} If the widget belongs to a different tenant
 * @returns {Promise<import('@prisma/client').Widget>}
 */
export async function updateWidget(id, tenantId, dto) {
  // Load and verify ownership before mutating
  const existing = await widgetRepo.findWidgetById(id);
  if (!existing) {
    throw new NotFoundError('Widget');
  }
  assertOwnership(existing.tenantId, tenantId);

  const updated = await widgetRepo.updateWidget(id, {
    ...dto,
    // Always bump the version so CDN cache keys are invalidated
    version: existing.version + 1,
  });

  logger.info({ widgetId: id, version: updated.version, tenantId }, 'Widget updated');
  return updated;
}

/**
 * Soft-delete a widget (sets isActive = false).
 * The widget record is retained for submission history integrity.
 *
 * @param {string} id
 * @param {string} tenantId
 * @throws {NotFoundError}  If the widget does not exist
 * @throws {ForbiddenError} If the widget belongs to a different tenant
 * @returns {Promise<void>}
 */
export async function deleteWidget(id, tenantId) {
  const existing = await widgetRepo.findWidgetById(id);
  if (!existing) {
    throw new NotFoundError('Widget');
  }
  assertOwnership(existing.tenantId, tenantId);
  await widgetRepo.softDeleteWidget(id);
  logger.info({ widgetId: id, tenantId }, 'Widget soft-deleted');
}

/**
 * Generate the one-line embed snippet for a widget.
 *
 * The snippet is a <script> tag that loads the platform's widget.js loader
 * and targets this specific widget via the `data-widget-id` attribute.
 *
 * @param {string} id
 * @param {string} tenantId
 * @throws {NotFoundError}  If the widget does not exist
 * @throws {ForbiddenError} If the widget belongs to a different tenant
 * @returns {Promise<{ snippet: string, widgetId: string, version: number }>}
 */
export async function generateSnippet(id, tenantId) {
  const widget = await getWidget(id, tenantId);

  const baseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const snippet =
    `<script src="${baseUrl}/widget.js" ` +
    `data-widget-id="${widget.id}" ` +
    `async defer></script>`;

  logger.info({ widgetId: id, tenantId }, 'Snippet generated');
  return { snippet, widgetId: widget.id, version: widget.version };
}
