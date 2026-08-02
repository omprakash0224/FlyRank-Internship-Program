import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Modern minimalist StatCard metric component.
 *
 * @param {{
 *   label: string,
 *   value: string | number,
 *   icon: React.ComponentType<{ size: number }>,
 *   trend?: string,
 *   trendType?: 'positive' | 'negative' | 'neutral',
 *   subtext?: string,
 *   loading?: boolean
 * }} props
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendType = 'positive',
  subtext,
  loading = false
}) {
  return (
    <div className="stat-card-redesign">
      <div className="stat-header">
        <div className="stat-icon-wrapper">
          <Icon size={20} />
        </div>
        {trend && (
          <div className={`stat-trend ${trendType}`}>
            {trendType === 'positive' && <TrendingUp size={12} />}
            {trendType === 'negative' && <TrendingDown size={12} />}
            {trendType === 'neutral' && <Minus size={12} />}
            <span>{trend}</span>
          </div>
        )}
      </div>

      <div className="stat-main">
        {loading ? (
          <div className="skeleton" style={{ height: 32, width: 100, marginBottom: 8 }} />
        ) : (
          <div className="stat-value-large">{value}</div>
        )}
        <div className="stat-label-text">{label}</div>
        {subtext && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{subtext}</div>}
      </div>
    </div>
  );
}
