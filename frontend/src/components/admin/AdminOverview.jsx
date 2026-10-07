import { LuX } from 'react-icons/lu';
import { ADMIN_KPIS } from '../../data/mock';
import { t } from '../../i18n';
import { adminNow, useAdmin } from '../../state/admin';
import { SearchEmpty } from '../SearchBar';
import { Timeline } from './AdminCharts';
import { Card, Chip, fmtInt, Kpi, PageHead, relTime, SEVERITY_COLOR, STATUS_COLOR } from './AdminParts';

const a = t.admin;
const o = a.overview;

/** Overview: KPI tiles, the last 24 h of pipeline runs, open alerts. */
export function AdminOverview() {
  const { pipelines, runs, alerts, dismissed, dismissAlert } = useAdmin();
  const open = alerts.filter((x) => !dismissed.includes(x.id));
  const running = pipelines.filter((p) => p.status === 'running').length;
  const to = adminNow().getTime();
  const from = to - 24 * 3600e3;
  // Live runs per job (a running one ends now).
  const rows = pipelines.map((p) => ({
    id: p.id,
    label: `${p.name} · ${p.id}`,
    runs: (runs[p.id] ?? []).map((r) => {
      const start = new Date(r.start).getTime();
      return { id: r.id, start, end: r.status === 'running' ? to : start + r.duration * 1000, status: r.status, title: `${p.name}: ${a.status[r.status]}, ${a.duration(r.duration)}` };
    }),
  }));
  // Latest successful import of any job.
  const latest = Object.values(runs)
    .flat()
    .filter((r) => r.status === 'ok')
    .sort((m, n) => new Date(n.start) - new Date(m.start))[0];
  const latestName = latest && pipelines.find((p) => p.id === latest.job)?.name;

  return (
    <>
      <PageHead title={a.sections.overview} hint={a.hints.overview} />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label={o.kpis.datasets} value={fmtInt(ADMIN_KPIS.datasets)} />
          <Kpi label={o.kpis.latest} value={relTime(latest?.start)} hint={latestName} />
          <Kpi label={o.kpis.running} value={fmtInt(running)} tone={running ? 'var(--info)' : undefined} />
          <Kpi label={o.kpis.failed} value={fmtInt(pipelines.filter((p) => p.status === 'failed').length)} tone="var(--danger)" />
          <Kpi label={o.kpis.users} value={fmtInt(ADMIN_KPIS.activeUsers7d)} />
          <Kpi label={o.kpis.copilot} value={fmtInt(ADMIN_KPIS.copilot7d)} />
        </div>

        <Card
          title={o.timelineTitle}
          hint={o.timelineHint}
          expandId="admin-timeline"
          actions={
            <ul className="hidden items-center gap-3 sm:flex">
              {['ok', 'running', 'failed'].map((s) => (
                <li key={s} className="flex items-center gap-1.5 text-2xs text-muted">
                  <span className="size-2" style={{ background: STATUS_COLOR[s] }} aria-hidden />
                  <span>{a.status[s]}</span>
                </li>
              ))}
            </ul>
          }
        >
          {(large) => (
            <div className="px-4 py-3">
              <Timeline rows={rows} from={from} to={to} colorOf={(s) => STATUS_COLOR[s]} large={large} />
            </div>
          )}
        </Card>

        <Card title={`${o.alertsTitle} · ${open.length}`}>
          {open.length === 0 ? (
            <SearchEmpty>{o.noAlerts}</SearchEmpty>
          ) : (
            <ul>
              {open.map((al) => (
                <li key={al.id} className="flex items-center gap-3 border-b border-border-soft px-4 py-2.5 last:border-b-0">
                  <Chip color={SEVERITY_COLOR[al.severity]}>{a.severity[al.severity]}</Chip>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">{al.message}</p>
                    <p className="text-2xs text-muted">
                      {al.source} · {relTime(al.time)}
                    </p>
                  </div>
                  <button type="button" onClick={() => dismissAlert(al.id)} aria-label={o.dismiss} title={o.dismiss} className="grid size-7 shrink-0 place-items-center text-muted hover:text-accent">
                    <LuX size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
