import { useState, useEffect } from 'react';
import { Layers, Code, Check, Copy } from 'lucide-react';
import { widgetsApi } from '../lib/api.js';
import { TypeBadge } from '../components/ui.jsx';
import { formatDate } from '../lib/utils.js';

/**
 * Widgets listing page — shows all active widgets with type, version,
 * creation date, and embed snippet code modal.
 */
export function WidgetsPage({ searchQuery = '' }) {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snippetWidget, setSnippetWidget] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await widgetsApi.list({ limit: 100 });
        setWidgets(res?.data ?? []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function getSnippet(widget) {
    const base = window.location.origin.replace('5173', '3000');
    return `<script src="${base}/widget.js" data-widget-id="${widget.id}"></script>`;
  }

  function handleCopy(code) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filteredWidgets = searchQuery.trim()
    ? widgets.filter(w =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : widgets;

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="page-content-grid">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Widgets
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Manage your embeddable widgets and get embed script tags
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
          API: Admin endpoints active
        </div>
      </div>

      <div className="glass-card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 20 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8, borderRadius: 8 }} />
            ))}
          </div>
        ) : filteredWidgets.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Layers size={44} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No widgets found</h3>
            <p style={{ fontSize: 13 }}>
              {searchQuery ? 'Try matching another name or type' : 'Create your first widget via POST /api/widgets'}
            </p>
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
                  <th style={{ textAlign: 'right' }}>Embed Snippet</th>
                </tr>
              </thead>
              <tbody>
                {filteredWidgets.map((w) => (
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
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setSnippetWidget(w)}
                      >
                        <Code size={14} />
                        Get Code
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Snippet Modal */}
      {snippetWidget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: 20
        }}>
          <div className="glass-card" style={{ maxWidth: 520, width: '100%', background: 'var(--bg-surface)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Embed Code Snippet</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Copy and paste this script tag into the HTML of any site to embed <strong>{snippetWidget.name}</strong>.
            </p>

            <div style={{
              background: 'var(--bg-elevated)',
              padding: '14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              fontFamily: 'monospace',
              fontSize: 12,
              wordBreak: 'break-all',
              color: 'var(--accent)',
              marginBottom: 20,
              position: 'relative'
            }}>
              {getSnippet(snippetWidget)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setSnippetWidget(null)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleCopy(getSnippet(snippetWidget))}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Snippet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
