import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { dashboardApi, widgetsApi } from '../lib/api.js';
import { StatusBadge, TypeBadge } from '../components/ui.jsx';
import { formatDate, truncate } from '../lib/utils.js';
import { SubmissionDetail } from '../components/SubmissionDetail.jsx';
import { useSSE } from '../hooks/useSSE.js';

/**
 * Submissions page — paginated table with widget filter, live SSE updates,
 * and a click-to-open detail modal.
 */
export function SubmissionsPage({ searchQuery = '' }) {
  const [submissions, setSubmissions] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [widgetFilter, setWidgetFilter] = useState('');
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // submission for detail modal
  const [newCount, setNewCount] = useState(0);     // SSE-detected new rows
  const tableRef = useRef(null);

  // ── SSE for real-time updates ──────────────────────────────────────────────
  const { lastEvent } = useSSE('/api/dashboard/submissions/stream');
  const lastEventRef = useRef(null);

  useEffect(() => {
    if (!lastEvent || lastEvent.type !== 'new-submission') return;
    if (lastEventRef.current === lastEvent) return;
    lastEventRef.current = lastEvent;

    const incoming = lastEvent.data.submissions ?? [];
    if (incoming.length === 0) return;

    queueMicrotask(() => {
      if (page === 1) {
        setSubmissions((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const fresh = incoming.filter((s) => !existingIds.has(s.id));
          return [...fresh, ...prev].slice(0, meta.limit);
        });
        setMeta((prev) => ({ ...prev, total: prev.total + incoming.length }));
      } else {
        setNewCount((c) => c + incoming.length);
      }
    });
  }, [lastEvent, page, meta.limit]);

  // ── Load widgets for the filter dropdown ──────────────────────────────────
  useEffect(() => {
    widgetsApi.list().then((res) => setWidgets(res?.data ?? [])).catch(() => {});
  }, []);

  // ── Fetch submissions ──────────────────────────────────────────────────────
  const fetchSubmissions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await dashboardApi.getSubmissions({
        page,
        limit: 20,
        widgetId: widgetFilter || undefined,
      });
      setSubmissions(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, widgetFilter]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setNewCount(0);
      setLoading(true);
      setError('');
      try {
        const res = await dashboardApi.getSubmissions({
          page,
          limit: 20,
          widgetId: widgetFilter || undefined,
        });
        if (!ignore) {
          setSubmissions(res.data);
          setMeta(res.meta);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [page, widgetFilter]);


  // Open detail modal
  async function openDetail(id) {
    try {
      const res = await dashboardApi.getSubmission(id);
      setSelected(res.data);
    } catch {
      setSelected(submissions.find((s) => s.id === id) ?? null);
    }
  }

  // Filter submissions by global search query
  const filteredSubmissions = searchQuery.trim()
    ? submissions.filter(s =>
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.widget?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        JSON.stringify(s.data).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.status && s.status.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : submissions;

  const totalFrom = (page - 1) * meta.limit + 1;
  const totalTo = Math.min(page * meta.limit, meta.total);

  return (
    <div className="page-content-grid">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Submissions
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            All form submissions captured across your widgets
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            onClick={() => fetchSubmissions()}
            disabled={loading}
          >
            <RefreshCw size={14} style={{ transform: loading ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── New submissions banner ────────────────────────────── */}
      {newCount > 0 && (
        <div
          style={{
            background: 'var(--accent-light)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            color: 'var(--accent)',
            fontWeight: 600,
          }}
        >
          <span>↑ {newCount} new submission{newCount > 1 ? 's' : ''} captured</span>
          <button
            className="btn btn-primary"
            onClick={() => { setPage(1); setNewCount(0); }}
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            Go to top
          </button>
        </div>
      )}

      {/* ── Filters & Table Container ───────────────────────── */}
      <div className="glass-card" style={{ padding: 0 }} ref={tableRef}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Filter size={15} style={{ color: 'var(--text-muted)' }} />
            <select
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
              }}
              value={widgetFilter}
              onChange={(e) => { setWidgetFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Widgets</option>
              {widgets.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {meta.total.toLocaleString()} total
          </span>
        </div>

        {error ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>
            <button className="btn btn-ghost" onClick={() => fetchSubmissions()}>Retry</button>
          </div>
        ) : loading ? (
          <div style={{ padding: 20 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, marginBottom: 6, borderRadius: 8 }} />
            ))}
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Search size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No submissions found</h3>
            <p style={{ fontSize: 13 }}>
              {widgetFilter || searchQuery
                ? 'Try adjusting your filters or search query'
                : 'Embed a widget on your site to start capturing leads'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Widget</th>
                  <th>Type</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Country</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((s) => (
                  <tr key={s.id} onClick={() => openDetail(s.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>
                      {s.id.slice(0, 8)}…
                    </td>
                    <td className="text-primary-cell">
                      {s.widget?.name ?? '—'}
                    </td>
                    <td>
                      {s.widget?.type && <TypeBadge type={s.widget.type} />}
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <span style={{ display: 'block', maxWidth: 220, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {truncate(JSON.stringify(s.data), 48)}
                      </span>
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td style={{ fontSize: 12 }}>
                      {s.enriched?.geo?.country ?? (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(s.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────── */}
        {!loading && meta.total > 0 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {totalFrom}–{totalTo} of {meta.total.toLocaleString()}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {page} / {meta.totalPages}
              </span>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ─────────────────────────────────────── */}
      {selected && (
        <SubmissionDetail
          submission={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
