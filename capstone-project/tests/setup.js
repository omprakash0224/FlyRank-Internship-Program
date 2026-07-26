/**
 * tests/setup.js
 *
 * Global test setup file loaded by Vitest before all test suites.
 * Sets required environment variables for tests that don't touch real services.
 */

// Ensure a JWT_SECRET is available in all tests
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-at-least-64-chars-padding-padding';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

// Stub Upstash env vars so the redis module can be imported without erroring
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
