import { Router } from 'express';
import { processSubmission } from '../../services/submission.js';
import { submissionSchema, validateBody } from '../../validation/submission.js';
import { asyncHandler } from '../../utils/errors.js';
import { publicCors } from '../../middleware/cors.js';

export const submissionsRouter = Router();

// ─── OPTIONS /submissions (CORS preflight) ────────────────────────────────────
//
// Browsers send a preflight OPTIONS before the actual POST.
// The cors() middleware sets the required headers; we just need the 204.
//

submissionsRouter.options('/', publicCors, (_req, res) => res.status(204).send());

// ─── POST /submissions ────────────────────────────────────────────────────────
//
// Public endpoint — no authentication required.
// Full pipeline: validate → rate-limit → spam-check → store → enrich (async).
// Always returns 202 Accepted on success (enrichment is asynchronous).
// Spam submissions also return 200 to avoid giving bots feedback.
//

submissionsRouter.post(
  '/',
  publicCors,
  validateBody(submissionSchema),
  asyncHandler(async (req, res) => {
    const result = await processSubmission(req.body, req);

    if (result.spam) {
      // Silent accept — same response shape so bots can't distinguish
      return res.status(200).json({
        message: 'Submission received',
      });
    }

    return res.status(202).json({
      message: 'Submission received and is being processed',
      submissionId: result.submissionId,
    });
  })
);
