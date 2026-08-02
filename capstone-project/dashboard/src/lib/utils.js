/**
 * Format an ISO timestamp to a readable short form.
 */
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate a string to maxLen characters.
 */
export function truncate(str, maxLen = 40) {
  if (!str) return '—';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}
