import { useState } from 'react';
import { LuPause, LuPlay, LuScrollText } from 'react-icons/lu';
import { t } from '../../i18n';
import { ATTRIBUTIONS, credit } from '../../lib/attribution';
import { useSearch } from '../../lib/search';
import { useSort } from '../../lib/useSort';
import { useAdmin } from '../../state/admin';
import { LoaderBlock } from '../Loader';
import { SearchBar, SearchEmpty } from '../SearchBar';
import { SortTh } from '../SortTh';
import { Bars } from './AdminCharts';
import { Card, Chip, fmtInt, fmtTime, PageHead, relTime, STATUS_COLOR, tdCls, thCls, trCls } from './AdminParts';

const a = t.admin;
const c = a.pipelines.columns;
const COLUMNS = ['name', 'schedule', 'lastRun', 'nextRun', 'status', 'records', 'duration'];
const searchValues = (p) => [p.name, p.id, p.source, p.schedule, a.status[p.status]];
const sortValue = (p, key) => (key === 'lastRun' || key === 'nextRun' ? p[key] ?? '' : p[key]);
const iconBtn = 'grid size-7 place-items-center text-muted hover:text-accent disabled:opacity-40 disabled:hover:text-muted';

/** Data pipelines (live: the worker's import jobs): table with actions, and the run history of the selected one. */
export function AdminPipelines() {
  const { pipelines, pipelinesStatus, pipelinesError, runs: runsByJob, selectedPipeline, selectPipeline, runNow, togglePause, showLogs } = useAdmin();
  const [query, setQuery] = useState('');
  const found = useSearch(pipelines, searchValues, query);
  const { rows, sort, sortBy } = useSort(found, sortValue);
  const sel = pipelines.find((p) => p.id === selectedPipeline);
  const runs = sel ? (runsByJob[sel.id] ?? []).slice(-14) : [];

  return (
    <>
      <PageHead title={a.sections.pipelines} hint={a.hints.pipelines} />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <Card title={`${a.sections.pipelines} · ${rows.length}`} expandId="admin-pipelines" actions={<SearchBar value={query} onChange={setQuery} placeholder={a.filter} className="w-48" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[53.75rem] border-collapse text-xs">
              <thead className="bg-surface-strong">
                <tr className="border-b border-border">
                  {COLUMNS.map((k) => (
                    <SortTh key={k} label={c[k]} sortKey={k} sort={sort} onSort={sortBy} align={k === 'records' || k === 'duration' ? 'right' : 'left'} className={thCls} />
                  ))}
                  <th scope="col" className={`${thCls} text-right text-2xs font-medium uppercase tracking-[var(--tracking-caps)] text-muted`}>
                    {c.actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} onClick={() => selectPipeline(p.id)} aria-selected={p.id === selectedPipeline} className={`${trCls} cursor-pointer ${p.id === selectedPipeline ? 'bg-accent-soft' : 'hover:bg-hover'}`}>
                    <td className={`${tdCls} py-2.5`}>
                      <span className="block text-text">{p.name}</span>
                      {/* Job, source and licence as chips, each in its own colour (full text on hover). */}
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {[
                          [p.id, 'var(--text-muted)', 'font-mono font-semibold', a.pipelines.job],
                          [p.source, 'var(--accent-2)', 'font-light', a.pipelines.source],
                          [p.licence, 'var(--success)', 'font-light', a.pipelines.licence],
                        ].map(([text, color, cls, kind]) => (
                          <span
                            key={kind}
                            className={`inline-block max-w-[20rem] truncate border border-[color-mix(in_srgb,var(--chip)_36%,transparent)] bg-[color-mix(in_srgb,var(--chip)_14%,transparent)] px-1.5 py-[3px] text-[0.625rem] leading-none text-[var(--chip)] ${cls}`}
                            style={{ '--chip': color }}
                            title={`${kind}: ${text}`}
                          >
                            {text}
                          </span>
                        ))}
                      </span>
                      {p.message && (
                        <span className="block max-w-[28rem] truncate text-2xs text-danger" title={p.message}>
                          {p.message}
                        </span>
                      )}
                    </td>
                    <td className={`${tdCls} text-text`}>{p.schedule}</td>
                    <td className={`${tdCls} text-text`} title={fmtTime(p.lastRun)}>
                      {relTime(p.lastRun)}
                    </td>
                    <td className={`${tdCls} text-text`} title={p.nextRun ? fmtTime(p.nextRun) : undefined}>
                      {p.paused ? '–' : !p.nextRun ? a.pipelines.manual : new Date(p.nextRun) <= Date.now() ? a.pipelines.due : relTime(p.nextRun)}
                    </td>
                    <td className={tdCls}>
                      <Chip color={STATUS_COLOR[p.status]}>{a.status[p.status]}</Chip>
                    </td>
                    <td className={`${tdCls} text-right tabular-nums text-text`}>{fmtInt(p.records)}</td>
                    <td className={`${tdCls} text-right tabular-nums text-text`}>{a.duration(p.duration)}</td>
                    <td className={tdCls}>
                      <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => runNow(p.id)} disabled={p.status === 'running' || p.status === 'queued'} aria-label={`${a.pipelines.runNow}: ${p.name}`} title={a.pipelines.runNow} className={iconBtn}>
                          <LuPlay size={14} />
                        </button>
                        <button type="button" onClick={() => togglePause(p.id)} disabled={p.status === 'running'} aria-label={`${p.status === 'paused' ? a.pipelines.resume : a.pipelines.pause}: ${p.name}`} title={p.status === 'paused' ? a.pipelines.resume : a.pipelines.pause} className={iconBtn}>
                          <LuPause size={14} />
                        </button>
                        <button type="button" onClick={() => showLogs(p.id)} aria-label={`${a.pipelines.logs}: ${p.name}`} title={a.pipelines.logs} className={iconBtn}>
                          <LuScrollText size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pipelinesStatus === 'loading' && !pipelines.length && <LoaderBlock label={a.pipelines.loading} />}
            {pipelinesStatus === 'error' && !pipelines.length && <SearchEmpty>{a.pipelines.loadError(pipelinesError)}</SearchEmpty>}
            {pipelinesStatus === 'ok' && pipelines.length === 0 && <SearchEmpty>{a.pipelines.empty}</SearchEmpty>}
            {pipelines.length > 0 && rows.length === 0 && <SearchEmpty />}
          </div>
        </Card>

        <Card
          title={sel ? a.pipelines.detailTitle(sel.name) : a.sections.pipelines}
          hint={a.pipelines.detailHint}
          expandId="admin-pipeline-runs"
          actions={
            <ul className="hidden items-center gap-3 sm:flex">
              {['ok', 'failed'].map((s) => (
                <li key={s} className="flex items-center gap-1.5 text-2xs text-muted">
                  <span className="size-2" style={{ background: STATUS_COLOR[s] }} aria-hidden />
                  <span>{a.status[s]}</span>
                </li>
              ))}
            </ul>
          }
        >
          {(large) =>
            sel ? (
              <div className="flex flex-col gap-2 px-4 py-3">
                <p className="text-xs text-muted">
                  {a.pipelines.source}: {sel.source} · {sel.schedule}
                </p>
                <p className="text-xs text-muted">
                  {a.pipelines.licence}:{' '}
                  <a href={ATTRIBUTIONS[sel.attribution]?.licenceUrl} target="_blank" rel="noopener noreferrer" className="text-text underline-offset-2 hover:text-accent hover:underline">
                    {sel.licence}
                  </a>{' '}
                  · {a.pipelines.credit}: {credit(sel.attribution)}
                </p>
                {/* Imported before the run log existed (or never run): no bars, a note instead. */}
                {runs.length === 0 ? (
                  <p className="border border-dashed border-border px-3 py-4 text-center text-xs text-muted">{a.pipelines.noRuns(sel.lastRun ? fmtTime(sel.lastRun) : null)}</p>
                ) : (
                <Bars
                  large={large}
                  format={(v) => a.duration(Math.round(v))}
                  data={runs.map((r) => ({
                    key: r.id,
                    label: new Date(r.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                    value: r.duration,
                    color: STATUS_COLOR[r.status],
                    title: `${fmtTime(r.start)} · ${a.status[r.status]} · ${a.duration(r.duration)} · ${fmtInt(r.records)} ${c.records.toLowerCase()}`,
                  }))}
                />
                )}
              </div>
            ) : (
              <SearchEmpty>{a.pipelines.pick}</SearchEmpty>
            )
          }
        </Card>
      </div>
    </>
  );
}
