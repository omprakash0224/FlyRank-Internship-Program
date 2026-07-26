import 'dotenv/config';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { prisma } from './lib/prisma.js';

const PORT = process.env.PORT ?? 3000;

async function main() {
  // With Neon's HTTP driver adapter, connections are made per-query over fetch.
  // There is no persistent connection to verify on startup — $connect() is a no-op.
  // The first actual query (e.g. GET /health) will confirm DB reachability.
  logger.info('Using Neon serverless HTTP driver (queries via fetch)');

  const app = createApp();

  const server = app.listen(PORT, () => {
    logger.info(
      {
        port: PORT,
        env: process.env.NODE_ENV ?? 'development',
        pid: process.pid,
      },
      `Server listening on http://localhost:${PORT}`
    );
  });

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async () => {
      logger.info('HTTP server closed');
      await prisma.$disconnect();
      logger.info('Database connection closed');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions — log and exit (let process manager restart)
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection — shutting down');
    process.exit(1);
  });
}

main();
