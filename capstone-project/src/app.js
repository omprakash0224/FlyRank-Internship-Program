import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { healthRouter } from './routes/health.js';
import { adminRouter, authRouter } from './routes/admin/index.js';
import { publicRouter } from './routes/public/index.js';
import { requireAuth } from './middleware/auth.js';
import { attachTenant } from './middleware/tenant.js';
import { errorHandler } from './utils/errors.js';
import { logger } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Factory function that creates and configures the Express app.
 * Separating app creation from server startup allows Supertest to
 * import the app without binding to a port.
 *
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express();

  // ─── Static Assets ────────────────────────────────────────────────────────────
  // Serve public/ so GET /widget.js (and any hashed build artefacts) work.
  // index: false prevents Express from serving a directory listing or index page.
  app.use(
    express.static(join(__dirname, '..', 'public'), {
      index: false,
      maxAge: '1h',
      setHeaders(res, filePath) {
        // widget.js is cache-busted via filename hash in prod builds;
        // for the development source file use a shorter cache.
        if (filePath.endsWith('widget.js')) {
          res.setHeader('Cache-Control', 'public, max-age=60');
        }
      },
    })
  );

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

  // Public API — unauthenticated, CORS-enabled (widgets + submissions)
  // CORS is applied per-route inside publicRouter, not globally,
  // so admin routes are unaffected.
  app.use('/', publicRouter);

  // Public auth routes — login and register (no JWT required)
  app.use('/api/auth', authRouter);

  // Admin API — all routes require a valid JWT + tenant record
  app.use('/api', requireAuth, attachTenant, adminRouter);

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
