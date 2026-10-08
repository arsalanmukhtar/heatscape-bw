import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BsFiletypeCsv } from 'react-icons/bs';
import { LuColumns3, LuFilter, LuLocateFixed, LuX } from 'react-icons/lu';
import { useMap } from 'react-map-gl/mapbox';
import { t } from '../i18n';
import { downloadCsv } from '../lib/csv';
import { flyToGeometry } from '../lib/geo';
import { extentGeometry, featureById, fieldText, isVector, layerById, layerRows } from '../lib/layers';
import { measureStatus, measureType } from '../lib/measures';
import { matchesSearch } from '../lib/search';
import { LIVE_LAYERS, useLive } from '../state/live';
import { LoaderBlock } from './Loader';
import { useMeasures } from '../state/measures';
import { useTableColumns } from '../state/tableColumns';
import { Checkbox } from './Checkbox';
import { useWorkspace } from '../state/workspace';
import { SearchBar, SearchEmpty } from './SearchBar';
import { SortTh } from './SortTh';

/*
  Attribute table of the layer picked in the Layers panel (table button). Columns come from the layer's fields (lib/layers.js); field.kind sets the cell look.
  Long tables render the first ROW_LIMIT rows; search and sorting narrow them, and the CSV
  export always holds every matching row (visible columns).
  Columns: fixed widths (no wrapping; long values end in …), resized by dragging the handle on
  a header's right edge, fitted to the longest value by double-clicking it; the table scrolls
  sideways when wider than the dock. The Columns menu shows and hides columns. Widths and
  hidden columns are saved per layer (state/tableColumns.js).
*/
const ROW_LIMIT = 500;

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
  // Full value on hover: columns are fixed-width and long values end in an ellipsis.
  const tip = cellText(field, value) || undefined;
  switch (field.kind) {
    case 'id':
      return <td title={tip} className={`px-3 pl-4 ${selected ? 'text-text' : 'text-muted'}`}>{value}</td>;
    case 'num':
      return <td title={tip} className="px-3 text-text">{Number(value).toFixed(1)}</td>;
    case 'temp':
      return <td title={tip} className={`px-3 ${tempClass(value)}`}>{Number(value).toFixed(1)}</td>;
    case 'pct':
      return <td title={tip} className="px-3 text-text">{value}%</td>;
    case 'green':
      return <td title={tip} className={`px-3 ${greenClass(value)}`}>{value}%</td>;
    case 'int':
      return <td title={tip} className="px-3 text-text">{Number(value).toLocaleString('en-US')}</td>;
    case 'measureType':
    case 'measureStatus':
      return (
        <td title={tip} className="px-3">
          <span className="level-chip" style={{ '--chip': (field.kind === 'measureType' ? measureType(value) : measureStatus(value)).color }}>
            {fieldText(field, value)}
          </span>
        </td>
      );
    case 'effect':
      return <td title={tip} className={`px-3 ${value == null ? 'text-muted' : 'text-text'}`}>{value == null ? t.measures.awaiting : `${fmtSigned(value)} °C`}</td>;
    case 'coord':
      return <td title={tip} className="px-3 font-mono text-muted">{Number(value).toFixed(4)}</td>;
    case 'chip':
      return (
        <td title={tip} className="px-3">
          <span className="level-chip" style={{ '--chip': CHIP_COLOR[value] ?? 'var(--text-muted)' }}>
            {value}
          </span>
        </td>
      );
    default:
      return <td title={tip} className="px-3 text-text">{value}</td>;
  }
}

const fmtSigned = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;

/** A cell's text as shown (chips: their label). */
function cellText(field, value) {
  if (value == null || value === '') return '';
  switch (field.kind) {
    case 'num':
    case 'temp':
      return Number(value).toFixed(1);
    case 'pct':
    case 'green':
      return `${value}%`;
    case 'int':
      return Number(value).toLocaleString('en-US');
    case 'effect':
      return `${fmtSigned(value)} °C`;
    case 'coord':
      return Number(value).toFixed(4);
    default:
      return String(fieldText(field, value));
  }
}

// Automatic column width (px at the 16 px base) by field kind, before any resizing.
const KIND_W = { id: 120, text: 190, num: 110, temp: 110, pct: 100, green: 100, int: 120, coord: 110, chip: 130, measureType: 130, measureStatus: 130, effect: 120 };
const CHIP_KINDS = new Set(['chip', 'measureType', 'measureStatus']);
let measureCtx = null;
/** Width in px of text in the given CSS font. */
function textWidth(text, font) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

const sortValue = (row, field) => (field?.kind === 'chip' ? (CHIP_ORDER[row[field.key]] ?? 0) : row[field?.key]);

const NO_ROWS = [];

/**
 * Rows of the table layer after search, in sort order, plus the click-to-sort cycle.
 * def is null when no layer's table is open (toggled off in the Layers panel).
 */
function useTableRows() {
  const { sort, setSort, tableFilter, tableLayer, tableQuery } = useWorkspace();
  useMeasures((s) => s.added); // re-read live layers (measures) when the register changes
  useMeasures((s) => s.statusLog);
  const def = layerById(tableLayer) ?? null;
  // A live layer opened in the table loads if it has not yet (lazy layers).
  useEffect(() => {
    if (tableLayer) useLive.getState().ensure(tableLayer);
  }, [tableLayer]);
  const layerAll = def ? layerRows(def) : NO_ROWS;
  // A query result from the Symbology Query tab narrows the table to its features.
  const all = useMemo(() => {
    if (!tableQuery || tableQuery.layer !== def?.id) return layerAll;
    const ids = new Set(tableQuery.ids);
    return layerAll.filter((r) => ids.has(r.id));
  }, [layerAll, tableQuery, def]);
  const rows = useMemo(() => {
    if (!def) return NO_ROWS;
    const kept = all.filter((r) => matchesSearch(tableFilter, def.fields.map((f) => fieldText(f, r[f.key]))));
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
  // Columns the user has not hidden (at least one stays).
  const hidden = useTableColumns((s) => (def ? s.hidden[def.id] : null));
  const fields = useMemo(() => {
    if (!def) return [];
    const shown = def.fields.filter((f) => !hidden?.includes(f.key));
    return shown.length ? shown : def.fields.slice(0, 1);
  }, [def, hidden]);
  return { def, all, rows, sort, sortBy, fields };
}

/** Columns menu: show or hide each column, show all, reset widths. */
function ColumnsMenu({ def }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // fixed position of the menu
  const ref = useRef(null);
  const menuRef = useRef(null);
  const toggle = () => {
    if (open) return setOpen(false);
    // Below the button when it fits, else above it; height limited to the room available.
    const r = ref.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 280 && above > below;
    setPos({ right: window.innerWidth - r.right, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }), maxHeight: Math.max(160, up ? above : below) });
    setOpen(true);
  };
  const { hidden, setHidden, showAll, resetWidths } = useTableColumns();
  const off = new Set(hidden[def.id] ?? []);
  const shownCount = def.fields.filter((f) => !off.has(f.key)).length;
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && !menuRef.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const c = t.table.columnsMenu;
  return (
    <div ref={ref} className="relative mr-1 shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={c.label(shownCount, def.fields.length)}
        title={c.label(shownCount, def.fields.length)}
        className={`relative grid size-7 place-items-center ${open ? 'bg-accent-soft text-accent' : shownCount < def.fields.length ? 'text-accent hover:bg-hover' : 'text-muted hover:bg-hover hover:text-text'}`}
      >
        <LuColumns3 size={14} aria-hidden />
        {/* Some columns hidden: a small accent mark. */}
        {shownCount < def.fields.length && <span className="absolute right-1 top-1 size-1.5 bg-accent" aria-hidden />}
      </button>
      {open &&
        pos &&
        createPortal(
        <div ref={menuRef} className="pop-in fixed z-[60] flex w-60 flex-col border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)]" style={pos}>
          <p className="label-caps shrink-0 border-b border-border px-3 py-2">{c.title}</p>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
            {def.fields.map((f) => {
              const on = !off.has(f.key);
              // The last visible column cannot be hidden.
              const locked = on && shownCount === 1;
              return (
                <li key={f.key}>
                  <label className={`flex h-8 items-center gap-2 px-3 text-xs ${locked ? 'opacity-50' : 'cursor-pointer hover:bg-hover'}`}>
                    <Checkbox checked={on} onChange={() => !locked && setHidden(def.id, f.key, on)} label={f.label} size="md" />
                    <span className="min-w-0 flex-1 truncate text-text">{f.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex shrink-0 divide-x divide-border border-t border-border">
            <button type="button" onClick={() => showAll(def.id)} className="h-8 flex-1 text-xs text-muted hover:bg-hover hover:text-text">
              {c.showAll}
            </button>
            <button type="button" onClick={() => resetWidths(def.id)} className="h-8 flex-1 text-xs text-muted hover:bg-hover hover:text-text">
              {c.resetWidths}
            </button>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
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
  const { def, rows, fields } = useTableRows();
  const { tableFilter, setTableFilter, tableQuery, clearTableQuery, tableFly, toggleTableFly } = useWorkspace();
  if (!def) return null;
  const exportCsv = () =>
    downloadCsv(
      `heatscape-${def.id}.csv`,
      fields.map((f) => f.label),
      rows.map((r) => fields.map((f) => fieldText(f, r[f.key]))),
    );

  return (
    <>
      {tableQuery?.layer === def.id && (
        <button
          type="button"
          onClick={clearTableQuery}
          title={`${t.table.queryResult}: ${tableQuery.sql}`}
          className="mr-1 flex h-7 max-w-36 shrink-0 items-center gap-1.5 border border-accent-line bg-accent-soft px-2 text-xs text-text hover:text-accent"
        >
          <LuFilter size={12} className="shrink-0" aria-hidden />
          <span className="truncate">{t.table.queryResult}</span>
          <LuX size={12} className="shrink-0" aria-hidden />
        </button>
      )}
      <SearchBar value={tableFilter} onChange={setTableFilter} placeholder={t.table.filter} className="mr-1 w-44 min-w-20 shrink" />
      <ColumnsMenu def={def} />
      {/* Features with geometry: row clicks fly to the feature and highlight it. */}
      {isVector(def) && (
        <button
          type="button"
          onClick={toggleTableFly}
          aria-pressed={tableFly}
          aria-label={t.table.flyTo}
          title={tableFly ? t.table.flyOn : t.table.flyOff}
          className={`mr-1 grid size-7 shrink-0 place-items-center ${tableFly ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-text'}`}
        >
          <LuLocateFixed size={14} aria-hidden />
        </button>
      )}
      <button type="button" onClick={exportCsv} aria-label={t.table.exportCsv} title={t.table.exportCsvHint} className="grid size-7 shrink-0 place-items-center text-accent hover:bg-hover">
        <BsFiletypeCsv size={15} aria-hidden />
      </button>
    </>
  );
}

export function AttributeTable() {
  const { def, rows, sort, sortBy, fields } = useTableRows();
  const widths = useTableColumns((s) => (def ? s.widths[def.id] : null));
  const setWidth = useTableColumns((s) => s.setWidth);
  const tableRef = useRef(null);
  const { main } = useMap();
  const { selectedId, select, tableFly, rowHighlight, setRowHighlight } = useWorkspace();
  const [picked, setPicked] = useState(null);
  // A live layer's first load from the backend shows the loader (no backdrop).
  const loading = useLive((s) => !!def && !!LIVE_LAYERS[def.id] && s.status[def.id] === 'loading' && !s.data[def.id]);
  if (!def) return <SearchEmpty>{t.table.noLayer}</SearchEmpty>;
  if (loading)
    return (
      <>
        <TableTitle def={def} />
        <LoaderBlock label={t.layers.live.loading} />
      </>
    );
  const shown = rows.slice(0, ROW_LIMIT);
  const isBlocks = def.id === 'blocks';

  const lit = (r) => rowHighlight?.layer === def.id && String(rowHighlight.id) === String(r.id);

  // Column widths in px at the 16 px base (rendered in rem, so they scale with the UI).
  const scale = () => (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
  const headerFont = () => {
    const th = tableRef.current?.querySelector('thead button');
    return th ? getComputedStyle(th).font : '500 11px sans-serif';
  };
  const autoWidth = (f) => {
    const own = widths?.[f.key];
    if (own) return own;
    const head = textWidth(f.label.toUpperCase(), headerFont()) / scale() + 40;
    return Math.max(KIND_W[f.kind] ?? 150, Math.min(head, 260));
  };
  const colW = Object.fromEntries(fields.map((f) => [f.key, autoWidth(f)]));
  const total = fields.reduce((sum, f) => sum + colW[f.key], 0);

  // Drag the handle: width follows the pointer; the cursor stays col-resize meanwhile.
  const startResize = (e, f) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const w0 = colW[f.key];
    const k = scale();
    const move = (ev) => setWidth(def.id, f.key, w0 + (ev.clientX - x0) / k);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('col-resizing');
    };
    document.body.classList.add('col-resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  // Double-click the handle: fit the column to its longest value (and its header).
  const fitColumn = (f) => {
    const td = tableRef.current?.querySelector('tbody td');
    const font = td ? getComputedStyle(td).font : '400 12px sans-serif';
    const k = scale();
    const pad = 30; // cell padding + room for the ellipsis-free fit
    let w = textWidth(f.label.toUpperCase(), headerFont()) + 40;
    if (CHIP_KINDS.has(f.kind)) w = Math.max(w, 96 * k + pad);
    else rows.slice(0, 5000).forEach((r) => (w = Math.max(w, textWidth(cellText(f, r[f.key]), font) + pad)));
    setWidth(def.id, f.key, w / k);
  };
  // A click selects the row (blocks: the Inspector's block) and highlights its feature in
  // yellow on the map and in the table, without moving the map; a second click on the same
  // row clears it. A double-click flies to the feature when "Fly to features" is on (its two
  // clicks are not taken as clear-again).
  const geometryOf = (r) => extentGeometry(featureById(def, r.id)) ?? (r.lon != null ? { type: 'Point', coordinates: [r.lon, r.lat] } : null);
  const pick = (r) => (isBlocks ? select(r.id, false) : setPicked(r.id));
  const onRow = (e, r) => {
    if (e.detail > 1) return;
    pick(r);
    setRowHighlight(lit(r) ? null : { layer: def.id, id: r.id });
  };
  const onRowDouble = (r) => {
    pick(r);
    setRowHighlight({ layer: def.id, id: r.id });
    const g = tableFly && geometryOf(r);
    if (g) flyToGeometry(main, g);
  };

  return (
    <>
    <TableTitle def={def} />
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <table ref={tableRef} className="table-fixed border-collapse text-xs [&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap" style={{ width: `max(100%, ${total / 16}rem)` }}>
        <colgroup>
          {fields.map((f) => (
            <col key={f.key} style={{ width: `${colW[f.key] / 16}rem` }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-[1] bg-surface-strong">
          <tr className="border-b border-border">
            {fields.map((f) => (
              <SortTh key={f.key} label={f.label} sortKey={f.key} sort={sort} onSort={sortBy} className="relative h-8 overflow-hidden whitespace-nowrap px-3 first:pl-4">
                {/* Excel-style resize handle on the right edge: drag to resize, double-click to fit. */}
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={t.table.resize(f.label)}
                  title={t.table.resizeHint}
                  onPointerDown={(e) => startResize(e, f)}
                  onDoubleClick={() => fitColumn(f)}
                  onClick={(e) => e.stopPropagation()}
                  className="group/rs absolute -right-px top-0 z-[2] flex h-full w-2 cursor-col-resize touch-none justify-center"
                >
                  <span className="h-full w-px bg-border transition-colors group-hover/rs:w-0.5 group-hover/rs:bg-accent" aria-hidden />
                </span>
              </SortTh>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const selected = isBlocks ? r.id === selectedId : r.id === picked;
            const hl = lit(r);
            return (
              <tr
                key={r.id}
                onClick={(e) => onRow(e, r)}
                onDoubleClick={() => onRowDouble(r)}
                aria-selected={selected}
                aria-current={hl ? 'true' : undefined}
                title={`${hl ? t.table.rowClear : t.table.rowHighlight}${tableFly ? ` · ${t.table.rowFly}` : ''}`}
                className={`h-[1.8125rem] cursor-pointer border-b border-border-soft tabular-nums ${
                  hl ? 'bg-[color-mix(in_srgb,var(--feature-highlight)_22%,transparent)] shadow-[inset_2px_0_0_var(--feature-highlight)]' : 'hover:bg-accent-soft'
                }`}
              >
                {fields.map((f) => (
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
    </>
  );
}

/** Thin full-width strip above the table naming the layer shown (accent, stays put while the table scrolls). */
function TableTitle({ def }) {
  return (
    <p className="h-6 shrink-0 truncate border-b border-accent-line bg-accent-soft px-4 text-center text-2xs font-semibold uppercase leading-6 tracking-[var(--tracking-caps)] text-accent" title={t.table.showing(def.label)}>
      {def.label}
    </p>
  );
}
