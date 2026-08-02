import { X, Globe, Monitor, Clock, Hash, Link, Tag, Database } from 'lucide-react';
import { StatusBadge, TypeBadge } from './ui.jsx';
import { formatDate } from '../lib/utils.js';

/**
 * Full-screen modal overlay showing complete submission details.
 *
 * @param {{ submission: object, onClose: () => void }} props
 */
export function SubmissionDetail({ submission, onClose }) {
  if (!submission) return null;

  const geo = submission.enriched?.geo;
  const ua = submission.enriched?.userAgent;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>

        <div className="modal-title">Submission Detail</div>
        <div className="modal-subtitle" style={{ fontFamily: 'monospace' }}>
          {submission.id}
        </div>

        {/* ── Core Info ───────────────────────────────────── */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={12} /> Submission Info
          </div>

          <div className="detail-row">
            <span className="detail-key">Status</span>
            <span className="detail-value"><StatusBadge status={submission.status} /></span>
          </div>
          <div className="detail-row">
            <span className="detail-key">Widget</span>
            <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {submission.widget?.name ?? '—'}
              {submission.widget?.type && <TypeBadge type={submission.widget.type} />}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-key"><Clock size={12} style={{ marginRight: 4, display: 'inline' }} />Received</span>
            <span className="detail-value">{formatDate(submission.createdAt)}</span>
          </div>
          {submission.referrer && (
            <div className="detail-row">
              <span className="detail-key"><Link size={12} style={{ marginRight: 4, display: 'inline' }} />Referrer</span>
              <span className="detail-value" style={{ fontSize: 12, maxWidth: 260, wordBreak: 'break-all' }}>
                {submission.referrer}
              </span>
            </div>
          )}
        </section>

        <div className="divider" />

        {/* ── Form Data ───────────────────────────────────── */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag size={12} /> Form Data
          </div>
          <div className="json-block">
            {JSON.stringify(submission.data, null, 2)}
          </div>
        </section>

        {/* ── Enrichment ──────────────────────────────────── */}
        {submission.enriched && (
          <>
            <div className="divider" />
            <section>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={12} /> Geo Enrichment
              </div>

              {geo && (
                <>
                  <div className="detail-row">
                    <span className="detail-key">Country</span>
                    <span className="detail-value">{geo.country ?? '—'}</span>
                  </div>
                  {geo.region && (
                    <div className="detail-row">
                      <span className="detail-key">Region</span>
                      <span className="detail-value">{geo.region}</span>
                    </div>
                  )}
                  {geo.city && (
                    <div className="detail-row">
                      <span className="detail-key">City</span>
                      <span className="detail-value">{geo.city}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-key">Provider</span>
                    <span className="detail-value">
                      <span className="badge badge-enriched">{geo.provider ?? '—'}</span>
                    </span>
                  </div>
                </>
              )}

              {ua && (
                <>
                  <div className="divider" style={{ margin: '12px 0' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Monitor size={12} /> User Agent
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Browser</span>
                    <span className="detail-value">{ua.browser ?? '—'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">OS</span>
                    <span className="detail-value">{ua.os ?? '—'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Device</span>
                    <span className="detail-value">{ua.device ?? '—'}</span>
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* ── IP Hash ─────────────────────────────────────── */}
        <div className="divider" />
        <section>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Hash size={12} /> Privacy
          </div>
          <div className="detail-row">
            <span className="detail-key">IP Hash</span>
            <span className="detail-value text-mono" style={{ fontSize: 11 }}>{submission.ipHash?.slice(0, 16)}…</span>
          </div>
        </section>

        <div style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
