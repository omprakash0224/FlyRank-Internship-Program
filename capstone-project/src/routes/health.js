import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { pingRedis } from '../lib/redis.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /health
 *
 * Returns the operational status of the service and its dependencies.
 * Used by Docker health checks, load balancers, and monitoring tools.
 *
 * Response 200: All systems healthy
 * Response 503: One or more dependencies are down
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const start = Date.now();

    // Check database connectivity
    let dbStatus = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      logger.error({ err }, 'Health check: DB ping failed');
      dbStatus = 'error';
    }

    // Check Redis connectivity
    let redisStatus = 'ok';
    try {
      const pong = await pingRedis();
      if (!pong) {
        redisStatus = 'error';
      }
    } catch (err) {
      logger.error({ err }, 'Health check: Redis ping failed');
      redisStatus = 'error';
    }

    const isHealthy = dbStatus === 'ok' && redisStatus === 'ok';
    const statusCode = isHealthy ? 200 : 503;
    const latencyMs = Date.now() - start;

    const body = {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: Math.floor(process.uptime()),
      latencyMs,
      dependencies: {
        database: dbStatus,
        redis: redisStatus,
      },
    };

    logger.debug(body, 'Health check completed');
    res.status(statusCode).json(body);
  })
);

export { router as healthRouter };
