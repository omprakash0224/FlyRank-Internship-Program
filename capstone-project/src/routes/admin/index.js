import { Router } from 'express';
import { widgetsRouter } from './widgets.js';

/**
 * Admin API router.
 *
 * Mounted at /api by app.js, behind requireAuth + attachTenant middleware.
 * All sub-routes inherit the authenticated tenant context.
 */
export const adminRouter = Router();

adminRouter.use('/widgets', widgetsRouter);
