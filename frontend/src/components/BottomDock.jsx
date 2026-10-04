import { useMemo, useRef } from 'react';
import { LuArrowDown, LuArrowUp, LuChevronDown, LuChevronUp, LuShare } from 'react-icons/lu';
import { BLOCKS } from '../data/mock';
import { t } from '../i18n';
import { DOCK_MIN, useLayout } from '../state/layout';
import { downloadCsv } from '../lib/csv';
import { useWorkspace } from '../state/workspace';
import { ResizeHandle } from './ResizeHandle';

const RISK_ORDER = { Critical: 3, High: 2, Moderate: 1, Low: 0 };
const RISK_CLASS = {
  Critical: 'text-level-severe',
  High: 'text-level-high',
  Moderate: 'text-level-moderate',
  Low: 'text-level-normal',
};

const peakClass = (v) => (v >= 41 ? 'text-level-severe' : v >= 39 ? 'text-level-high' : v >= 36 ? 'text-level-moderate' : 'text-accent-2');
const greenClass = (v) => (v >= 20 ? 'text-level-normal' : 'text-accent-2');

const COLUMNS = [
  { key: 'id', label: t.table.columns.id },
  { key: 'district', label: t.table.columns.district },
  { key: 'avgTemp', label: t.table.columns.avgTemp },
  { key: 'peakTemp', label: t.table.columns.peakTemp },
  { key: 'sealing', label: t.table.columns.sealing },
  { key: 'greenCover', label: t.table.columns.greenCover },
  { key: 'popDensity', label: t.table.columns.popDensity },
  { key: 'risk', label: t.table.columns.risk },
];

const sortValue = (b, key) => (key === 'risk' ? RISK_ORDER[b.risk] : b[key]);

export function BottomDock() {
  const ref = useRef(null);
  const { dockOpen, dockH, setDockH, toggleDock, dragging } = useLayout();
  const { selectedId, select, sort, setSort } = useWorkspace();

  const rows = useMemo(() => {
    if (!sort) return BLOCKS;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...BLOCKS].sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [sort]);

  // Click cycles: descending → ascending → unsorted.
  const sortBy = (key) => setSort(sort?.key === key ? (sort.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' });

  const exportCsv = () =>
    downloadCsv(
      'heatscape-blocks.csv',
      COLUMNS.map((c) => c.label),
      rows.map((b) => [b.id, b.district, b.avgTemp, b.peakTemp, b.sealing, b.greenCover, b.popDensity, b.risk]),
    );

  const height = dockOpen ? (dockH != null ? `${dockH}px` : 'var(--dock-open-h)') : 'var(--dock-bar-h)';

  return (
    <section
      ref={ref}
      aria-label={t.table.title}
      className={`relative flex shrink-0 flex-col border-t border-border bg-surface ${dragging ? '' : 'layout-transition'}`}
      style={{ height }}
    >
      {dockOpen && (
        <ResizeHandle
          edge="top"
          label={`Resize ${t.table.title}`}
          getSize={() => ref.current?.getBoundingClientRect().height ?? 0}
          onResize={(h) => {
            const max = (ref.current?.parentElement?.getBoundingClientRect().height ?? 800) - 160;
            setDockH(Math.max(DOCK_MIN, Math.min(max, h)));
          }}
          onReset={() => setDockH(null)}
        />
      )}

      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4" style={{ height: 'var(--dock-bar-h)' }}>
        <h2 className="text-xs font-medium uppercase tracking-[var(--tracking-caps)] text-text">{t.table.title}</h2>
        <span className="border border-border px-1.5 py-0.5 text-2xs tabular-nums text-muted">{t.table.rows(rows.length)}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => sortBy('peakTemp')} className="flex h-7 items-center gap-1 px-2 text-xs text-muted hover:bg-hover hover:text-text">
            {t.table.sort}
            {sort && (sort.dir === 'desc' ? <LuArrowDown size={11} /> : <LuArrowUp size={11} />)}
          </button>
          <button type="button" onClick={exportCsv} className="flex h-7 items-center gap-1.5 px-2 text-xs text-accent hover:bg-hover">
            <LuShare size={12} />
            {t.table.exportCsv}
          </button>
          <button
            type="button"
            onClick={toggleDock}
            aria-label={dockOpen ? t.table.collapse : t.table.expand}
            title={dockOpen ? t.table.collapse : t.table.expand}
            className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text"
          >
            {dockOpen ? <LuChevronDown size={15} /> : <LuChevronUp size={15} />}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto" inert={!dockOpen}>
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-[1] bg-surface-strong">
            <tr className="border-b border-border">
              {COLUMNS.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className="h-8 px-3 text-left font-medium first:pl-4"
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(c.key)}
                      className={`flex items-center gap-1 text-2xs uppercase tracking-[var(--tracking-caps)] ${active ? 'text-text' : 'text-muted hover:text-text'}`}
                    >
                      {c.label}
                      {active && (sort.dir === 'desc' ? <LuArrowDown size={10} /> : <LuArrowUp size={10} />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const selected = b.id === selectedId;
              return (
                <tr
                  key={b.id}
                  onClick={() => select(b.id)}
                  aria-selected={selected}
                  className={`h-[29px] cursor-pointer border-b border-border-soft tabular-nums ${selected ? 'bg-accent-soft' : 'hover:bg-hover'}`}
                >
                  <td className={`px-3 pl-4 ${selected ? 'text-text' : 'text-muted'}`}>{b.id}</td>
                  <td className="px-3 text-text">{b.district}</td>
                  <td className="px-3 text-text">{b.avgTemp.toFixed(1)}</td>
                  <td className={`px-3 ${peakClass(b.peakTemp)}`}>{b.peakTemp.toFixed(1)}</td>
                  <td className="px-3 text-text">{b.sealing}%</td>
                  <td className={`px-3 ${greenClass(b.greenCover)}`}>{b.greenCover}%</td>
                  <td className="px-3 text-text">{b.popDensity.toLocaleString('en-US')}</td>
                  <td className={`px-3 ${RISK_CLASS[b.risk]}`}>{b.risk}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
