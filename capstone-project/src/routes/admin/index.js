import { Router } from 'express';
import { widgetsRouter } from './widgets.js';
import { dashboardRouter } from './dashboard.js';
import { authRouter } from './auth.js';

/**
 * Admin API router.
 *
 * Mounted at /api by app.js, behind requireAuth + attachTenant middleware.
 * All sub-routes inherit the authenticated tenant context.
 */
export const adminRouter = Router();

adminRouter.use('/widgets', widgetsRouter);
adminRouter.use('/dashboard', dashboardRouter);

// Auth routes are exported separately — they are mounted WITHOUT requireAuth in app.js
export { authRouter };
