import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { issueToken } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const authRouter = Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
//
// Exchange email + password (or apiKey) for a signed JWT.
// Supports two auth modes:
//   1. { email, password }  — email/password login
//   2. { apiKey }           — API key login (machine-to-machine)
//
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password, apiKey } = req.body ?? {};

    let tenant = null;

    if (apiKey) {
      // API key mode — simple lookup, no password check
      tenant = await prisma.tenant.findUnique({ where: { apiKey } });
      if (!tenant) {
        logger.warn({ apiKey: apiKey.slice(0, 8) + '…' }, 'Login attempt with unknown apiKey');
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
        });
      }
    } else if (email && password) {
      // Email + password mode
      tenant = await prisma.tenant.findUnique({ where: { email } });
      if (!tenant) {
        logger.warn({ email }, 'Login attempt with unknown email');
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        });
      }

      const passwordValid = await bcrypt.compare(password, tenant.passwordHash);
      if (!passwordValid) {
        logger.warn({ email }, 'Login attempt with wrong password');
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        });
      }
    } else {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Provide either { email, password } or { apiKey }',
        },
      });
    }

    const token = issueToken(tenant.id);
    logger.info({ tenantId: tenant.id }, 'Tenant logged in');

    res.json({
      data: {
        token,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
        },
      },
    });
  })
);

// ─── POST /api/auth/register ──────────────────────────────────────────────────
//
// Register a new tenant account (email + password).
// Returns the same shape as /login.
//
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body ?? {};

    if (!name || !email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name, email and password are required',
        },
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 8 characters',
        },
      });
    }

    const existing = await prisma.tenant.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'Email already registered' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const tenant = await prisma.tenant.create({
      data: { name, email, passwordHash },
    });

    const token = issueToken(tenant.id);
    logger.info({ tenantId: tenant.id, email }, 'New tenant registered');

    res.status(201).json({
      data: {
        token,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
        },
      },
    });
  })
);
