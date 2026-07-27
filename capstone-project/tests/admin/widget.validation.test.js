import { describe, it, expect } from 'vitest';
import {
  createWidgetSchema,
  updateWidgetSchema,
  paginationSchema,
} from '../../src/validation/widget.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid widget body that satisfies createWidgetSchema */
const validCreateBody = {
  name: 'My Widget',
  type: 'SIGNUP_FORM',
  config: {
    fields: [{ name: 'email', type: 'email', label: 'Email Address' }],
    copy: { title: 'Subscribe', button: 'Join', success: 'Thanks!' },
    styling: { theme: 'light', primaryColor: '#6366f1' },
  },
};

function parse(schema, data) {
  return schema.safeParse(data);
}

// ─── createWidgetSchema ───────────────────────────────────────────────────────

describe('createWidgetSchema', () => {
  it('accepts a fully valid payload', () => {
    const result = parse(createWidgetSchema, validCreateBody);
    expect(result.success).toBe(true);
  });

  it('applies default values for copy and styling', () => {
    const body = {
      name: 'Minimal',
      type: 'CTA',
      config: {
        fields: [{ name: 'name', type: 'text', label: 'Full Name' }],
      },
    };
    const result = parse(createWidgetSchema, body);
    expect(result.success).toBe(true);
    expect(result.data.config.copy.button).toBe('Submit');
    expect(result.data.config.styling.theme).toBe('light');
    expect(result.data.config.styling.primaryColor).toBe('#3b82f6');
  });

  it('rejects a missing name', () => {
    const { name: _, ...body } = validCreateBody;
    const result = parse(createWidgetSchema, body);
    expect(result.success).toBe(false);
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('name');
  });

  it('rejects an empty name string', () => {
    const result = parse(createWidgetSchema, { ...validCreateBody, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 100 characters', () => {
    const result = parse(createWidgetSchema, { ...validCreateBody, name: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid widget type', () => {
    const result = parse(createWidgetSchema, { ...validCreateBody, type: 'BANNER' });
    expect(result.success).toBe(false);
    const messages = result.error.issues.map((i) => i.message);
    expect(messages.some((m) => m.includes('POPOVER'))).toBe(true);
  });

  it('rejects a missing type', () => {
    const { type: _, ...body } = validCreateBody;
    const result = parse(createWidgetSchema, body);
    expect(result.success).toBe(false);
  });

  it('rejects config with zero fields', () => {
    const body = { ...validCreateBody, config: { ...validCreateBody.config, fields: [] } };
    const result = parse(createWidgetSchema, body);
    expect(result.success).toBe(false);
  });

  it('rejects a field with an invalid type', () => {
    const body = {
      ...validCreateBody,
      config: {
        ...validCreateBody.config,
        fields: [{ name: 'bad', type: 'file', label: 'Upload' }],
      },
    };
    const result = parse(createWidgetSchema, body);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid hex color in styling', () => {
    const body = {
      ...validCreateBody,
      config: {
        ...validCreateBody.config,
        styling: { primaryColor: 'not-a-color' },
      },
    };
    const result = parse(createWidgetSchema, body);
    expect(result.success).toBe(false);
  });

  it('accepts all three valid widget types', () => {
    for (const type of ['POPOVER', 'SIGNUP_FORM', 'CTA']) {
      const result = parse(createWidgetSchema, { ...validCreateBody, type });
      expect(result.success).toBe(true);
    }
  });

  it('accepts optional targeting rules', () => {
    const body = {
      ...validCreateBody,
      config: {
        ...validCreateBody.config,
        targeting: { delay: 2000, exitIntent: true, frequency: 'once' },
      },
    };
    const result = parse(createWidgetSchema, body);
    expect(result.success).toBe(true);
  });
});

// ─── updateWidgetSchema ───────────────────────────────────────────────────────

describe('updateWidgetSchema', () => {
  it('accepts a partial update with only name', () => {
    const result = parse(updateWidgetSchema, { name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts a partial update with only isActive', () => {
    const result = parse(updateWidgetSchema, { isActive: false });
    expect(result.success).toBe(true);
  });

  it('rejects a completely empty object', () => {
    const result = parse(updateWidgetSchema, {});
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toMatch(/at least one field/i);
  });

  it('accepts a full update matching the create schema shape', () => {
    const result = parse(updateWidgetSchema, {
      name: 'Updated Widget',
      type: 'POPOVER',
      config: validCreateBody.config,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid type enum value', () => {
    const result = parse(updateWidgetSchema, { type: 'INVALID' });
    expect(result.success).toBe(false);
  });
});

// ─── paginationSchema ─────────────────────────────────────────────────────────

describe('paginationSchema', () => {
  it('applies defaults when no query params are supplied', () => {
    const result = parse(paginationSchema, {});
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
    expect(result.data.limit).toBe(20);
  });

  it('coerces string query params to numbers', () => {
    const result = parse(paginationSchema, { page: '3', limit: '50' });
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(3);
    expect(result.data.limit).toBe(50);
  });

  it('rejects limit > 100', () => {
    const result = parse(paginationSchema, { limit: '101' });
    expect(result.success).toBe(false);
  });

  it('rejects page < 1', () => {
    const result = parse(paginationSchema, { page: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric values', () => {
    const result = parse(paginationSchema, { page: 'abc' });
    expect(result.success).toBe(false);
  });
});
