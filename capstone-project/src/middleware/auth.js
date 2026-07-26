import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

// ─── Token Issuance ───────────────────────────────────────────────────────────

/**
 * Issue a signed JWT for a tenant.
 *
 * @param {string} tenantId  The tenant's database ID (cuid)
 * @returns {string}  Signed JWT string
 */
export function issueToken(tenantId) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.sign({ sub: tenantId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

/**
 * Verify a JWT and return its decoded payload.
 *
 * @param {string} token
 * @returns {{ sub: string, iat: number, exp: number }}
 * @throws {UnauthorizedError}
 */
export function verifyToken(token) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token has expired');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Invalid token');
    }
    throw new UnauthorizedError('Authentication failed');
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Express middleware — validates the Bearer token in the Authorization header
 * and attaches the decoded tenantId to req.tenantId.
 *
 * On failure: returns 401 Unauthorized.
 * On success: calls next().
 *
 * @type {import('express').RequestHandler}
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.debug({ path: req.path }, 'Missing Authorization header');
    return next(new UnauthorizedError('Authorization header is required'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return next(new UnauthorizedError('Authorization header must be "Bearer <token>"'));
  }

  const token = parts[1];

  try {
    const payload = verifyToken(token);
    req.tenantId = payload.sub;
    logger.debug({ tenantId: req.tenantId, path: req.path }, 'Auth passed');
    next();
  } catch (err) {
    next(err);
  }
}
