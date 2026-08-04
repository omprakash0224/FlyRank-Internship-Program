import { useState, useEffect, useCallback } from 'react';
import {
  Layers, Code, Check, Copy, Plus, Pencil, Trash2,
  X, ChevronRight, ChevronLeft, AlertTriangle,
  Type, ToggleLeft, Palette, ListPlus, Loader2,
} from 'lucide-react';
import { widgetsApi } from '../lib/api.js';
import { TypeBadge } from '../components/ui.jsx';
import { formatDate } from '../lib/utils.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const WIDGET_TYPES = ['POPOVER', 'SIGNUP_FORM', 'CTA'];
const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'textarea', 'select', 'checkbox'];

const EMPTY_FIELD = () => ({ name: '', type: 'text', label: '', required: false, placeholder: '', options: '' });

const DEFAULT_FORM = () => ({
  // Step 1
  name: '',
  type: 'POPOVER',
  // Step 2 – fields
  fields: [EMPTY_FIELD()],
  // Step 3 – copy & styling
  copyTitle: '',
  copySubtitle: '',
  copyButton: 'Submit',
  copySuccess: 'Thank you!',
  copyError: '',
  theme: 'light',
  primaryColor: '#10b981',
  borderRadius: '',
  fontFamily: '',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formToPayload(form) {
  return {
    name: form.name.trim(),
    type: form.type,
    config: {
      fields: form.fields.map((f) => ({
        name: f.name.trim(),
        type: f.type,
        label: f.label.trim(),
        required: !!f.required,
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
        ...(f.type === 'select' && f.options
          ? { options: f.options.split(',').map((o) => o.trim()).filter(Boolean) }
          : {}),
      })),
      copy: {
        ...(form.copyTitle    ? { title:    form.copyTitle }    : {}),
        ...(form.copySubtitle ? { subtitle: form.copySubtitle } : {}),
        button:  form.copyButton  || 'Submit',
        success: form.copySuccess || 'Thank you!',
        ...(form.copyError    ? { error:    form.copyError }    : {}),
      },
      styling: {
        theme: form.theme,
        primaryColor: form.primaryColor || '#10b981',
        ...(form.borderRadius ? { borderRadius: form.borderRadius } : {}),
        ...(form.fontFamily   ? { fontFamily:   form.fontFamily }   : {}),
      },
    },
  };
}

function widgetToForm(w) {
  const c = w.config ?? {};
  const copy = c.copy ?? {};
  const styling = c.styling ?? {};
  const fields = (c.fields ?? [EMPTY_FIELD()]).map((f) => ({
    name: f.name ?? '',
    type: f.type ?? 'text',
    label: f.label ?? '',
    required: !!f.required,
    placeholder: f.placeholder ?? '',
    options: Array.isArray(f.options) ? f.options.join(', ') : '',
  }));
  return {
    name: w.name ?? '',
    type: w.type ?? 'POPOVER',
    fields,
    copyTitle:    copy.title    ?? '',
    copySubtitle: copy.subtitle ?? '',
    copyButton:   copy.button   ?? 'Submit',
    copySuccess:  copy.success  ?? 'Thank you!',
    copyError:    copy.error    ?? '',
    theme:        styling.theme        ?? 'light',
    primaryColor: styling.primaryColor ?? '#10b981',
    borderRadius: styling.borderRadius ?? '',
    fontFamily:   styling.fontFamily   ?? '',
  };
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = [
    { num: 1, label: 'Basic Info',    icon: Type },
    { num: 2, label: 'Form Fields',   icon: ListPlus },
    { num: 3, label: 'Copy & Style',  icon: Palette },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const active  = step === s.num;
        const done    = step > s.num;
        const Icon    = s.icon;
        return (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--color-success)' : active ? 'var(--accent)' : 'var(--bg-elevated)',
                color: done || active ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700,
                border: active ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}>
                {done ? <Check size={14} /> : <Icon size={13} />}
              </div>
              <span style={{
                fontSize: 12, fontWeight: active ? 600 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 10px',
                background: done ? 'var(--color-success)' : 'var(--border)',
                borderRadius: 2, transition: 'background 0.3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormField({ label, children, error, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {error && <p style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{error}</p>}
      {hint  && <p style={{ fontSize: 11, color: 'var(--text-muted)',   marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };

// ─── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({ field, index, onChange, onRemove, canRemove, errors = {} }) {
  function set(key, val) {
    onChange(index, { ...field, [key]: val });
  }

  const errLabel   = errors[`field_${index}_label`];
  const errName    = errors[`field_${index}_name`];
  const errOptions = errors[`field_${index}_options`];
  const hasError   = errLabel || errName || errOptions;

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: `2px solid ${hasError ? 'var(--color-danger)' : 'var(--border)'}`,
      borderRadius: 10,
      marginBottom: 10,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* ── Card Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 14px',
        background: hasError ? 'var(--color-danger-bg)' : 'var(--bg-surface)',
        borderBottom: `1px solid ${hasError ? 'var(--color-danger)' : 'var(--border)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: hasError ? 'var(--color-danger)' : 'var(--text-primary)' }}>
            Field {index + 1}
          </span>
          {hasError && (
            <span style={{ fontSize: 11, color: 'var(--color-danger)', fontWeight: 500 }}>
              — fill in the required fields below
            </span>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 2, display: 'flex' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div style={{ padding: '14px 14px 12px' }}>
        {/* ── Required fields ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', padding: '2px 7px', borderRadius: 4 }}>
            Required
          </span>
        </div>

        {/* Label — full width */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: errLabel ? 'var(--color-danger)' : 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
            Field Label <span style={{ color: 'var(--color-danger)' }}>*</span>
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>— the text shown to users above this input</span>
          </label>
          <input
            style={{ ...inputStyle, borderColor: errLabel ? 'var(--color-danger)' : undefined, fontSize: 14 }}
            placeholder="e.g. Your Email Address"
            value={field.label}
            onChange={(e) => set('label', e.target.value)}
          />
          {errLabel && <p style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errLabel}</p>}
        </div>

        {/* Field Name — full width */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: errName ? 'var(--color-danger)' : 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
            Field ID / Key <span style={{ color: 'var(--color-danger)' }}>*</span>
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>— internal key used in the data (no spaces)</span>
          </label>
          <input
            style={{ ...inputStyle, borderColor: errName ? 'var(--color-danger)' : undefined, fontFamily: 'monospace', fontSize: 13 }}
            placeholder="e.g. email_address"
            value={field.name}
            onChange={(e) => set('name', e.target.value.replace(/\s+/g, '_'))}
          />
          {errName && <p style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errName}</p>}
        </div>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--border)' }}>
            Optional
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Type + Placeholder in 2-col */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Input Type</label>
            <select style={selectStyle} value={field.type} onChange={(e) => set('type', e.target.value)}>
              {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Placeholder hint</label>
            <input
              style={inputStyle}
              placeholder="Hint text inside the input"
              value={field.placeholder}
              onChange={(e) => set('placeholder', e.target.value)}
            />
          </div>
        </div>

        {/* Select options */}
        {field.type === 'select' && (
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: errOptions ? 'var(--color-danger)' : 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Dropdown Options <span style={{ color: 'var(--color-danger)' }}>*</span>
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>(comma-separated)</span>
            </label>
            <input
              style={{ ...inputStyle, borderColor: errOptions ? 'var(--color-danger)' : undefined }}
              placeholder="e.g. Option A, Option B, Option C"
              value={field.options}
              onChange={(e) => set('options', e.target.value)}
            />
            {errOptions && <p style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{errOptions}</p>}
          </div>
        )}

        {/* Required toggle */}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id={`req-${index}`}
            checked={field.required}
            onChange={(e) => set('required', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor={`req-${index}`} style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Mark this field as required in the widget
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────────


function WidgetModal({ editingWidget, onClose, onSaved }) {
  const isEdit = !!editingWidget;
  const [step, setStep]     = useState(1);
  const [form, setForm]     = useState(() => isEdit ? widgetToForm(editingWidget) : DEFAULT_FORM());
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Clears the error for a key the moment the user starts typing in step 1
  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // ── Field helpers ──────────────────────────────────────────────────────────
  function updateField(i, val) {
    setForm((f) => {
      const fields = [...f.fields];
      fields[i] = val;
      return { ...f, fields };
    });
    // Clear all errors for this field row the moment the user edits any part of it
    setErrors((prev) => {
      const keys = [`field_${i}_label`, `field_${i}_name`, `field_${i}_options`];
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  }
  function addField() {
    setForm((f) => ({ ...f, fields: [...f.fields, EMPTY_FIELD()] }));
  }
  function removeField(i) {
    setForm((f) => ({ ...f, fields: f.fields.filter((_, idx) => idx !== i) }));
    // Drop lingering errors for the removed row
    setErrors((prev) => {
      const keys = [`field_${i}_label`, `field_${i}_name`, `field_${i}_options`];
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  }

  // ── Validation per step ────────────────────────────────────────────────────
  function validateStep(s) {
    const errs = {};
    if (s === 1) {
      if (!form.name.trim()) errs.name = 'Widget name is required';
      if (form.name.trim().length > 100) errs.name = 'Max 100 characters';
    }
    if (s === 2) {
      form.fields.forEach((f, i) => {
        if (!f.label.trim()) errs[`field_${i}_label`] = 'Label required';
        if (!f.name.trim())  errs[`field_${i}_name`]  = 'Name required';
        if (f.type === 'select' && !f.options.trim()) errs[`field_${i}_options`] = 'Provide at least one option';
      });
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validateStep(step)) setStep((s) => s + 1);
  }
  // Clear all errors when going back so stale red highlights don't bleed between steps
  function handleBack() {
    setErrors({});
    setStep((s) => s - 1);
  }

  async function handleSave() {
    if (!validateStep(3)) return;
    setSaving(true);
    setApiErr('');
    try {
      const payload = formToPayload(form);
      const res = isEdit
        ? await widgetsApi.update(editingWidget.id, payload)
        : await widgetsApi.create(payload);
      onSaved(res?.data, isEdit);
    } catch (err) {
      setApiErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Backdrop ──────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 50, padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: 580, width: '100%', background: 'var(--bg-surface)',
          maxHeight: '90vh', overflowY: 'auto', position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              {isEdit ? 'Edit Widget' : 'Create New Widget'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {isEdit ? `Editing "${editingWidget.name}"` : 'Configure your embeddable widget in 3 steps'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <StepIndicator step={step} />

        {/* API Error */}
        {apiErr && (
          <div style={{
            background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)',
            borderRadius: 8, padding: '10px 14px', fontSize: 13,
            color: 'var(--color-danger)', marginBottom: 18, display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            {apiErr}
          </div>
        )}

        {/* ── STEP 1: Basic Info ─────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <FormField label="Widget Name *" error={errors.name}>
              <input
                style={{ ...inputStyle, borderColor: errors.name ? 'var(--color-danger)' : undefined }}
                placeholder="e.g. Newsletter Signup"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                autoFocus
              />
            </FormField>

            <FormField label="Widget Type *">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {WIDGET_TYPES.map((t) => {
                  const active = form.type === t;
                  const labels = { POPOVER: 'Popover', SIGNUP_FORM: 'Signup Form', CTA: 'CTA' };
                  const descs  = { POPOVER: 'Overlay popup', SIGNUP_FORM: 'Inline form', CTA: 'Call to action' };
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('type', t)}
                      style={{
                        padding: '12px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                        border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent-light)' : 'var(--bg-elevated)',
                        transition: 'all 0.18s',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 3 }}>
                        {labels[t]}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{descs[t]}</div>
                    </button>
                  );
                })}
              </div>
            </FormField>
          </div>
        )}

        {/* ── STEP 2: Form Fields ────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Define the fields that will appear in your widget's form. At least one field is required.
            </p>
            {form.fields.map((f, i) => (
              <FieldRow
                key={i}
                field={f}
                index={i}
                onChange={updateField}
                onRemove={removeField}
                canRemove={form.fields.length > 1}
                errors={errors}
              />
            ))}
            <button
              type="button"
              onClick={addField}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--bg-elevated)', border: '1px dashed var(--border)',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                fontSize: 13, color: 'var(--text-secondary)', width: '100%',
                justifyContent: 'center', transition: 'all 0.18s',
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <Plus size={14} />
              Add Another Field
            </button>
          </div>
        )}

        {/* ── STEP 3: Copy & Styling ─────────────────────────────────────── */}
        {step === 3 && (
          <div>
            {/* Copy Section */}
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: 10, padding: 14, marginBottom: 16,
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Text Content
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FormField label="Title" hint="Main heading shown in widget">
                  <input style={inputStyle} placeholder="e.g. Subscribe to our newsletter" value={form.copyTitle} onChange={(e) => set('copyTitle', e.target.value)} />
                </FormField>
                <FormField label="Subtitle">
                  <input style={inputStyle} placeholder="e.g. Stay up to date" value={form.copySubtitle} onChange={(e) => set('copySubtitle', e.target.value)} />
                </FormField>
                <FormField label="Button Label">
                  <input style={inputStyle} placeholder="Submit" value={form.copyButton} onChange={(e) => set('copyButton', e.target.value)} />
                </FormField>
                <FormField label="Success Message">
                  <input style={inputStyle} placeholder="Thank you!" value={form.copySuccess} onChange={(e) => set('copySuccess', e.target.value)} />
                </FormField>
              </div>
              <FormField label="Error Message" hint="Shown when submission fails">
                <input style={inputStyle} placeholder="Something went wrong. Please try again." value={form.copyError} onChange={(e) => set('copyError', e.target.value)} />
              </FormField>
            </div>

            {/* Styling Section */}
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: 10, padding: 14,
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Visual Style
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FormField label="Theme">
                  <select style={selectStyle} value={form.theme} onChange={(e) => set('theme', e.target.value)}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </FormField>
                <FormField label="Primary Color" hint="Hex e.g. #3b82f6">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => set('primaryColor', e.target.value)}
                      style={{ width: 38, height: 38, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none', padding: 2 }}
                    />
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="#10b981"
                      value={form.primaryColor}
                      onChange={(e) => set('primaryColor', e.target.value)}
                    />
                  </div>
                </FormField>
                <FormField label="Border Radius" hint="e.g. 8px or 0.5rem">
                  <input style={inputStyle} placeholder="8px" value={form.borderRadius} onChange={(e) => set('borderRadius', e.target.value)} />
                </FormField>
                <FormField label="Font Family">
                  <input style={inputStyle} placeholder="e.g. Inter, sans-serif" value={form.fontFamily} onChange={(e) => set('fontFamily', e.target.value)} />
                </FormField>
              </div>
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button
            className="btn btn-ghost"
            onClick={step === 1 ? onClose : handleBack}
            style={{ gap: 6 }}
          >
            {step > 1 && <ChevronLeft size={15} />}
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button className="btn btn-primary" onClick={handleNext} style={{ gap: 6 }}>
              Next
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ gap: 6, minWidth: 110 }}
            >
              {saving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={15} />}
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Widget'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteModal({ widget, onClose, onConfirm, deleting }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 50, padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card" style={{ maxWidth: 420, width: '100%', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: 'var(--color-danger-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Delete Widget</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>This action cannot be undone via the UI</p>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{widget.name}</strong>?
          This will soft-delete the widget — it will stop accepting new submissions but existing data is retained.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={onConfirm}
            disabled={deleting}
            style={{
              background: 'var(--color-danger)', color: '#fff', borderColor: 'var(--color-danger)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {deleting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete Widget'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Snippet Modal ────────────────────────────────────────────────────────────

function SnippetModal({ widget, onClose }) {
  const [copied, setCopied] = useState(false);
  const base = window.location.origin.replace('5173', '3000');
  const snippet = `<script src="${base}/widget.js" data-widget-id="${widget.id}"></script>`;

  function handleCopy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 50, padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card" style={{ maxWidth: 520, width: '100%', background: 'var(--bg-surface)' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Embed Code Snippet</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Copy and paste this script tag into the HTML of any site to embed <strong>{widget.name}</strong>.
        </p>
        <div style={{
          background: 'var(--bg-elevated)', padding: '14px', borderRadius: 12,
          border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12,
          wordBreak: 'break-all', color: 'var(--accent)', marginBottom: 20,
        }}>
          {snippet}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Snippet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

/**
 * Widgets management page — list, create, edit, delete, and get embed snippets.
 */
export function WidgetsPage({ searchQuery = '' }) {
  const [widgets,  setWidgets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  // Modal state
  const [showCreate,  setShowCreate]  = useState(false);
  const [editWidget,  setEditWidget]  = useState(null);   // widget object being edited
  const [deleteWidget, setDeleteWidget] = useState(null); // widget object to delete
  const [snippetWidget, setSnippetWidget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await widgetsApi.list({ limit: 100 });
      setWidgets(res?.data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = searchQuery.trim()
    ? widgets.filter((w) =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : widgets;

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Called after a successful create or update */
  function handleSaved(widget, isEdit) {
    setWidgets((prev) => {
      if (isEdit) {
        return prev.map((w) => (w.id === widget.id ? widget : w));
      }
      return [widget, ...prev];
    });
    setShowCreate(false);
    setEditWidget(null);
  }

  async function handleDelete() {
    if (!deleteWidget) return;
    setDeleting(true);
    try {
      await widgetsApi.remove(deleteWidget.id);
      setWidgets((prev) => prev.filter((w) => w.id !== deleteWidget.id));
      setDeleteWidget(null);
    } catch (err) {
      // Surface error inside delete modal via a simple alert — keeps modal open
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>
        <button className="btn btn-primary" onClick={load}>Retry</button>
      </div>
    );
  }

  return (
    <div className="page-content-grid">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Widgets
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Create and manage your embeddable widgets
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowCreate(true)}
        >
          <Plus size={16} />
          New Widget
        </button>
      </div>

      {/* ── Table Card ─────────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 20 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8, borderRadius: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Layers size={44} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              No widgets yet
            </h3>
            <p style={{ fontSize: 13, marginBottom: 20 }}>
              {searchQuery ? 'Try matching another name or type' : 'Get started by creating your first widget'}
            </p>
            {!searchQuery && (
              <button
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => setShowCreate(true)}
              >
                <Plus size={16} />
                Create Widget
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Version</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <div className="text-primary-cell">{w.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {w.id.slice(0, 12)}…
                      </div>
                    </td>
                    <td><TypeBadge type={w.type} /></td>
                    <td>
                      <span className="badge-sleek enriched">v{w.version}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{formatDate(w.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {/* Embed Snippet */}
                        <button
                          className="btn btn-ghost"
                          title="Get embed snippet"
                          style={{ padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => setSnippetWidget(w)}
                        >
                          <Code size={13} />
                          Code
                        </button>
                        {/* Edit */}
                        <button
                          className="btn btn-ghost"
                          title="Edit widget"
                          style={{ padding: '5px 8px' }}
                          onClick={() => setEditWidget(w)}
                        >
                          <Pencil size={14} />
                        </button>
                        {/* Delete */}
                        <button
                          className="btn btn-ghost"
                          title="Delete widget"
                          style={{
                            padding: '5px 8px',
                            color: 'var(--color-danger)',
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-danger-bg)')}
                          onMouseOut={(e) => (e.currentTarget.style.background = '')}
                          onClick={() => setDeleteWidget(w)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {(showCreate || editWidget) && (
        <WidgetModal
          editingWidget={editWidget}
          onClose={() => { setShowCreate(false); setEditWidget(null); }}
          onSaved={handleSaved}
        />
      )}

      {deleteWidget && (
        <DeleteModal
          widget={deleteWidget}
          deleting={deleting}
          onClose={() => setDeleteWidget(null)}
          onConfirm={handleDelete}
        />
      )}

      {snippetWidget && (
        <SnippetModal
          widget={snippetWidget}
          onClose={() => setSnippetWidget(null)}
        />
      )}
    </div>
  );
}
