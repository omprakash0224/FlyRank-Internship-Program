import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Structured logger using Pino.
 * - Development: pretty-printed, colorized output
 * - Production: NDJSON (newline-delimited JSON) for log aggregators
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // In development, use pino-pretty for human-readable output
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      },
    },
  }),
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
