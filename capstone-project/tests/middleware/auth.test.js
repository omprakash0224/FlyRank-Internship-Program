import { describe, it, expect, vi, beforeEach } from 'vitest';
import { issueToken, verifyToken, requireAuth } from '../../src/middleware/auth.js';

// ─── issueToken / verifyToken unit tests ─────────────────────────────────────

describe('issueToken', () => {
  it('returns a non-empty JWT string', () => {
    const token = issueToken('tenant_123');
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('embeds tenantId as the "sub" claim', () => {
    const tenantId = 'tenant_abc';
    const token = issueToken(tenantId);
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe(tenantId);
  });
});

describe('verifyToken', () => {
  it('successfully decodes a valid token', () => {
    const token = issueToken('tenant_xyz');
    const payload = verifyToken(token);
    expect(payload.sub).toBe('tenant_xyz');
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it('throws UnauthorizedError for a tampered token', () => {
    const token = issueToken('tenant_1') + 'tampered';
    expect(() => verifyToken(token)).toThrowError('Invalid token');
  });

  it('throws UnauthorizedError for a completely invalid token', () => {
    expect(() => verifyToken('not.a.token')).toThrowError();
  });

  it('throws UnauthorizedError for an expired token', async () => {
    // Import jwt to sign a manually expired token
    const jwt = await import('jsonwebtoken');
    const expiredToken = jwt.default.sign(
      { sub: 'tenant_expired' },
      process.env.JWT_SECRET,
      { expiresIn: -1 } // already expired
    );
    expect(() => verifyToken(expiredToken)).toThrowError('Token has expired');
  });
});

// ─── requireAuth middleware unit tests ───────────────────────────────────────

function makeMockReqRes(headers = {}) {
  const req = { headers, path: '/test' };
  const res = {};
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAuth middleware', () => {
  it('calls next() and sets req.tenantId on a valid Bearer token', () => {
    const token = issueToken('tenant_test');
    const { req, res, next } = makeMockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(); // called with no arguments (no error)
    expect(req.tenantId).toBe('tenant_test');
  });

  it('calls next(error) with 401 when Authorization header is missing', () => {
    const { req, res, next } = makeMockReqRes({});
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('calls next(error) with 401 when header is not "Bearer <token>"', () => {
    const { req, res, next } = makeMockReqRes({ authorization: 'Basic abc123' });
    requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  it('calls next(error) with 401 when token is tampered', () => {
    const token = issueToken('tenant_t') + 'X';
    const { req, res, next } = makeMockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  it('calls next(error) with 401 for an expired token', async () => {
    const jwt = await import('jsonwebtoken');
    const expiredToken = jwt.default.sign({ sub: 'tenant_expired' }, process.env.JWT_SECRET, {
      expiresIn: -1,
    });
    const { req, res, next } = makeMockReqRes({ authorization: `Bearer ${expiredToken}` });
    requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toMatch(/expired/i);
  });
});
