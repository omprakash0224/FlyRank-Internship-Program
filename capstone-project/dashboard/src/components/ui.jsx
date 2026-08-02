/**
 * Maps a submission status string to the correct CSS badge class.
 */
export function StatusBadge({ status }) {
  const map = {
    PENDING: { cls: 'badge-pending', label: 'Pending' },
    ENRICHED: { cls: 'badge-enriched', label: 'Enriched' },
    STORED: { cls: 'badge-stored', label: 'Stored' },
    FAILED: { cls: 'badge-failed', label: 'Failed' },
  };
  const { cls, label } = map[status] ?? { cls: 'badge-pending', label: status };
  return <span className={`badge ${cls}`}>{label}</span>;
}

/**
 * Maps a widget type to a styled badge.
 */
export function TypeBadge({ type }) {
  const map = {
    POPOVER: { cls: 'badge-popover', label: 'Popover' },
    SIGNUP_FORM: { cls: 'badge-signup', label: 'Signup' },
    CTA: { cls: 'badge-cta', label: 'CTA' },
  };
  const { cls, label } = map[type] ?? { cls: 'badge-cta', label: type };
  return <span className={`badge ${cls}`}>{label}</span>;
}
