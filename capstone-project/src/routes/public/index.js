import { Router } from 'express';
import { configRouter } from './config.js';
import { submissionsRouter } from './submissions.js';

// ─── Public Router ────────────────────────────────────────────────────────────
//
// Barrel router for all unauthenticated public endpoints:
//   GET  /widgets/:id/config  — widget configuration delivery
//   POST /submissions          — form submission capture
//   OPTIONS /submissions       — CORS preflight
//

export const publicRouter = Router();

publicRouter.use('/', configRouter);
publicRouter.use('/submissions', submissionsRouter);
