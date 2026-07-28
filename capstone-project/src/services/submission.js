import crypto from 'crypto';
import * as submissionRepo from '../repositories/submission.js';
import * as widgetRepo from '../repositories/widget.js';
import { checkRateLimit } from '../lib/rate-limiter.js';
import { checkSpam } from '../lib/spam-filter.js';
import { enrichIp, parseUserAgent } from './enrichment.js';
import { triggerSideEffects } from '../lib/side-effects.js';
import { NotFoundError, TooManyRequestsError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// ─── Submission Service ───────────────────────────────────────────────────────
//
// Orchestrates the full public submission pipeline:
//
//   1. Validate the target widget exists and is active
//   2. Hash the visitor IP (SHA-256, privacy-preserving)
//   3. Check rate limit (Redis, per IP per widget)
//   4. Check spam (honeypot + heuristics)
//   5. Store submission with PENDING status
//   6. Fire-and-forget: enrich → update record; trigger side effects
//   7. Return 202 Accepted with submissionId
//

/**
 * Hash an IP address with SHA-256.
 * We never store the raw IP — the hash is sufficient for rate limiting
 * and is privacy-respecting (non-reversible without the original IP).
 *
 * @param {string} ip
 * @returns {string}  64-char hex digest
 */
function hashIp(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

/**
 * Extract the visitor's real IP from the request.
 * Prefers X-Forwarded-For (set by reverse proxies) over socket remoteAddress.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
export function extractIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can contain a comma-separated list; take the first (leftmost)
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? '0.0.0.0';
}

/**
 * Process a public form submission through the full pipeline.
 *
 * On spam detection: returns a fake success (200) so bots get no feedback.
 * On rate limit: throws TooManyRequestsError → 429.
 * On success: stores submission, fires enrichment + side effects, returns 202.
 *
 * @param {{
 *   widgetId: string,
 *   data: Record<string, string>,
 *   website?: string,
 *   referrer?: string,
 * }} body  Validated request body
 * @param {import('express').Request} req  Used to extract IP and UA
 * @returns {Promise<{ submissionId: string, spam: boolean }>}
 */
export async function processSubmission(body, req) {
  const { widgetId, data, website, referrer } = body;

  // ── Step 1: Verify widget exists and is active ──────────────────────────────
  const widget = await widgetRepo.findWidgetById(widgetId);
  if (!widget || !widget.isActive) {
    throw new NotFoundError('Widget');
  }

  // ── Step 2: Hash visitor IP ─────────────────────────────────────────────────
  const rawIp = extractIp(req);
  const ipHash = hashIp(rawIp);

  // ── Step 3: Rate limit check ────────────────────────────────────────────────
  const rateLimit = await checkRateLimit(widgetId, ipHash);
  if (!rateLimit.allowed) {
    logger.warn({ widgetId, ipHash }, 'Rate limit exceeded for submission');
    throw new TooManyRequestsError('Too many submissions. Please try again later.');
  }

  // ── Step 4: Spam check ──────────────────────────────────────────────────────
  const spamResult = checkSpam({ website, data });
  if (spamResult.isSpam) {
    // Silent accept — don't store, don't inform the bot
    logger.info({ widgetId, reason: spamResult.reason }, 'Spam submission silently rejected');
    return { submissionId: null, spam: true };
  }

  // ── Step 5: Store with PENDING status ───────────────────────────────────────
  const userAgent = req.headers['user-agent'];
  const submission = await submissionRepo.createSubmission({
    widgetId,
    tenantId: widget.tenantId,
    data,
    ipHash,
    userAgent: userAgent ?? null,
    referrer: referrer ?? null,
  });

  logger.info({ submissionId: submission.id, widgetId }, 'Submission stored (PENDING)');

  // ── Step 6: Fire-and-forget enrichment ─────────────────────────────────────
  // We enrich AFTER responding — never block the 202 on external calls.
  enrichSubmissionAsync(submission.id, rawIp, userAgent);

  // ── Step 7: Fire-and-forget side effects ────────────────────────────────────
  triggerSideEffects({
    submissionId: submission.id,
    widgetId: submission.widgetId,
    tenantId: submission.tenantId,
    data: submission.data,
  });

  return { submissionId: submission.id, spam: false };
}

/**
 * Asynchronously enrich a stored submission and update its record.
 * Errors are caught and logged — they must never surface to the client.
 *
 * @param {string} submissionId
 * @param {string} rawIp
 * @param {string | undefined} userAgent
 * @returns {void}  (fire-and-forget)
 */
function enrichSubmissionAsync(submissionId, rawIp, userAgent) {
  Promise.resolve()
    .then(async () => {
      const geo = await enrichIp(rawIp);
      const ua = parseUserAgent(userAgent);
      await submissionRepo.updateSubmissionStatus(submissionId, 'ENRICHED', {
        geo,
        userAgent: ua,
        enrichedAt: new Date().toISOString(),
      });
      logger.info({ submissionId, provider: geo.provider }, 'Submission enriched');
    })
    .catch((err) => {
      logger.error({ err, submissionId }, 'Async enrichment failed — submission stays PENDING');
    });
}
