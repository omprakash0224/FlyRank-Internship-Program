import { useState, useEffect } from 'react';
import { isAuthenticated } from './lib/auth.js';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { SubmissionsPage } from './pages/SubmissionsPage.jsx';
import { WidgetsPage } from './pages/WidgetsPage.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Header } from './components/Header.jsx';

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [page, setPage] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Theme State (Dark / Light) ─────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app_theme') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  // ── Sidebar Collapse State ────────────────────────────────────────────────
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  function toggleSidebar() {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  }

  // ── Auth Gate ─────────────────────────────────────────────────────────────
  if (!authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }

  // ── Authenticated App Layout ──────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Sidebar
        page={page}
        onNavigate={setPage}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <div className="main-wrapper">
        <Header
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleSidebar}
          theme={theme}
          onToggleTheme={toggleTheme}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main style={{ flex: 1 }}>
          {page === 'dashboard' && <DashboardPage searchQuery={searchQuery} />}
          {page === 'submissions' && <SubmissionsPage searchQuery={searchQuery} />}
          {page === 'widgets' && <WidgetsPage searchQuery={searchQuery} />}
        </main>
      </div>
    </div>
  );
}
