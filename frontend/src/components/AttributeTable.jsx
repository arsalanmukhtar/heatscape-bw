import { useMemo, useState } from 'react';
import { LuArrowDown, LuArrowUp, LuShare } from 'react-icons/lu';
import { useMap } from 'react-map-gl/mapbox';
import { t } from '../i18n';
import { downloadCsv } from '../lib/csv';
import { LAYERS, layerById, layerRows } from '../lib/layers';
import { matchesSearch } from '../lib/search';
import { useWorkspace } from '../state/workspace';
import { Select } from './controls';
import { SearchBar, SearchEmpty } from './SearchBar';
import { SortTh } from './SortTh';

/*
  Attribute table of the layer picked in the Layers panel (table button) or in the dock
  bar. Columns come from the layer's fields (lib/layers.js); field.kind sets the cell look.
  Long tables render the first ROW_LIMIT rows; search and sorting narrow them, and the CSV
  export always holds every matching row.
*/
const ROW_LIMIT = 500;
const VECTOR_LAYERS = LAYERS.filter((l) => l.data);

// Class words (risk, heat class) → level colours; order for sorting.
const CHIP_ORDER = { Critical: 4, Severe: 4, High: 3, Moderate: 2, Low: 1 };
const CHIP_COLOR = {
  Critical: 'var(--level-severe)',
  Severe: 'var(--level-severe)',
  High: 'var(--level-high)',
  Moderate: 'var(--level-moderate)',
  Low: 'var(--level-normal)',
};
const tempClass = (v) => (v >= 41 ? 'text-level-severe' : v >= 39 ? 'text-level-high' : v >= 36 ? 'text-level-moderate' : 'text-accent-2');
const greenClass = (v) => (v >= 20 ? 'text-level-normal' : 'text-accent-2');

function Cell({ field, value, selected }) {
  switch (field.kind) {
    case 'id':
      return <td className={`px-3 pl-4 ${selected ? 'text-text' : 'text-muted'}`}>{value}</td>;
    case 'num':
      return <td className="px-3 text-text">{Number(value).toFixed(1)}</td>;
    case 'temp':
      return <td className={`px-3 ${tempClass(value)}`}>{Number(value).toFixed(1)}</td>;
    case 'pct':
      return <td className="px-3 text-text">{value}%</td>;
    case 'green':
      return <td className={`px-3 ${greenClass(value)}`}>{value}%</td>;
    case 'int':
      return <td className="px-3 text-text">{Number(value).toLocaleString('en-US')}</td>;
    case 'coord':
      return <td className="px-3 font-mono text-muted">{Number(value).toFixed(4)}</td>;
    case 'chip':
      return (
        <td className="px-3">
          <span className="level-chip" style={{ '--chip': CHIP_COLOR[value] ?? 'var(--text-muted)' }}>
            {value}
          </span>
        </td>
      );
    default:
      return <td className="px-3 text-text">{value}</td>;
  }
}

const sortValue = (row, field) => (field?.kind === 'chip' ? (CHIP_ORDER[row[field.key]] ?? 0) : row[field?.key]);

const NO_ROWS = [];

/**
 * Rows of the table layer after search, in sort order, plus the click-to-sort cycle.
 * def is null when no layer's table is open (toggled off in the Layers panel).
 */
function useTableRows() {
  const { sort, setSort, tableFilter, tableLayer } = useWorkspace();
  const def = layerById(tableLayer) ?? null;
  const all = def ? layerRows(def) : NO_ROWS;
  const rows = useMemo(() => {
    if (!def) return NO_ROWS;
    const kept = all.filter((r) => matchesSearch(tableFilter, def.fields.map((f) => r[f.key])));
    if (!sort) return kept;
    const field = def.fields.find((f) => f.key === sort.key);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return kept.sort((a, b) => {
      const x = sortValue(a, field);
      const y = sortValue(b, field);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [all, def, sort, tableFilter]);
  // Click cycles: descending → ascending → unsorted.
  const sortBy = (key) => setSort(sort?.key === key ? (sort.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' });
  return { def, all, rows, sort, sortBy };
}

export function AttributeTableBadge() {
  const { def, all, rows } = useTableRows();
  if (!def) return null;
  return (
    <span className="level-chip tabular-nums" style={{ '--chip': 'var(--text-muted)' }}>
      {rows.length === all.length ? t.table.rows(all.length) : t.table.rowsOf(rows.length, all.length)}
    </span>
  );
}

export function AttributeTableActions() {
  const { def, rows, sort, sortBy } = useTableRows();
  const { tableFilter, setTableFilter, setTableLayer } = useWorkspace();
  const picker = (
    <Select
      value={def?.id ?? null}
      onChange={setTableLayer}
      options={VECTOR_LAYERS.map((l) => ({ value: l.id, label: l.label }))}
      label={t.table.layer}
      className="mr-1 w-40"
      renderValue={(o) => <span className={`min-w-0 flex-1 truncate ${o ? '' : 'text-faint'}`}>{o?.label ?? t.table.pickLayer}</span>}
    />
  );
  if (!def) return picker;
  // "Sort" orders by the layer's main measure (first temperature, else first number field).
  const main = def.fields.find((f) => f.kind === 'temp') ?? def.fields.find((f) => f.type === 'number' && f.kind !== 'coord');
  const exportCsv = () =>
    downloadCsv(
      `heatscape-${def.id}.csv`,
      def.fields.map((f) => f.label),
      rows.map((r) => def.fields.map((f) => r[f.key])),
    );

  return (
    <>
      {picker}
      <SearchBar value={tableFilter} onChange={setTableFilter} placeholder={t.table.filter} className="mr-1 w-56" />
      {main && (
        <button type="button" onClick={() => sortBy(main.key)} className="flex h-7 items-center gap-1 px-2 text-xs text-muted hover:bg-hover hover:text-text">
          <span>{t.table.sort}</span>
          {sort?.key === main.key && (sort.dir === 'desc' ? <LuArrowDown size={11} /> : <LuArrowUp size={11} />)}
        </button>
      )}
      <button type="button" onClick={exportCsv} className="flex h-7 items-center gap-1.5 px-2 text-xs text-accent hover:bg-hover">
        <LuShare size={12} />
        <span>{t.table.exportCsv}</span>
      </button>
    </>
  );
}

export function AttributeTable() {
  const { def, rows, sort, sortBy } = useTableRows();
  const { main } = useMap();
  const { selectedId, select } = useWorkspace();
  const [picked, setPicked] = useState(null);
  if (!def) return <SearchEmpty>{t.table.noLayer}</SearchEmpty>;
  const shown = rows.slice(0, ROW_LIMIT);
  const isBlocks = def.id === 'blocks';

  // Blocks select (inspector, map highlight); other features fly the map to them.
  const onRow = (r) => {
    if (isBlocks) return select(r.id);
    setPicked(r.id);
    main?.flyTo({ center: [r.lon, r.lat], zoom: Math.max(main.getZoom(), 14), duration: 800 });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-[1] bg-surface-strong">
          <tr className="border-b border-border">
            {def.fields.map((f) => (
              <SortTh key={f.key} label={f.label} sortKey={f.key} sort={sort} onSort={sortBy} className="h-8 px-3 first:pl-4" />
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const selected = isBlocks ? r.id === selectedId : r.id === picked;
            return (
              <tr
                key={r.id}
                onClick={() => onRow(r)}
                aria-selected={selected}
                className={`h-[29px] cursor-pointer border-b border-border-soft tabular-nums ${selected ? 'bg-accent-soft' : 'hover:bg-hover'}`}
              >
                {def.fields.map((f) => (
                  <Cell key={f.key} field={f} value={r[f.key]} selected={selected} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <SearchEmpty />}
      {rows.length > ROW_LIMIT && <p className="px-4 py-2 text-2xs text-muted">{t.table.limited(ROW_LIMIT, rows.length)}</p>}
    </div>
  );
}
