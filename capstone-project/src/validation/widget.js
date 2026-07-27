import { z } from 'zod';
import { ValidationError } from '../utils/errors.js';

// ─── Sub-Schemas ──────────────────────────────────────────────────────────────

/**
 * A single form field definition inside the widget config.
 */
const fieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['text', 'email', 'tel', 'number', 'textarea', 'select', 'checkbox']),
  label: z.string().min(1),
  required: z.boolean().optional().default(false),
  /** Allowed options for 'select' fields */
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
});

/**
 * Copy / text content for the widget UI.
 */
const copySchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  button: z.string().optional().default('Submit'),
  success: z.string().optional().default('Thank you!'),
  error: z.string().optional(),
});

/**
 * Visual styling overrides.
 */
const stylingSchema = z.object({
  theme: z.enum(['light', 'dark']).optional().default('light'),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/, 'Must be a valid hex color')
    .optional()
    .default('#3b82f6'),
  borderRadius: z.string().optional(),
  fontFamily: z.string().optional(),
});

/**
 * Optional display targeting rules.
 */
const targetingSchema = z
  .object({
    delay: z.number().int().nonnegative().optional(),
    scrollPercent: z.number().min(0).max(100).optional(),
    exitIntent: z.boolean().optional(),
    urlPatterns: z.array(z.string()).optional(),
    frequency: z.enum(['always', 'once', 'session']).optional(),
  })
  .optional();

/**
 * Full widget config object — combines fields, copy, styling, and targeting.
 */
const configSchema = z.object({
  fields: z.array(fieldSchema).min(1, 'Widget must have at least one field'),
  copy: copySchema.optional().default({}),
  styling: stylingSchema.optional().default({}),
  targeting: targetingSchema,
});

// ─── Request Body Schemas ─────────────────────────────────────────────────────

export const createWidgetSchema = z.object({
  name: z
    .string()
    .min(1, 'Widget name is required')
    .max(100, 'Widget name must be 100 characters or fewer'),
  type: z.enum(['POPOVER', 'SIGNUP_FORM', 'CTA'], {
    errorMap: () => ({ message: 'type must be POPOVER, SIGNUP_FORM, or CTA' }),
  }),
  config: configSchema,
});

/**
 * All fields optional for PATCH — the service layer merges with the existing record.
 */
export const updateWidgetSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    type: z.enum(['POPOVER', 'SIGNUP_FORM', 'CTA']).optional(),
    config: configSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for an update',
  });

/**
 * Query string schema for pagination.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// ─── Middleware Factory ───────────────────────────────────────────────────────

/**
 * Returns an Express middleware that validates req.body against a Zod schema.
 * On failure, throws a ValidationError with Zod issue details.
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
    // Replace req.body with coerced / defaulted output
    req.body = result.data;
    next();
  };
}

/**
 * Returns an Express middleware that validates req.query against a Zod schema.
 *
 * @param {z.ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
export function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ValidationError('Invalid query parameters', details));
    }
    req.query = result.data;
    next();
  };
}
