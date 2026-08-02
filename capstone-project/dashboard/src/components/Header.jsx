import { Search, Sun, Moon, PanelLeftClose, PanelLeftOpen, Calendar } from 'lucide-react';
import { getTenant } from '../lib/auth.js';
import { LiveBadge } from './LiveBadge.jsx';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Top navigation header bar component.
 *
 * @param {{
 *   isCollapsed: boolean,
 *   onToggleCollapse: () => void,
 *   theme: 'dark' | 'light',
 *   onToggleTheme: () => void,
 *   searchQuery?: string,
 *   onSearchChange?: (query: string) => void
 * }} props
 */
export function Header({
  isCollapsed,
  onToggleCollapse,
  theme,
  onToggleTheme,
  searchQuery = '',
  onSearchChange
}) {
  const tenant = getTenant();
  const initial = tenant?.name?.[0]?.toUpperCase() ?? 'U';
  const greeting = getGreeting();
  const formattedDate = getFormattedDate();

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          className="icon-btn"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <div className="header-greeting">
          <h2>{greeting}, {tenant?.name ?? 'Developer'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
            <p>{formattedDate}</p>
          </div>
        </div>
      </div>

      <div className="header-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search metrics, submissions, widgets..."
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
        <span className="shortcut-badge">⌘K</span>
      </div>

      <div className="header-right">
        <LiveBadge />

        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div
          title={tenant?.name ?? 'Tenant'}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            border: '2px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
