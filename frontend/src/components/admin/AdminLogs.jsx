import { useEffect, useMemo, useRef } from 'react';
import { LuChevronDown, LuChevronUp, LuScrollText } from 'react-icons/lu';
import { t } from '../../i18n';
import { matchesSearch } from '../../lib/search';
import { useAdmin } from '../../state/admin';
import { Check, Select } from '../controls';
import { ResizeHandle } from '../ResizeHandle';
import { SearchBar, SearchEmpty } from '../SearchBar';

const a = t.admin;
const l = a.logs;
const LEVEL_COLOR = { info: 'var(--text-muted)', warn: 'var(--warning)', error: 'var(--danger)' };
const DOCK_MIN = 120;

/** Bottom dock: pipeline runs (live) and console actions, filtered by source, level and text; follows new lines. */
export function AdminLogs() {
  const { logs, logFilter, setLogFilter, follow, setFollow, dockOpen, toggleDock, dockH, setDockH, pipelines } = useAdmin();
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const sources = useMemo(() => [...new Set([...pipelines.map((p) => p.id), ...logs.map((x) => x.source)])], [pipelines, logs]);
  const nameOf = (id) => pipelines.find((p) => p.id === id)?.name ?? id;
  const shown = logs.filter(
    (x) => (!logFilter.source || x.source === logFilter.source) && (!logFilter.level || x.level === logFilter.level) && matchesSearch(logFilter.query, [x.message, x.source]),
  );

  useEffect(() => {
    if (follow && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [shown.length, follow, dockOpen]);

  return (
    <section ref={ref} aria-label={l.title} className="relative flex shrink-0 flex-col border-t border-border bg-surface" style={{ height: dockOpen ? (dockH ?? 'var(--dock-open-h)') : 'var(--dock-bar-h)' }}>
      {dockOpen && (
        <ResizeHandle
          edge="top"
          label={`Resize ${l.title}`}
          getSize={() => ref.current?.getBoundingClientRect().height ?? 0}
          onResize={(h) => setDockH(Math.max(DOCK_MIN, Math.min(window.innerHeight - 200, h)))}
          onReset={() => setDockH(null)}
        />
      )}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4" style={{ height: 'var(--dock-bar-h)' }}>
        <LuScrollText size={13} className="shrink-0 text-muted" aria-hidden />
        <span className="text-2xs font-semibold uppercase tracking-[var(--tracking-caps)] text-text">{l.title}</span>
        <span className="level-chip tabular-nums" style={{ '--chip': 'var(--text-muted)' }}>
          {l.count(shown.length)}
        </span>
        {dockOpen && (
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            <Select value={logFilter.source} onChange={(source) => setLogFilter({ source })} label={l.all} className="w-48" options={[{ value: '', label: l.all }, ...sources.map((s) => ({ value: s, label: nameOf(s) }))]} />
            <Select value={logFilter.level} onChange={(level) => setLogFilter({ level })} label={l.allLevels} className="w-32" options={[{ value: '', label: l.allLevels }, ...Object.keys(l.levels).map((k) => ({ value: k, label: l.levels[k] }))]} />
            <SearchBar value={logFilter.query} onChange={(query) => setLogFilter({ query })} placeholder={a.filter} className="w-44 min-w-24 shrink" />
            <Check checked={follow} onChange={setFollow} label={l.follow} />
          </div>
        )}
        <button
          type="button"
          onClick={toggleDock}
          aria-label={dockOpen ? l.collapse : l.expand}
          title={dockOpen ? l.collapse : l.expand}
          className={`grid size-7 shrink-0 place-items-center text-muted hover:bg-hover hover:text-text ${dockOpen ? '' : 'ml-auto'}`}
        >
          {dockOpen ? <LuChevronDown size={15} /> : <LuChevronUp size={15} />}
        </button>
      </div>
      {dockOpen && (
        <div ref={bodyRef} role="log" aria-live="off" className="min-h-0 flex-1 overflow-auto px-4 py-2 font-mono text-2xs leading-relaxed">
          {shown.length === 0 ? (
            <SearchEmpty>{l.empty}</SearchEmpty>
          ) : (
            shown.map((x, i) => (
              <div key={`${x.time}-${i}`} className="flex gap-3 whitespace-pre-wrap">
                <span className="shrink-0 tabular-nums text-muted">{new Date(x.time).toLocaleTimeString('en-GB')}</span>
                <span className="w-10 shrink-0 uppercase" style={{ color: LEVEL_COLOR[x.level] }}>
                  {x.level}
                </span>
                <span className="w-32 shrink-0 truncate text-muted" title={nameOf(x.source)}>{x.source}</span>
                <span className="min-w-0 flex-1 text-text">{x.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
