import { useEffect, useRef, useState } from 'react';
import { getToken } from '../lib/auth.js';

// ─── useSSE Hook ──────────────────────────────────────────────────────────────
//
// Manages a Server-Sent Events connection to a given URL.
// Automatically injects the JWT token as a query parameter (EventSource
// doesn't support custom headers, so we pass the token in the URL).
//
// Returns:
//   status: 'connecting' | 'connected' | 'disconnected'
//   lastEvent: { type: string, data: any } | null
//
// Reconnects automatically with exponential back-off on failure.

const MAX_BACKOFF_MS = 30000;
const INITIAL_BACKOFF_MS = 1000;

export function useSSE(path) {
  const [status, setStatus] = useState('connecting');
  const [lastEvent, setLastEvent] = useState(null);
  const esRef = useRef(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      const token = getToken();
      if (!token) {
        setStatus('disconnected');
        return;
      }

      // EventSource doesn't support custom headers — pass token as query param
      const url = `${path}?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;
      setStatus('connecting');

      es.addEventListener('connected', () => {
        if (unmounted) return;
        setStatus('connected');
        backoffRef.current = INITIAL_BACKOFF_MS; // reset on success
      });

      es.addEventListener('ping', () => {
        // keepalive — ignore
      });

      es.addEventListener('new-submission', (e) => {
        if (unmounted) return;
        try {
          const data = JSON.parse(e.data);
          setLastEvent({ type: 'new-submission', data });
        } catch {
          // ignore parse errors
        }
      });

      es.onerror = () => {
        if (unmounted) return;
        es.close();
        setStatus('disconnected');

        // Exponential back-off reconnect
        retryTimerRef.current = setTimeout(() => {
          if (!unmounted) {
            backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
            connect();
          }
        }, backoffRef.current);
      };
    }

    connect();

    return () => {
      unmounted = true;
      esRef.current?.close();
      clearTimeout(retryTimerRef.current);
    };
  }, [path]);

  return { status, lastEvent };
}
