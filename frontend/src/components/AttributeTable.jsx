import { useMemo } from 'react';
import { LuArrowDown, LuArrowUp, LuShare } from 'react-icons/lu';
import { BLOCKS } from '../data/mock';
import { t } from '../i18n';
import { downloadCsv } from '../lib/csv';
import { useWorkspace } from '../state/workspace';
import { FilterInput, matchesFilter } from './FilterInput';
import { SortTh } from './SortTh';

const RISK_ORDER = { Critical: 3, High: 2, Moderate: 1, Low: 0 };
const RISK_COLOR = {
  Critical: 'var(--level-severe)',
  High: 'var(--level-high)',
  Moderate: 'var(--level-moderate)',
  Low: 'var(--level-normal)',
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

/** Blocks after the text filter, in the current sort order, plus the click-to-sort cycle. */
function useTableRows() {
  const { sort, setSort, tableFilter } = useWorkspace();
  const rows = useMemo(() => {
    const kept = BLOCKS.filter((b) => matchesFilter(tableFilter, [b.id, b.district, b.avgTemp, b.peakTemp, b.sealing, b.greenCover, b.popDensity, b.risk]));
    if (!sort) return kept;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return kept.sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [sort, tableFilter]);
  // Click cycles: descending → ascending → unsorted.
  const sortBy = (key) => setSort(sort?.key === key ? (sort.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' });
  return { rows, sort, sortBy };
}

export function AttributeTableBadge() {
  const { rows } = useTableRows();
  return (
    <span className="level-chip tabular-nums" style={{ '--chip': 'var(--text-muted)' }}>
      {rows.length === BLOCKS.length ? t.table.rows(BLOCKS.length) : t.table.rowsOf(rows.length, BLOCKS.length)}
    </span>
  );
}

export function AttributeTableActions() {
  const { rows, sort, sortBy } = useTableRows();
  const { tableFilter, setTableFilter } = useWorkspace();
  const exportCsv = () =>
    downloadCsv(
      'heatscape-blocks.csv',
      COLUMNS.map((c) => c.label),
      rows.map((b) => [b.id, b.district, b.avgTemp, b.peakTemp, b.sealing, b.greenCover, b.popDensity, b.risk]),
    );

  return (
    <>
      <FilterInput value={tableFilter} onChange={setTableFilter} label={t.table.filter} />
      <button type="button" onClick={() => sortBy('peakTemp')} className="flex h-7 items-center gap-1 px-2 text-xs text-muted hover:bg-hover hover:text-text">
        <span>{t.table.sort}</span>
        {sort && (sort.dir === 'desc' ? <LuArrowDown size={11} /> : <LuArrowUp size={11} />)}
      </button>
      <button type="button" onClick={exportCsv} className="flex h-7 items-center gap-1.5 px-2 text-xs text-accent hover:bg-hover">
        <LuShare size={12} />
        <span>{t.table.exportCsv}</span>
      </button>
    </>
  );
}

export function AttributeTable() {
  const { rows, sort, sortBy } = useTableRows();
  const { selectedId, select } = useWorkspace();

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-[1] bg-surface-strong">
          <tr className="border-b border-border">
            {COLUMNS.map((c) => (
              <SortTh key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={sortBy} className="h-8 px-3 first:pl-4" />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-4 py-3 text-xs text-muted">
                {t.filter.noMatch}
              </td>
            </tr>
          )}
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
                <td className="px-3">
                  <span className="level-chip" style={{ '--chip': RISK_COLOR[b.risk] }}>
                    {b.risk}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
