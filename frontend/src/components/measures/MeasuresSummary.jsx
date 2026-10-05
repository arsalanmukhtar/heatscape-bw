import { LuFileSpreadsheet, LuPrinter } from 'react-icons/lu';
import { t } from '../../i18n';
import { downloadCsv } from '../../lib/csv';
import { MEASURE_TYPES } from '../../lib/measures';
import { filterMeasures, useAllMeasures, useMeasures } from '../../state/measures';
import { fmtEffect, fmtInt } from './format';

const s = t.summary;
const done = (x) => x.status === 'completed' || x.status === 'monitored';

/** Measures in the summary: the register after the list's search and filters. */
function useSummaryMeasures() {
  const all = useAllMeasures();
  const { query, filters, sort } = useMeasures();
  return { all, rows: filterMeasures(all, { query, filters, sort }) };
}

function totals(rows) {
  const finished = rows.filter(done);
  return {
    count: rows.length,
    finished: finished.length,
    desealed: finished.filter((x) => x.type === 'desealing').reduce((a, x) => a + x.area, 0),
    trees: finished.reduce((a, x) => a + (x.trees ?? 0), 0),
    residents: finished.reduce((a, x) => a + (x.residents ?? 0), 0),
    cost: rows.reduce((a, x) => a + (x.cost ?? 0), 0),
  };
}

export function MeasuresSummaryBadge() {
  const { rows } = useSummaryMeasures();
  return (
    <span className="level-chip tabular-nums" style={{ '--chip': 'var(--text-muted)' }}>
      {s.badge(rows.length)}
    </span>
  );
}

const CSV_HEADER = ['ID', 'Name', 'Type', 'Status', 'District', 'Completed', 'Target', 'Area (m2)', 'Cost (EUR)', 'Funding', 'Office', 'Trees', 'Residents (est.)', 'LST before (C)', 'LST after (C)', 'DiD (C)', 'DiD low', 'DiD high', 'Confidence'];
const csvRow = (x) => [
  x.id,
  x.name,
  t.measures.types[x.type],
  t.measures.statuses[x.status],
  x.district,
  x.completed ?? '',
  x.target ?? '',
  x.area,
  x.cost,
  x.funding,
  x.office,
  x.trees ?? 0,
  x.residents ?? 0,
  x.effect?.lstBefore.med ?? '',
  x.effect?.lstAfter.med ?? '',
  x.effect?.did.med ?? '',
  x.effect?.did.lo ?? '',
  x.effect?.did.hi ?? '',
  x.effect?.confidence ?? '',
];

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/*
  Printable report for adaptation reporting (the browser's "Save as PDF"). A plain
  document in system colours (CanvasText/GrayText) so it prints in black on white
  whatever the app theme.
*/
function printReport(rows) {
  const tt = totals(rows);
  const win = window.open('', '_blank');
  if (!win) return;
  const tiles = [
    [s.tiles.measures, fmtInt(tt.count)],
    [s.tiles.desealed, `${fmtInt(tt.desealed)} m²`],
    [s.tiles.trees, fmtInt(tt.trees)],
    [s.tiles.residents, fmtInt(tt.residents)],
    [s.tiles.cost, `${fmtInt(tt.cost)} EUR`],
  ];
  win.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(s.reportTitle)}</title>
<style>
  body { font: 11px/1.4 'Urbanist', system-ui, sans-serif; color: CanvasText; background: Canvas; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 2px; } p.meta { color: GrayText; margin: 0 0 16px; }
  .tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
  .tile { border: 1px solid GrayText; padding: 8px; } .tile b { display: block; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid GrayText; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; } td.n { text-align: right; font-variant-numeric: tabular-nums; }
  p.note { color: GrayText; margin-top: 12px; } @page { size: A4 landscape; margin: 12mm; }
</style></head><body>
<h1>${esc(s.reportTitle)}</h1><p class="meta">${esc(s.reportMeta(new Date().toLocaleDateString('en-GB'), rows.length))}</p>
<div class="tiles">${tiles.map(([k, v]) => `<div class="tile">${esc(k)}<b>${esc(v)}</b></div>`).join('')}</div>
<table><thead><tr>${[s.col.name, s.col.type, s.col.status, s.col.district, s.col.completed, s.col.area, s.col.cost, s.col.funding, s.col.effect].map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
${rows
  .map(
    (x) =>
      `<tr><td>${esc(x.name)}</td><td>${esc(t.measures.types[x.type])}</td><td>${esc(t.measures.statuses[x.status])}</td><td>${esc(x.district)}</td><td>${esc(x.completed ?? x.target ?? '')}</td><td class="n">${esc(fmtInt(x.area))}</td><td class="n">${esc(fmtInt(x.cost))}</td><td>${esc(x.funding)}</td><td class="n">${esc(fmtEffect(x).text)}${x.effect ? ` (${esc(x.effect.confidence)})` : ''}</td></tr>`,
  )
  .join('')}
</tbody></table><p class="note">${esc(s.reportNote)}</p>
<script>window.onload = () => { window.focus(); window.print(); };</script></body></html>`);
  win.document.close();
}

export function MeasuresSummaryActions() {
  const { rows } = useSummaryMeasures();
  return (
    <>
      <span className="mr-1 text-xs text-muted">{s.exportLabel}</span>
      <button type="button" onClick={() => downloadCsv('heatscape-measures-report.csv', CSV_HEADER, rows.map(csvRow))} className="flex h-7 items-center gap-1.5 px-2 text-xs text-accent hover:bg-hover">
        <LuFileSpreadsheet size={12} aria-hidden />
        {/* All-caps labels: the uppercase class gives them cap-height centring beside the icon. */}
        <span className="uppercase">{s.csv}</span>
      </button>
      <button type="button" onClick={() => printReport(rows)} className="flex h-7 items-center gap-1.5 px-2 text-xs text-accent hover:bg-hover">
        <LuPrinter size={12} aria-hidden />
        <span className="uppercase">{s.pdf}</span>
      </button>
    </>
  );
}

function Tile({ label, value, hint }) {
  return (
    <div className="border border-border bg-surface-raised px-3 py-2.5">
      <p className="truncate text-2xs uppercase tracking-[var(--tracking-caps)] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text">{value}</p>
      {hint && <p className="truncate text-2xs text-muted">{hint}</p>}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {MEASURE_TYPES.map((m) => (
        <li key={m.id} className="flex items-center gap-1.5 text-2xs text-muted">
          <span className="size-2" style={{ background: m.color }} aria-hidden />
          <span>{t.measures.types[m.id]}</span>
        </li>
      ))}
    </ul>
  );
}

/* Stacked columns: measures per year (completion year, else target year), by type. */
function ByYear({ rows, large }) {
  const years = [...new Set(rows.map((x) => (x.completed ?? x.target ?? '').slice(0, 4)).filter(Boolean))].sort();
  const data = years.map((y) => ({ y, parts: MEASURE_TYPES.map((m) => rows.filter((x) => x.type === m.id && (x.completed ?? x.target ?? '').startsWith(y)).length) }));
  const max = Math.max(1, ...data.map((d) => d.parts.reduce((a, b) => a + b, 0)));
  const H = large ? 260 : 120;
  return (
    <section className="flex min-w-0 flex-col border-b border-border px-4 py-3 lg:border-b-0 lg:border-r">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h3 className="text-xs font-semibold text-text">{s.byYear}</h3>
          <p className="text-2xs text-muted">{s.byYearHint}</p>
        </div>
        <Legend />
      </div>
      <div className="flex items-end gap-2" style={{ height: H }}>
        {data.map((d) => {
          const total = d.parts.reduce((a, b) => a + b, 0);
          return (
            <div key={d.y} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-2xs tabular-nums text-text">{total}</span>
              {/* Segments stack bottom-up in type order, 2 px surface gaps between them. */}
              <div className="flex w-full max-w-10 flex-col-reverse gap-0.5" style={{ height: (total / max) * (H - 34) }}>
                {d.parts.map((n, i) =>
                  n ? (
                    <span key={MEASURE_TYPES[i].id} className="block w-full" style={{ flexGrow: n, background: MEASURE_TYPES[i].color }} title={`${d.y} · ${t.measures.types[MEASURE_TYPES[i].id]}: ${n}`} />
                  ) : null,
                )}
              </div>
              <span className="text-2xs tabular-nums text-muted">{d.y}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* Horizontal bars: footprint area by type (all statuses), labelled with values. */
function AreaByType({ rows }) {
  const data = MEASURE_TYPES.map((m) => ({ m, area: rows.filter((x) => x.type === m.id).reduce((a, x) => a + x.area, 0), n: rows.filter((x) => x.type === m.id).length }));
  const max = Math.max(1, ...data.map((d) => d.area));
  return (
    <section className="flex min-w-0 flex-col px-4 py-3">
      <div className="mb-2">
        <h3 className="text-xs font-semibold text-text">{s.byType}</h3>
        <p className="text-2xs text-muted">{s.byTypeHint}</p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {data.map(({ m, area, n }) => (
          <li key={m.id} className="grid grid-cols-[112px_1fr_88px] items-center gap-2" title={`${t.measures.types[m.id]}: ${fmtInt(area)} m² · ${s.measuresN(n)}`}>
            <span className="truncate text-2xs text-muted">{t.measures.types[m.id]}</span>
            <span className="relative h-3 bg-[var(--chart-grid)]">
              <span className="absolute inset-y-0 left-0" style={{ width: `${(area / max) * 100}%`, background: m.color }} />
            </span>
            <span className="text-right text-2xs tabular-nums text-text">{fmtInt(area)} m²</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MeasuresSummary({ large }) {
  const { all, rows } = useSummaryMeasures();
  const tt = totals(rows);
  const scope = rows.length === all.length ? s.scopeAll : s.scopeFiltered(rows.length, all.length);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="grid grid-cols-2 gap-2 px-4 pt-3 lg:grid-cols-4">
        <Tile label={s.tiles.measures} value={fmtInt(tt.count)} hint={s.tiles.measuresHint(tt.finished)} />
        <Tile label={s.tiles.desealed} value={`${fmtInt(tt.desealed)} m²`} hint={s.tiles.finishedOnly} />
        <Tile label={s.tiles.trees} value={fmtInt(tt.trees)} hint={s.tiles.finishedOnly} />
        <Tile label={s.tiles.residents} value={fmtInt(tt.residents)} hint={s.tiles.residentsHint} />
      </div>
      <p className="px-4 pt-1.5 text-2xs text-muted">{scope}</p>
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-2">
        <ByYear rows={rows} large={large} />
        <AreaByType rows={rows} />
      </div>
    </div>
  );
}
