import pino from 'pino';

/**
 * Structured logger using Pino.
 * - Development: pretty-printed, colorized output via pino-pretty
 * - Production:  NDJSON (newline-delimited JSON) for log aggregators
 *
 * pino-pretty is guarded behind a NODE_ENV check so bundlers (esbuild,
 * wrangler) can tree-shake it when building for Cloudflare Workers.
 */

// Explicitly assign transport to undefined in production so esbuild does
// not attempt to bundle pino-pretty into the Workers bundle.
const transport =
  process.env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
        },
      }
    : undefined;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport,
  // Base fields added to every log line
  base: {
    service: 'widget-platform',
    env: process.env.NODE_ENV ?? 'development',
  },
  // Redact sensitive fields from logs
  redact: {
    paths: ['req.headers.authorization', 'body.password', 'body.passwordHash'],
    censor: '[REDACTED]',
  },
  // Serialize HTTP request/response objects
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});

/**
 * Create a child logger with additional bound fields.
 * Useful for attaching request IDs, tenant IDs, etc.
 *
 * @param {Record<string, unknown>} bindings
 * @returns {pino.Logger}
 */
export function createChildLogger(bindings) {
  return logger.child(bindings);
}
