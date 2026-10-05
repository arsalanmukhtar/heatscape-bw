import { t } from '../../i18n';
import { hoursAgo } from '../../state/admin';
import { ExpandButton, ExpandSlot } from '../Expandable';

const a = t.admin;

// Pipeline run states and alert severities use the status tokens (never heat levels).
export const STATUS_COLOR = { ok: 'var(--success)', running: 'var(--info)', failed: 'var(--danger)', paused: 'var(--text-muted)' };
export const SEVERITY_COLOR = { critical: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)' };

export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–');
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : a.catalog.open);
export const fmtInt = (n) => Number(n).toLocaleString('en-US');
/** "5 h ago" / "in 3 h" against the console clock. */
export const relTime = (iso) => {
  if (!iso) return '–';
  const h = hoursAgo(iso);
  return h >= 0 ? a.ago(h) : a.inH(-h);
};

/** Status word in the standard chip. */
export function Chip({ color, children, title }) {
  return (
    <span className="level-chip" style={{ '--chip': color }} title={title}>
      {children}
    </span>
  );
}

/** Page title row; stays at the top while the page scrolls under it. */
export function PageHead({ title, hint, actions }) {
  return (
    <div className="sticky top-0 z-10 mb-5 flex flex-wrap items-end gap-3 border-b border-border bg-bg px-6 py-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {actions}
    </div>
  );
}

/**
 * Bordered card with a caps title row. expandId makes it expandable (ExpandButton +
 * ExpandSlot); children may be a function of `large` for charts.
 */
export function Card({ title, hint, actions, expandId, className = '', children }) {
  const body = (large) => (typeof children === 'function' ? children(large) : children);
  return (
    <section className={`flex min-w-0 flex-col border border-border bg-surface ${className}`}>
      <div className="flex min-h-10 items-center gap-2 border-b border-border px-4 py-1.5">
        <div className="min-w-0 flex-1">
          <h2 className="label-caps truncate">{title}</h2>
          {hint && <p className="truncate text-2xs text-muted">{hint}</p>}
        </div>
        {actions}
        {expandId && <ExpandButton id={expandId} className="-mr-2" />}
      </div>
      {expandId ? (
        <ExpandSlot id={expandId} title={title} actions={actions}>
          {(large) => <div className="flex min-h-0 flex-1 flex-col">{body(large)}</div>}
        </ExpandSlot>
      ) : (
        body(false)
      )}
    </section>
  );
}

/** KPI tile: caps label, large value, optional hint. */
export function Kpi({ label, value, hint, tone }) {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <p className="truncate text-2xs uppercase tracking-[var(--tracking-caps)] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: tone ?? 'var(--text)' }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-2xs text-muted">{hint}</p>}
    </div>
  );
}

/** Table header/body styles shared by the admin tables. */
export const thCls = 'h-8 px-3 first:pl-4';
export const tdCls = 'h-9 px-3 align-middle first:pl-4';
export const trCls = 'border-b border-border-soft last:border-b-0';
