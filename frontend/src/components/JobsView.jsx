import { useEffect, useRef, useState } from 'react';
import { LuMaximize2, LuMinimize2, LuSquareCheck, LuSquareX, LuTerminal, LuTrash2 } from 'react-icons/lu';
import { t } from '../i18n';
import { useJobs } from '../state/jobs';
import { useSearch } from '../lib/search';
import { useSort } from '../lib/useSort';
import { SearchBar, SearchEmpty } from './SearchBar';
import { SortTh } from './SortTh';

const fmtDuration = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const LEVEL_CLASS = { ERROR: 'text-danger', DONE: 'text-success' };
const STATUS_ORDER = { running: 3, queued: 2, error: 1, done: 0 };
const jobSearch = (j) => [j.id, j.name, j.tool, j.region, t.jobs.status[j.status], j.started];
const jobValue = (j, key) => (key === 'status' ? STATUS_ORDER[j.status] : key === 'duration' ? j.durationSec : j[key]);

export function JobsBadges() {
  const jobs = useJobs((s) => s.jobs);
  const running = jobs.filter((j) => j.status === 'running').length;
  const failed = jobs.filter((j) => j.status === 'error').length;
  return (
    <>
      {running > 0 && <span className="level-chip tabular-nums" style={{ '--chip': 'var(--info)' }}>{t.jobs.running(running)}</span>}
      {failed > 0 && <span className="level-chip tabular-nums" style={{ '--chip': 'var(--danger)' }}>{t.jobs.failed(failed)}</span>}
    </>
  );
}

export function JobsActions() {
  const { jobs, clearFinished, filter, setFilter } = useJobs();
  const finished = jobs.some((j) => j.status === 'done' || j.status === 'error');
  return (
    <>
      <SearchBar value={filter} onChange={setFilter} placeholder={t.jobs.filter} className="mr-1 w-56" />
      <button
        type="button"
        onClick={clearFinished}
        disabled={!finished}
        aria-label={t.jobs.clear}
        title={t.jobs.clear}
        className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <LuTrash2 size={14} />
      </button>
    </>
  );
}

export function JobsView() {
  const { jobs: all, selectedId, select, filter, sort: sortState, setSort } = useJobs();
  const filtered = useSearch(all, jobSearch, filter);
  const { rows: jobs, sort, sortBy } = useSort(filtered, jobValue, { state: sortState, setState: setSort });
  const job = all.find((j) => j.id === selectedId);
  const [logsWide, setLogsWide] = useState(false);

  return (
    <div className="flex min-h-0 flex-1">
      {!logsWide && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-[1] bg-surface-strong">
                <tr className="h-8 border-b border-border text-left">
                  {Object.entries(t.jobs.columns).map(([key, label]) => (
                    <SortTh key={key} label={label} sortKey={key} sort={sort} onSort={sortBy} className="px-3 first:pl-4" />
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const selected = j.id === selectedId;
                  return (
                    <tr
                      key={j.id}
                      onClick={() => select(j.id)}
                      aria-selected={selected}
                      className={`h-[1.8125rem] cursor-pointer border-b border-border-soft ${selected ? 'bg-accent-soft' : 'hover:bg-hover'}`}
                    >
                      <td className="px-3 pl-4">
                        <StatusCell status={j.status} />
                      </td>
                      <td className="px-3 text-text">{j.name}</td>
                      <td className="px-3 text-muted">{j.tool}</td>
                      <td className="px-3 text-muted">{j.region}</td>
                      <td className="px-3 font-mono text-text">{fmtDuration(j.durationSec)}</td>
                      <td className="px-3 font-mono text-muted">{j.started}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {jobs.length === 0 && <SearchEmpty>{all.length ? t.filter.noMatch : t.jobs.empty}</SearchEmpty>}
        </div>
      )}
      {job && <LogsPane job={job} wide={logsWide} onToggleWide={() => setLogsWide(!logsWide)} />}
    </div>
  );
}

/* Status is state, so it uses the status tokens and always pairs a mark with a word. */
function StatusCell({ status }) {
  const label = t.jobs.status[status];
  const mark =
    status === 'done' ? (
      <LuSquareCheck size={14} className="text-success" />
    ) : status === 'error' ? (
      <LuSquareX size={14} className="text-danger" />
    ) : status === 'running' ? (
      <span className="grid size-3 place-items-center border border-accent">
        <span className="size-1.5 bg-accent" />
      </span>
    ) : (
      <span className="size-3 bg-border-strong" />
    );
  return (
    <span className={`flex items-center gap-2 ${status === 'queued' ? 'text-muted' : 'text-text'}`}>
      <span className="grid w-3.5 place-items-center" aria-hidden>
        {mark}
      </span>
      <span>{label}</span>
    </span>
  );
}

function LogsPane({ job, wide, onToggleWide }) {
  const ref = useRef(null);

  // Follow the tail as new lines arrive.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [job.logs.length, job.id]);

  return (
    <section
      aria-label={t.jobs.logs(job.id)}
      className={`flex min-h-0 flex-col border-l border-border bg-bg-deep ${wide ? 'flex-1' : 'shrink-0'}`}
      style={wide ? undefined : { width: 'var(--dock-logs-w)' }}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
        <LuTerminal size={13} className="text-muted" aria-hidden />
        <h3 className="label-caps truncate">{t.jobs.logs(job.id)}</h3>
        <button
          type="button"
          onClick={onToggleWide}
          aria-label={wide ? t.jobs.restoreLogs : t.jobs.expandLogs}
          title={wide ? t.jobs.restoreLogs : t.jobs.expandLogs}
          className="ml-auto grid size-6 place-items-center text-muted hover:bg-hover hover:text-text"
        >
          {wide ? <LuMinimize2 size={12} /> : <LuMaximize2 size={12} />}
        </button>
      </div>
      <div ref={ref} className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-2xs leading-relaxed" role="log">
        {job.logs.length === 0 && <p className="text-muted">{t.jobs.noLogs}</p>}
        {job.logs.map((l, i) => (
          <p key={i} className={`whitespace-pre ${LEVEL_CLASS[l.level] ?? 'text-muted'}`}>
            [{l.time}] {l.level}: {l.msg}
          </p>
        ))}
        {job.status === 'running' && (
          <p className="mt-3 flex items-center gap-2 text-accent">
            <span className="h-3 w-1 bg-accent" aria-hidden />
            <span>{t.jobs.waiting}</span>
          </p>
        )}
      </div>
    </section>
  );
}
