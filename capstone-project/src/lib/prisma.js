import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

/**
 * Use HTTP fetch for all pooled queries instead of a persistent WebSocket/TCP
 * connection. This is the correct mode for Neon's serverless architecture:
 * - No cold-start TCP failures (P1001)
 * - No "Connection closed" errors after autosuspend
 * - Works without the `ws` package
 */
neonConfig.poolQueryViaFetch = true;

// Prevent multiple Prisma Client instances in development (hot reload)
const globalForPrisma = globalThis;

let prisma;

if (!globalForPrisma.__prisma) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);

  prisma = new PrismaClient({
    adapter,
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
      // Omit 'query' level from events — too noisy in production
    ],
  });

  // Log slow queries in development only
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      if (e.duration > 500) {
        logger.warn({ duration: e.duration, query: e.query }, 'Slow Prisma query');
      }
    });
  }

  prisma.$on('error', (e) => {
    logger.error({ message: e.message, target: e.target }, 'Prisma error');
  });

  globalForPrisma.__prisma = prisma;
} else {
  prisma = globalForPrisma.__prisma;
}

export { prisma };
