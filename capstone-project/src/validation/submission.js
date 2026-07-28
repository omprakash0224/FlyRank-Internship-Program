import { z } from 'zod';
import { ValidationError } from '../utils/errors.js';

// ─── Submission Validation ─────────────────────────────────────────────────────
//
// Strict schema for POST /submissions from external (unauthenticated) callers.
// Every boundary we enforce here prevents abuse downstream.
//

/**
 * Individual form field value — must be a string (coerced from the JSON body).
 * Cap each value at 1 000 characters to prevent large-payload abuse.
 */
const formValueSchema = z.string().max(1000, 'Each field value must be ≤ 1 000 characters');

/**
 * Main schema for the POST /submissions body.
 *
 * Fields:
 *   widgetId  — required; the target widget
 *   data      — key/value form data (max 50 keys)
 *   website   — honeypot: browsers won't fill hidden fields; bots often do
 *   referrer  — optional page URL the form was submitted from
 */
export const submissionSchema = z.object({
  widgetId: z
    .string({ required_error: 'widgetId is required' })
    .min(1, 'widgetId cannot be empty'),

  data: z
    .record(formValueSchema)
    .refine((d) => Object.keys(d).length >= 1, 'data must have at least one field')
    .refine(
      (d) => Object.keys(d).length <= 50,
      'data must not exceed 50 fields'
    ),

  // Honeypot — present in schema so Zod doesn't strip it, but never stored
  website: z.string().optional(),

  referrer: z.string().max(2000).optional(),
});

// ─── Middleware Factory ────────────────────────────────────────────────────────
// Re-exported so public routes can use the same pattern as admin routes.

/**
 * Returns an Express middleware that validates req.body against a Zod schema.
 * On failure, throws a ValidationError with field-level details.
 *
 * @param {z.ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ValidationError('Validation failed', details));
    }
    req.body = result.data;
    next();
  };
}
