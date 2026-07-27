import { Router } from 'express';
import * as widgetService from '../../services/widget.js';
import {
  createWidgetSchema,
  updateWidgetSchema,
  paginationSchema,
  validateBody,
  validateQuery,
} from '../../validation/widget.js';
import { asyncHandler } from '../../utils/errors.js';

export const widgetsRouter = Router();

// ─── POST /widgets ────────────────────────────────────────────────────────────

/**
 * Create a new widget for the authenticated tenant.
 * Returns 201 with the created widget object.
 */
widgetsRouter.post(
  '/',
  validateBody(createWidgetSchema),
  asyncHandler(async (req, res) => {
    const widget = await widgetService.createWidget(req.tenantId, req.body);
    res.status(201).json({ data: widget });
  })
);

// ─── GET /widgets ─────────────────────────────────────────────────────────────

/**
 * List all active widgets for the authenticated tenant, with pagination.
 * Query params: page (default 1), limit (default 20, max 100)
 */
widgetsRouter.get(
  '/',
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const result = await widgetService.listWidgets(req.tenantId, page, limit);
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

// ─── GET /widgets/:id ─────────────────────────────────────────────────────────

/**
 * Get a single widget by ID.
 * Returns 404 if not found, 403 if owned by a different tenant.
 */
widgetsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const widget = await widgetService.getWidget(req.params.id, req.tenantId);
    res.json({ data: widget });
  })
);

// ─── PATCH /widgets/:id ───────────────────────────────────────────────────────

/**
 * Partially update a widget.
 * Version is always incremented for cache busting regardless of what changed.
 */
widgetsRouter.patch(
  '/:id',
  validateBody(updateWidgetSchema),
  asyncHandler(async (req, res) => {
    const widget = await widgetService.updateWidget(req.params.id, req.tenantId, req.body);
    res.json({ data: widget });
  })
);

// ─── DELETE /widgets/:id ──────────────────────────────────────────────────────

/**
 * Soft-delete a widget (sets isActive = false).
 * Returns 204 No Content on success.
 */
widgetsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await widgetService.deleteWidget(req.params.id, req.tenantId);
    res.status(204).send();
  })
);

// ─── POST /widgets/:id/snippet ────────────────────────────────────────────────

/**
 * Generate and return the one-line embed snippet for a widget.
 * Returns 200 with { snippet, widgetId, version }.
 */
widgetsRouter.post(
  '/:id/snippet',
  asyncHandler(async (req, res) => {
    const result = await widgetService.generateSnippet(req.params.id, req.tenantId);
    res.json({ data: result });
  })
);
