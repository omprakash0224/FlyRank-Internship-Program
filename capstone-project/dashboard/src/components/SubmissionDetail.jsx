import { useState, useEffect } from 'react';
import {
  X, Globe, Monitor, Clock, Hash, Link as LinkIcon,
  Tag, Database, Copy, Check, Code, LayoutGrid,
  Mail, Phone, User, MessageSquare, ExternalLink, ShieldCheck,
  Smartphone, Laptop
} from 'lucide-react';
import { StatusBadge, TypeBadge } from './ui.jsx';
import { formatDate } from '../lib/utils.js';

/**
 * Returns a matching Lucide icon based on key name for structured field display
 */
function getFieldIcon(key = '') {
  const lower = key.toLowerCase();
  if (lower.includes('email') || lower.includes('mail')) return Mail;
  if (lower.includes('phone') || lower.includes('tel') || lower.includes('mobile')) return Phone;
  if (lower.includes('name') || lower.includes('user') || lower.includes('author')) return User;
  if (lower.includes('message') || lower.includes('comment') || lower.includes('note') || lower.includes('desc')) return MessageSquare;
  return Tag;
}

/**
 * Full-screen modal overlay showing complete submission details popover.
 *
 * @param {{ submission: object, onClose: () => void }} props
 */
export function SubmissionDetail({ submission, onClose }) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeTab, setActiveTab] = useState('structured'); // 'structured' | 'json'

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!submission) return null;

  const geo = submission.enriched?.geo;
  const ua = submission.enriched?.userAgent;
  const formData = submission.data ?? submission.payload ?? {};

  const handleCopyId = () => {
    navigator.clipboard.writeText(submission.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(submission, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1500);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* ── Modal Header ────────────────────────────────────────── */}
        <div className="modal-header">
          <div>
            <div className="popover-header-title">
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                Submission Detail
              </h2>
              <StatusBadge status={submission.status} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <button
                className="popover-id-pill"
                onClick={handleCopyId}
                title="Click to copy Submission ID"
              >
                <span>#{submission.id}</span>
                {copiedId ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
              </button>
              {copiedId && (
                <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>
                  Copied!
                </span>
              )}
            </div>
          </div>

          <button className="modal-close" onClick={onClose} aria-label="Close popover">
            <X size={16} />
          </button>
        </div>

        {/* ── Modal Body ────────────────────────────────────────── */}
        <div className="modal-body">
          {/* ── Overview Metadata Card ──────────────────────────── */}
          <div className="popover-section-card">
            <div className="popover-section-title">
              <Database size={13} style={{ color: 'var(--accent)' }} /> Overview Metadata
            </div>

            <div className="field-grid">
              <div className="field-card">
                <span className="field-label">Widget</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span className="field-value">{submission.widget?.name ?? '—'}</span>
                  {submission.widget?.type && <TypeBadge type={submission.widget.type} />}
                </div>
              </div>

              <div className="field-card">
                <span className="field-label">
                  <Clock size={12} /> Received At
                </span>
                <span className="field-value" style={{ marginTop: 2 }}>
                  {formatDate(submission.createdAt)}
                </span>
              </div>

              {submission.referrer && (
                <div className="field-card" style={{ gridColumn: '1 / -1' }}>
                  <span className="field-label">
                    <LinkIcon size={12} /> Referrer Source
                  </span>
                  <a
                    href={submission.referrer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="field-value"
                    style={{
                      fontSize: 12,
                      color: 'var(--accent)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      textDecoration: 'none',
                      marginTop: 2,
                      wordBreak: 'break-all'
                    }}
                  >
                    {submission.referrer}
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ── Captured Form Payload ────────────────────────────── */}
          <div className="popover-section-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="popover-section-title" style={{ marginBottom: 0 }}>
                <Tag size={13} style={{ color: 'var(--accent)' }} /> Captured Form Payload
              </div>

              <div className="tab-switcher" style={{ marginBottom: 0 }}>
                <button
                  className={`tab-btn ${activeTab === 'structured' ? 'active' : ''}`}
                  onClick={() => setActiveTab('structured')}
                >
                  <LayoutGrid size={13} /> Structured
                </button>
                <button
                  className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
                  onClick={() => setActiveTab('json')}
                >
                  <Code size={13} /> Raw JSON
                </button>
              </div>
            </div>

            {activeTab === 'structured' ? (
              typeof formData === 'object' && formData !== null && Object.keys(formData).length > 0 ? (
                <div className="field-grid">
                  {Object.entries(formData).map(([key, val]) => {
                    const IconComp = getFieldIcon(key);
                    const formattedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                    return (
                      <div key={key} className="field-card">
                        <span className="field-label">
                          <IconComp size={12} style={{ color: 'var(--text-muted)' }} /> {key}
                        </span>
                        <span className="field-value">{formattedVal}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No form data payload recorded
                </div>
              )
            ) : (
              <div style={{ position: 'relative' }}>
                <div className="json-block">
                  {JSON.stringify(formData, null, 2)}
                </div>
              </div>
            )}
          </div>

          {/* ── Enrichment Details ──────────────────────────────── */}
          {submission.enriched && (
            <div className="popover-section-card">
              <div className="popover-section-title">
                <Globe size={13} style={{ color: 'var(--color-info)' }} /> Geo & Client Enrichment
              </div>

              {geo && (
                <div className="field-grid" style={{ marginBottom: ua ? 16 : 0 }}>
                  <div className="field-card">
                    <span className="field-label">Country</span>
                    <span className="field-value">{geo.country ?? '—'}</span>
                  </div>
                  <div className="field-card">
                    <span className="field-label">Region / City</span>
                    <span className="field-value">
                      {[geo.city, geo.region].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                  <div className="field-card">
                    <span className="field-label">Network Provider</span>
                    <div style={{ marginTop: 2 }}>
                      <span className="badge badge-sleek enriched">
                        {geo.provider ?? 'Standard ISP'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {geo && ua && <div className="divider" style={{ margin: '14px 0' }} />}

              {ua && (
                <div className="field-grid">
                  <div className="field-card">
                    <span className="field-label">
                      <Monitor size={12} /> Browser
                    </span>
                    <span className="field-value">{ua.browser ?? '—'}</span>
                  </div>
                  <div className="field-card">
                    <span className="field-label">Operating System</span>
                    <span className="field-value">{ua.os ?? '—'}</span>
                  </div>
                  <div className="field-card">
                    <span className="field-label">Device Type</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {ua.device === 'Mobile' ? <Smartphone size={14} /> : <Laptop size={14} />}
                      <span className="field-value">{ua.device ?? 'Desktop'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Privacy & Security Section ──────────────────────── */}
          <div className="popover-section-card">
            <div className="popover-section-title">
              <ShieldCheck size={13} style={{ color: 'var(--color-success)' }} /> Security & Privacy
            </div>
            <div className="field-card">
              <span className="field-label">
                <Hash size={12} /> IP Anonymization Hash
              </span>
              <span className="field-value" style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                {submission.ipHash ? `${submission.ipHash.slice(0, 24)}…` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Modal Footer ────────────────────────────────────────── */}
        <div className="modal-footer">
          <button className="copy-btn" onClick={handleCopyJson}>
            {copiedJson ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
            {copiedJson ? 'JSON Copied!' : 'Copy Full JSON'}
          </button>

          <button className="btn btn-primary" onClick={onClose} style={{ padding: '6px 20px', fontSize: 13 }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
