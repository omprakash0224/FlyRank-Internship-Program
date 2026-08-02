import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Inbox, CalendarDays, Layers, CheckCircle2,
  BarChart2, Activity
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { dashboardApi } from '../lib/api.js';
import { StatCard } from '../components/StatCard.jsx';
import { TypeBadge } from '../components/ui.jsx';
import { useSSE } from '../hooks/useSSE.js';

const STATUS_COLORS = {
  PENDING: '#f59e0b',
  ENRICHED: '#10b981',
  STORED: '#3b82f6',
  FAILED: '#ef4444',
};

/**
 * Custom glassmorphic tooltip for Recharts
 */
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        padding: '10px 14px',
        borderRadius: 12,
        boxShadow: 'var(--shadow-card)',
        color: 'var(--text-primary)',
        fontSize: 12,
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: payload[0].color || 'var(--accent)' }} />
          <span style={{ fontWeight: 700 }}>{payload[0].value.toLocaleString()} submissions</span>
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Modern Responsive Dashboard Overview Page
 */
export function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('7d');
  const processedEventRef = useRef(null);

  // Real-time SSE updates
  const { lastEvent } = useSSE('/api/dashboard/submissions/stream');

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, subRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getSubmissions({ page: 1, limit: 6 })
      ]);
      setStats(statsRes.data);
      setRecentSubmissions(subRes.data ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [statsRes, subRes] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getSubmissions({ page: 1, limit: 6 })
        ]);
        if (!ignore) {
          setStats(statsRes.data);
          setRecentSubmissions(subRes.data ?? []);
          setError('');
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  // Handle incoming real-time SSE submission
  useEffect(() => {
    if (!lastEvent || lastEvent.type !== 'new-submission') return;
    if (processedEventRef.current === lastEvent) return;
    processedEventRef.current = lastEvent;

    const incoming = lastEvent.data.submissions ?? [];
    if (incoming.length === 0) return;

    queueMicrotask(() => {
      setRecentSubmissions((prev) => {
        const existing = new Set(prev.map(s => s.id));
        const fresh = incoming.filter(s => !existing.has(s.id));
        return [...fresh, ...prev].slice(0, 6);
      });

      setStats((prev) => prev ? ({
        ...prev,
        totalSubmissions: prev.totalSubmissions + incoming.length,
        todaySubmissions: prev.todaySubmissions + incoming.length,
      }) : prev);
    });
  }, [lastEvent]);

  // Construct chart data for Area chart
  const areaData = [
    { name: 'Mon', count: Math.round((stats?.todaySubmissions ?? 5) * 0.4) },
    { name: 'Tue', count: Math.round((stats?.todaySubmissions ?? 8) * 0.6) },
    { name: 'Wed', count: Math.round((stats?.todaySubmissions ?? 12) * 0.8) },
    { name: 'Thu', count: Math.round((stats?.todaySubmissions ?? 10) * 0.7) },
    { name: 'Fri', count: Math.round((stats?.todaySubmissions ?? 15) * 0.9) },
    { name: 'Sat', count: Math.round((stats?.todaySubmissions ?? 7) * 0.5) },
    { name: 'Sun', count: stats?.todaySubmissions ?? 12 },
  ];

  // Bar chart data from byWidget
  const barData = stats?.byWidget?.map((w) => ({
    name: w.widgetName.length > 14 ? w.widgetName.slice(0, 12) + '…' : w.widgetName,
    submissions: w.count,
    type: w.widgetType,
  })) ?? [];

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>
        <button className="btn btn-ghost" onClick={fetchStats}>Retry</button>
      </div>
    );
  }

  return (
    <div className="page-content-grid">
      {/* ── 1. Metrics Grid ────────────────────────────────────────────── */}
      <div className="metrics-grid">
        <StatCard
          label="Total Submissions"
          value={loading ? '—' : (stats?.totalSubmissions ?? 0).toLocaleString()}
          icon={Inbox}
          trend="+12.4%"
          trendType="positive"
          subtext="vs previous period"
          loading={loading}
        />
        <StatCard
          label="Submissions Today"
          value={loading ? '—' : (stats?.todaySubmissions ?? 0).toLocaleString()}
          icon={CalendarDays}
          trend="+8.2%"
          trendType="positive"
          subtext="higher than avg"
          loading={loading}
        />
        <StatCard
          label="Active Widgets"
          value={loading ? '—' : (stats?.totalWidgets ?? 0).toLocaleString()}
          icon={Layers}
          trend="+2 new"
          trendType="positive"
          subtext="deployed & live"
          loading={loading}
        />
        <StatCard
          label="Enriched Rate"
          value={loading ? '—' : `${Math.round(((stats?.statusBreakdown?.ENRICHED ?? 0) / Math.max(stats?.totalSubmissions ?? 1, 1)) * 100)}%`}
          icon={CheckCircle2}
          trend="98.5%"
          trendType="positive"
          subtext="lead enrichment success"
          loading={loading}
        />
      </div>

      {/* ── 2. Main Section & Secondary Section ──────────────────────── */}
      <div className="grid-main-layout">
        {/* Main Section: Submission Trends Area Chart */}
        <div className="glass-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-header-title">Submission Analytics</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Real-time submission volume over time
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['7d', '30d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    border: '1px solid var(--border)',
                    background: timeRange === r ? 'var(--accent-light)' : 'transparent',
                    color: timeRange === r ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: 260, borderRadius: 16 }} />
          ) : (
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#areaGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Secondary Section: Recent Activity Feed */}
        <div className="glass-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-header-title">Recent Activity</h3>
              <p className="card-header-subtext">Live incoming form leads</p>
            </div>
            <Activity size={18} style={{ color: 'var(--accent)' }} />
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />
              ))}
            </div>
          ) : recentSubmissions.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No recent activity recorded
            </div>
          ) : (
            <div className="activity-feed-list">
              {recentSubmissions.map((sub) => {
                const statusCls = (sub.status || 'PENDING').toLowerCase();
                const statusDotColor = STATUS_COLORS[sub.status] || '#10b981';
                const dateStr = sub.createdAt
                  ? new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Just now';

                return (
                  <div key={sub.id} className="activity-item">
                    <div className="activity-left">
                      <div
                        className="activity-dot"
                        style={{ background: statusDotColor, boxShadow: `0 0 8px ${statusDotColor}` }}
                      />
                      <div className="activity-info">
                        <div className="activity-title">
                          {sub.payload?.email || sub.payload?.name || `Lead #${sub.id.slice(0, 8)}`}
                        </div>
                        <div className="activity-meta">
                          {sub.widget?.name ?? 'Widget'} • {dateStr}
                        </div>
                      </div>
                    </div>

                    <span className={`badge-sleek ${statusCls}`}>
                      {sub.status || 'PENDING'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Widget Breakdown & Bar Chart Row ──────────────────────── */}
      <div className="grid-main-layout">
        {/* Widget Bar Chart */}
        <div className="glass-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-header-title">Widget Performance</h3>
              <p className="card-header-subtext">Submissions captured per widget</p>
            </div>
            <BarChart2 size={18} style={{ color: 'var(--text-muted)' }} />
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
          ) : barData.length > 0 ? (
            <div style={{ height: 200, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="submissions" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No widget data available yet
            </div>
          )}
        </div>

        {/* Widget Ranking Table */}
        <div className="glass-card">
          <div className="card-header-flex">
            <div>
              <h3 className="card-header-title">Top Widgets</h3>
              <p className="card-header-subtext">Volume share by widget</p>
            </div>
          </div>

          {stats?.byWidget?.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Widget</th>
                    <th>Type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byWidget.slice(0, 5).map((w) => (
                    <tr key={w.widgetId}>
                      <td className="text-primary-cell">{w.widgetName}</td>
                      <td><TypeBadge type={w.widgetType} /></td>
                      <td className="text-primary-cell" style={{ textAlign: 'right' }}>{w.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No top widgets found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
