/**
 * widget.js — Embeddable Widget Embed Script
 *
 * Usage:
 *   <script src="https://your-platform.com/widget.js"
 *           data-widget-id="<widgetId>"
 *           async defer></script>
 *
 * Flow:
 *   1. Read data-widget-id from the <script> tag that loaded this file.
 *   2. Fetch /widgets/:id/config (ETag-aware; server caches 5 min).
 *   3. Inject a Shadow DOM host element into <body> (style isolation).
 *   4. Render form fields + copy text from config — all via textContent (XSS-safe).
 *   5. On submit → POST /submissions with widgetId + form data.
 *   6. Show inline success or error toast.
 *
 * ~2 KB gzipped — no external dependencies, targets ES2020.
 */

(function () {
  'use strict';

  // ─── Locate the script tag that loaded this file ──────────────────────────

  const scriptEl = document.currentScript;
  if (!scriptEl) {
    console.warn('[widget.js] Could not locate own <script> tag — aborting.');
    return;
  }

  const WIDGET_ID = scriptEl.getAttribute('data-widget-id');
  if (!WIDGET_ID) {
    console.warn('[widget.js] Missing data-widget-id attribute — aborting.');
    return;
  }

  // Derive the API base URL from the script src (works on any host)
  const scriptSrc = scriptEl.src || '';
  const BASE_URL = scriptSrc ? scriptSrc.replace(/\/widget(?:\.\w+)?\.js.*$/, '') : '';

  // ─── Shadow DOM Styles ─────────────────────────────────────────────────────

  const SHADOW_CSS = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .wgt-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      padding: 16px;
      box-sizing: border-box;
    }
    .wgt-card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 32px;
      max-width: 420px;
      width: 100%;
      position: relative;
      animation: wgt-in 0.2s ease;
    }
    @keyframes wgt-in {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    .wgt-close {
      position: absolute;
      top: 12px;
      right: 16px;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #888;
      line-height: 1;
      padding: 4px;
    }
    .wgt-close:hover { color: #333; }
    .wgt-title {
      margin: 0 0 20px;
      font-size: 20px;
      font-weight: 700;
      color: #111;
    }
    .wgt-field {
      margin-bottom: 14px;
    }
    .wgt-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #444;
      margin-bottom: 6px;
    }
    .wgt-input {
      width: 100%;
      padding: 10px 12px;
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      box-sizing: border-box;
      transition: border-color 0.15s;
      outline: none;
    }
    .wgt-input:focus { border-color: var(--wgt-primary, #3b82f6); }
    /* honeypot — must stay invisible */
    .wgt-hp { opacity: 0; position: absolute; top: -9999px; left: -9999px; }
    .wgt-submit {
      width: 100%;
      padding: 12px;
      background: var(--wgt-primary, #3b82f6);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 6px;
      transition: opacity 0.15s;
    }
    .wgt-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .wgt-submit:hover:not(:disabled) { opacity: 0.88; }
    .wgt-toast {
      margin-top: 14px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }
    .wgt-toast.success { background: #d1fae5; color: #065f46; display: block; }
    .wgt-toast.error   { background: #fee2e2; color: #991b1b; display: block; }
    .wgt-spinner {
      text-align: center;
      padding: 40px 0;
      color: #888;
      font-size: 14px;
    }
  `;

  // ─── DOM Helpers ───────────────────────────────────────────────────────────

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'textContent') node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const child of children) {
      if (child instanceof Node) node.appendChild(child);
    }
    return node;
  }

  // ─── Render Form ───────────────────────────────────────────────────────────

  function renderWidget(config, shadow, host) {
    // Apply primary colour as CSS custom property
    const primary = config.styling?.primaryColor ?? '#3b82f6';
    host.style.setProperty('--wgt-primary', primary);

    const overlay = el('div', { class: 'wgt-overlay' });
    const card    = el('div', { class: 'wgt-card' });
    const closeBtn = el('button', { class: 'wgt-close', type: 'button', textContent: '✕' });
    const title   = el('h2', { class: 'wgt-title', textContent: config.copy?.title ?? 'Sign Up' });
    const form    = el('form', { id: 'wgt-form', novalidate: '' });
    const toast   = el('div', { class: 'wgt-toast', role: 'alert' });

    closeBtn.addEventListener('click', () => host.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) host.remove(); });

    // Honeypot field (spam control — never visible to real users)
    const hpWrapper = el('div', { class: 'wgt-hp' });
    const hpInput   = el('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' });
    hpWrapper.appendChild(hpInput);
    form.appendChild(hpWrapper);

    // Render configured fields
    const fields = Array.isArray(config.fields) ? config.fields : [];
    for (const field of fields) {
      const wrapper = el('div', { class: 'wgt-field' });
      const label   = el('label', { class: 'wgt-label', for: `wgt-${field.name}`, textContent: field.label ?? field.name });
      const input   = el('input', {
        class: 'wgt-input',
        id: `wgt-${field.name}`,
        name: field.name,
        type: field.type ?? 'text',
        placeholder: field.placeholder ?? '',
        ...(field.required ? { required: '' } : {}),
      });
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      form.appendChild(wrapper);
    }

    // Submit button
    const submitBtn = el('button', {
      class: 'wgt-submit',
      type: 'submit',
      textContent: config.copy?.button ?? 'Submit',
    });
    form.appendChild(submitBtn);
    form.appendChild(toast);

    // ─── Form Submission ─────────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      toast.className = 'wgt-toast';
      toast.textContent = '';

      const formData = new FormData(form);
      const data = {};
      for (const [k, v] of formData.entries()) {
        data[k] = v;
      }

      try {
        const res = await fetch(`${BASE_URL}/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ widgetId: WIDGET_ID, data }),
        });

        if (res.ok || res.status === 200 || res.status === 202) {
          toast.className = 'wgt-toast success';
          toast.textContent = config.copy?.success ?? 'Thank you!';
          form.reset();
          // Auto-close after 3 s
          setTimeout(() => host.remove(), 3000);
        } else {
          const body = await res.json().catch(() => ({}));
          toast.className = 'wgt-toast error';
          toast.textContent = body?.error?.message ?? 'Something went wrong. Please try again.';
          submitBtn.disabled = false;
        }
      } catch {
        toast.className = 'wgt-toast error';
        toast.textContent = 'Network error. Please check your connection and try again.';
        submitBtn.disabled = false;
      }
    });

    card.appendChild(closeBtn);
    card.appendChild(title);
    card.appendChild(form);
    overlay.appendChild(card);
    shadow.appendChild(overlay);
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  async function bootstrap() {
    // Create host element + closed Shadow DOM
    const host = document.createElement('div');
    host.setAttribute('id', `wgt-host-${WIDGET_ID}`);
    const shadow = host.attachShadow({ mode: 'closed' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    shadow.appendChild(style);

    // Show spinner while fetching config
    const spinner = el('div', { class: 'wgt-overlay' });
    const card    = el('div', { class: 'wgt-card' });
    const sp      = el('div', { class: 'wgt-spinner', textContent: 'Loading…' });
    card.appendChild(sp);
    spinner.appendChild(card);
    shadow.appendChild(spinner);
    document.body.appendChild(host);

    try {
      const res = await fetch(`${BASE_URL}/widgets/${WIDGET_ID}/config`, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        console.warn(`[widget.js] Config fetch failed: ${res.status}`);
        host.remove();
        return;
      }

      const config = await res.json();

      // Remove spinner, render real form
      shadow.removeChild(spinner);
      renderWidget(config, shadow, host);
    } catch (err) {
      console.warn('[widget.js] Failed to load widget config:', err);
      host.remove();
    }
  }

  // ─── Global API ───────────────────────────────────────────────────────────
  //
  // Expose window.__widgetPlatform[WIDGET_ID].open() so the host page can
  // re-open the widget programmatically (e.g. a CTA button) without having to
  // re-inject the <script> tag.
  //
  // Why this matters: dynamically appended <script> elements do NOT set
  // document.currentScript, so re-injecting widget.js silently aborts.
  // The host page should instead call:
  //   window.__widgetPlatform['<widgetId>'].open();
  //
  const _platform = (window.__widgetPlatform = window.__widgetPlatform || {});
  _platform[WIDGET_ID] = {
    /** Remove any existing instance and open a fresh widget overlay. */
    open() {
      const existing = document.getElementById(`wgt-host-${WIDGET_ID}`);
      if (existing) existing.remove();
      bootstrap();
    },
  };

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
