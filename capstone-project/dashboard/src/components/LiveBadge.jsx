import { useSSE } from '../hooks/useSSE.js';

/**
 * Shows a pulsing "Live" indicator when SSE is connected,
 * or an "Offline" badge when disconnected.
 */
export function LiveBadge() {
  const { status } = useSSE('/api/dashboard/submissions/stream');

  if (status === 'connected') {
    return (
      <div className="live-badge" title="Real-time updates active">
        <div className="live-dot" />
        Live
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div className="offline-badge" title="Connecting…">
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
        Connecting
      </div>
    );
  }

  return (
    <div className="offline-badge" title="Real-time updates unavailable">
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-rose)' }} />
      Offline
    </div>
  );
}
