import { prisma } from '../lib/prisma.js';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Tenant isolation middleware — loads the Tenant record from the database
 * using req.tenantId (set by requireAuth) and attaches it to req.tenant.
 *
 * Must be used AFTER requireAuth.
 *
 * @type {import('express').RequestHandler}
 */
export async function attachTenant(req, res, next) {
  if (!req.tenantId) {
    return next(new UnauthorizedError('Tenant ID not found on request. Ensure requireAuth runs first.'));
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        apiKey: true,
        createdAt: true,
        // Never select passwordHash — keep it off the request object
      },
    });

    if (!tenant) {
      logger.warn({ tenantId: req.tenantId }, 'Tenant not found during isolation check');
      return next(new NotFoundError('Tenant'));
    }

    req.tenant = tenant;
    logger.debug({ tenantId: tenant.id }, 'Tenant attached to request');
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Ownership guard — verifies that a resource's tenantId matches the
 * authenticated tenant. Use this in individual route handlers.
 *
 * @param {string} resourceTenantId  The tenantId field of the resource being accessed
 * @param {string} requestTenantId   req.tenantId from the authenticated request
 * @throws {ForbiddenError}
 */
export function assertOwnership(resourceTenantId, requestTenantId) {
  if (resourceTenantId !== requestTenantId) {
    throw new ForbiddenError('You do not have access to this resource');
  }
}
