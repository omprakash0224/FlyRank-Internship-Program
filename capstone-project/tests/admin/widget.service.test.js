import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the repository so the service never touches the DB ──────────────────
vi.mock('../../src/repositories/widget.js', () => ({
  createWidget: vi.fn(),
  findWidgetById: vi.fn(),
  findWidgetsByTenant: vi.fn(),
  updateWidget: vi.fn(),
  softDeleteWidget: vi.fn(),
  hardDeleteWidget: vi.fn(),
}));

// Import service AFTER mocks are set up
import * as widgetRepo from '../../src/repositories/widget.js';
import * as widgetService from '../../src/services/widget.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant_aaa';
const TENANT_B = 'tenant_bbb';

const makeWidget = (overrides = {}) => ({
  id: 'widget_001',
  tenantId: TENANT_A,
  name: 'Test Widget',
  type: 'SIGNUP_FORM',
  config: {
    fields: [{ name: 'email', type: 'email', label: 'Email' }],
    copy: { button: 'Submit', success: 'Thanks!' },
    styling: { theme: 'light', primaryColor: '#3b82f6' },
  },
  version: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ─── createWidget ─────────────────────────────────────────────────────────────

describe('widgetService.createWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the repository and returns the created widget', async () => {
    const dto = { name: 'New Widget', type: 'CTA', config: {} };
    const created = makeWidget({ name: 'New Widget', type: 'CTA' });
    widgetRepo.createWidget.mockResolvedValue(created);

    const result = await widgetService.createWidget(TENANT_A, dto);

    expect(widgetRepo.createWidget).toHaveBeenCalledWith(TENANT_A, dto);
    expect(result).toEqual(created);
  });
});

// ─── getWidget ────────────────────────────────────────────────────────────────

describe('widgetService.getWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the widget when the tenant matches', async () => {
    const widget = makeWidget();
    widgetRepo.findWidgetById.mockResolvedValue(widget);

    const result = await widgetService.getWidget(widget.id, TENANT_A);
    expect(result).toEqual(widget);
  });

  it('throws NotFoundError when the widget does not exist', async () => {
    widgetRepo.findWidgetById.mockResolvedValue(null);

    await expect(widgetService.getWidget('nonexistent', TENANT_A)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('throws ForbiddenError when the widget belongs to a different tenant', async () => {
    const widget = makeWidget({ tenantId: TENANT_B }); // owned by B
    widgetRepo.findWidgetById.mockResolvedValue(widget);

    await expect(widgetService.getWidget(widget.id, TENANT_A)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });
});

// ─── listWidgets ──────────────────────────────────────────────────────────────

describe('widgetService.listWidgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated result with meta fields', async () => {
    const items = [makeWidget(), makeWidget({ id: 'widget_002' })];
    widgetRepo.findWidgetsByTenant.mockResolvedValue({ items, total: 2 });

    const result = await widgetService.listWidgets(TENANT_A, 1, 20);

    expect(result.items).toEqual(items);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});

// ─── updateWidget ─────────────────────────────────────────────────────────────

describe('widgetService.updateWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('increments the version by 1 on every update', async () => {
    const existing = makeWidget({ version: 3 });
    const updated = { ...existing, name: 'Renamed', version: 4 };
    widgetRepo.findWidgetById.mockResolvedValue(existing);
    widgetRepo.updateWidget.mockResolvedValue(updated);

    const result = await widgetService.updateWidget(existing.id, TENANT_A, { name: 'Renamed' });

    expect(widgetRepo.updateWidget).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({ version: 4 })
    );
    expect(result.version).toBe(4);
  });

  it('throws ForbiddenError when updating another tenant\'s widget', async () => {
    const widget = makeWidget({ tenantId: TENANT_B });
    widgetRepo.findWidgetById.mockResolvedValue(widget);

    await expect(
      widgetService.updateWidget(widget.id, TENANT_A, { name: 'Hacked' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws NotFoundError when the widget does not exist', async () => {
    widgetRepo.findWidgetById.mockResolvedValue(null);

    await expect(
      widgetService.updateWidget('ghost', TENANT_A, { name: 'X' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('merges only the supplied fields into the update payload', async () => {
    const existing = makeWidget({ version: 1 });
    widgetRepo.findWidgetById.mockResolvedValue(existing);
    widgetRepo.updateWidget.mockResolvedValue({ ...existing, name: 'New Name', version: 2 });

    await widgetService.updateWidget(existing.id, TENANT_A, { name: 'New Name' });

    const callArg = widgetRepo.updateWidget.mock.calls[0][1];
    expect(callArg.name).toBe('New Name');
    expect(callArg.version).toBe(2);
    // type should NOT appear in the update since it wasn't passed
    expect(callArg.type).toBeUndefined();
  });
});

// ─── deleteWidget ─────────────────────────────────────────────────────────────

describe('widgetService.deleteWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls softDeleteWidget for a valid owner', async () => {
    const widget = makeWidget();
    widgetRepo.findWidgetById.mockResolvedValue(widget);
    widgetRepo.softDeleteWidget.mockResolvedValue({ ...widget, isActive: false });

    await widgetService.deleteWidget(widget.id, TENANT_A);

    expect(widgetRepo.softDeleteWidget).toHaveBeenCalledWith(widget.id);
  });

  it('throws ForbiddenError when deleting another tenant\'s widget', async () => {
    const widget = makeWidget({ tenantId: TENANT_B });
    widgetRepo.findWidgetById.mockResolvedValue(widget);

    await expect(widgetService.deleteWidget(widget.id, TENANT_A)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(widgetRepo.softDeleteWidget).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the widget does not exist', async () => {
    widgetRepo.findWidgetById.mockResolvedValue(null);

    await expect(widgetService.deleteWidget('ghost', TENANT_A)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ─── generateSnippet ──────────────────────────────────────────────────────────

describe('widgetService.generateSnippet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a snippet string containing the widget ID', async () => {
    const widget = makeWidget({ id: 'widget_snippet_01' });
    widgetRepo.findWidgetById.mockResolvedValue(widget);

    const result = await widgetService.generateSnippet(widget.id, TENANT_A);

    expect(result.snippet).toContain('data-widget-id="widget_snippet_01"');
    expect(result.widgetId).toBe('widget_snippet_01');
    expect(result.version).toBe(widget.version);
  });

  it('returns a snippet that is a valid <script> tag', async () => {
    const widget = makeWidget();
    widgetRepo.findWidgetById.mockResolvedValue(widget);

    const { snippet } = await widgetService.generateSnippet(widget.id, TENANT_A);

    expect(snippet).toMatch(/^<script /);
    expect(snippet).toMatch(/<\/script>|async defer>/);
  });

  it('throws ForbiddenError when requesting snippet for another tenant\'s widget', async () => {
    const widget = makeWidget({ tenantId: TENANT_B });
    widgetRepo.findWidgetById.mockResolvedValue(widget);

    await expect(widgetService.generateSnippet(widget.id, TENANT_A)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
