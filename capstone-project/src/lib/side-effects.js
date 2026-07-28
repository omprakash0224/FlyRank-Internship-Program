import { logger } from '../utils/logger.js';

// ─── Safe Side Effects ────────────────────────────────────────────────────────
//
// Email and webhook notifications are "best-effort" — their failure must never
// block or fail a submission response. We use fire-and-forget: kick off the
// async work and catch any errors silently (logged, not propagated).
//
// In production, these would enqueue into a Redis list consumed by a background
// worker with retry logic. For this capstone they are mocked log-only calls.
//

/**
 * @typedef {Object} SideEffectPayload
 * @property {string} submissionId
 * @property {string} widgetId
 * @property {string} tenantId
 * @property {Record<string, string>} data  Submitted form data
 */

/**
 * Mock email confirmation to the visitor.
 * In production: calls Resend / SendGrid API.
 *
 * @param {SideEffectPayload} payload
 * @returns {Promise<void>}
 */
async function sendEmailConfirmation(payload) {
  // Simulate async work
  await Promise.resolve();
  logger.info(
    { submissionId: payload.submissionId, widgetId: payload.widgetId },
    '[side-effect] Email confirmation enqueued (mock)'
  );
}

/**
 * Mock webhook notification to the widget owner.
 * In production: HTTP POST to owner's registered webhook URL with retry queue.
 *
 * @param {SideEffectPayload} payload
 * @returns {Promise<void>}
 */
async function sendWebhook(payload) {
  await Promise.resolve();
  logger.info(
    { submissionId: payload.submissionId, tenantId: payload.tenantId },
    '[side-effect] Webhook notification enqueued (mock)'
  );
}

/**
 * Trigger all side effects for a completed submission.
 * Fire-and-forget: returns immediately, never throws.
 *
 * @param {SideEffectPayload} payload
 * @returns {void}
 */
export function triggerSideEffects(payload) {
  // Do NOT await — response has already been sent
  sendEmailConfirmation(payload).catch((err) =>
    logger.error({ err, submissionId: payload.submissionId }, 'Email side effect failed')
  );

  sendWebhook(payload).catch((err) =>
    logger.error({ err, submissionId: payload.submissionId }, 'Webhook side effect failed')
  );
}
