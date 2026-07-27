import express from 'express';
import { healthRouter } from './routes/health.js';
import { adminRouter } from './routes/admin/index.js';
import { requireAuth } from './middleware/auth.js';
import { attachTenant } from './middleware/tenant.js';
import { errorHandler } from './utils/errors.js';
import { logger } from './utils/logger.js';

/**
 * Factory function that creates and configures the Express app.
 * Separating app creation from server startup allows Supertest to
 * import the app without binding to a port.
 *
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express();

  // ─── Request Parsing ─────────────────────────────────────────────────────
  // Limit request body to 100KB as per security requirements
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // ─── Request Logging ──────────────────────────────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[level](
        {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
        },
        `${req.method} ${req.path} ${res.statusCode}`
      );
    });
    next();
  });

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/', healthRouter);

  // Admin API — all routes require a valid JWT + tenant record
  app.use('/api', requireAuth, attachTenant, adminRouter);

  // TODO (Milestone 3): Mount public routes
  // app.use('/', publicRouter);

  // ─── 404 Handler ─────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  // ─── Global Error Handler ─────────────────────────────────────────────────
  // Must be last middleware registered
  app.use(errorHandler);

  return app;
}
