import { LayoutDashboard, FileText, Layers, LogOut, Activity } from 'lucide-react';
import { getTenant, clearAuth } from '../lib/auth.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'submissions', label: 'Submissions', icon: FileText },
  { id: 'widgets', label: 'Widgets', icon: Layers },
];

/**
 * Clean, collapsible sidebar navigation component.
 *
 * @param {{
 *   page: string,
 *   onNavigate: (page: string) => void,
 *   isCollapsed?: boolean,
 *   onToggleCollapse?: () => void
 * }} props
 */
export function Sidebar({ page, onNavigate, isCollapsed = false }) {
  const tenant = getTenant();
  const initial = tenant?.name?.[0]?.toUpperCase() ?? 'W';

  function handleLogout() {
    clearAuth();
    window.location.reload();
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo-group">
          <div className="sidebar-logo-icon">
            <Activity size={20} />
          </div>
          {!isCollapsed && (
            <div className="sidebar-logo-text">
              <h1>WidgetLab</h1>
              <p>Platform</p>
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        {!isCollapsed && <span className="nav-section-label">Main Menu</span>}
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = page === id;
          return (
            <button
              key={id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(id)}
              title={isCollapsed ? label : undefined}
            >
              <Icon size={18} />
              {!isCollapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {!isCollapsed ? (
          <div className="tenant-card">
            <div className="tenant-avatar">{initial}</div>
            <div className="tenant-info">
              <div className="tenant-name">{tenant?.name ?? 'Tenant Workspace'}</div>
              <div className="tenant-email">{tenant?.email ?? ''}</div>
            </div>
          </div>
        ) : (
          <div
            className="tenant-avatar"
            style={{ margin: '0 auto' }}
            title={tenant?.name ?? 'Tenant'}
          >
            {initial}
          </div>
        )}

        <button
          className="nav-item"
          onClick={handleLogout}
          style={{ color: 'var(--color-danger)' }}
          title={isCollapsed ? 'Sign out' : undefined}
        >
          <LogOut size={18} />
          {!isCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
