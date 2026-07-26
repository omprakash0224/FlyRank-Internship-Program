/**
 * Custom error classes and the global Express error handler.
 *
 * All custom errors extend AppError, which carries an HTTP status code
 * and an optional machine-readable error code for clients.
 */

// ─── Base Error ───────────────────────────────────────────────────────────────

export class AppError extends Error {
  /**
   * @param {string} message  Human-readable error message
   * @param {number} statusCode  HTTP status code
   * @param {string} [code]  Machine-readable error code (e.g. "WIDGET_NOT_FOUND")
   * @param {boolean} [isOperational]  true = expected error; false = programming bug
   */
  constructor(message, statusCode, code, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code ?? 'INTERNAL_ERROR';
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Specific Error Types ─────────────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  /**
   * @param {string} message
   * @param {unknown[]} [details]  Zod issues or field-level errors
   */
  constructor(message = 'Validation failed', details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMITED');
  }
}

// ─── Global Error Handler Middleware ─────────────────────────────────────────

import { logger } from './logger.js';

/**
 * Express error-handling middleware.
 * Must be registered LAST with app.use(errorHandler).
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, req, res, _next) {
  // Operational errors: expected failures (validation, not found, etc.)
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, req }, `Operational error: ${err.message}`);
    } else {
      logger.warn({ err, path: req.path, method: req.method }, `Client error: ${err.message}`);
    }

    const body = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    // Include validation details if present
    if (err instanceof ValidationError && err.details?.length > 0) {
      body.error.details = err.details;
    }

    return res.status(err.statusCode).json(body);
  }

  // Prisma known request errors (e.g. unique constraint violations)
  if (err.code === 'P2002') {
    logger.warn({ err }, 'Prisma unique constraint violation');
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A resource with this value already exists',
      },
    });
  }

  if (err.code === 'P2025') {
    logger.warn({ err }, 'Prisma record not found');
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  }

  // Unexpected / programming errors — do not leak details to client
  logger.error({ err, req }, 'Unexpected error');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Catch async route handler errors and forward them to Express error handler.
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 *
 * @param {import('express').RequestHandler} fn
 * @returns {import('express').RequestHandler}
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
