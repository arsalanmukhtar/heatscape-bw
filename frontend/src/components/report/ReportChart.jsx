import { fmtValue } from '../../lib/reportContent';

const ROW = 26;
const BAR = 12;
const LABEL_W = 200;
const VALUE_W = 52;
const AXIS_H = 22;

/** Round numbers for the axis: 0 plus 4–6 ticks covering [min, max]. */
function ticks(min, max) {
  const span = max - min || 1;
  const step = [1, 2, 5, 10, 20, 50].map((k) => k * 10 ** Math.floor(Math.log10(span / 5))).find((s) => span / s <= 6);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => +(lo + i * step).toFixed(6));
}

/*
  Horizontal bars from zero with 90 % / 10–90 % whiskers: one series, so one hue and no
  legend (the title names it); values are direct-labelled, text stays in text colours.
  Colours are tokens (the page scope is the light theme); the DOCX export resolves them.
*/
export function ReportChart({ rows, width, lang, color = 'var(--series-1)' }) {
  const values = rows.flatMap((r) => [r.lo, r.hi, 0]);
  const tk = ticks(Math.min(...values), Math.max(...values));
  const [d0, d1] = [tk[0], tk[tk.length - 1]];
  const plotW = width - LABEL_W - VALUE_W;
  const x = (v) => LABEL_W + ((v - d0) / (d1 - d0)) * plotW;
  const height = rows.length * ROW + AXIS_H;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} data-report-chart role="img" style={{ fontFamily: 'var(--font-sans)' }}>
      {tk.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={0} y2={rows.length * ROW} style={{ stroke: v === 0 ? 'var(--text-muted)' : 'var(--border-soft)' }} strokeWidth={1} />
          <text x={x(v)} y={rows.length * ROW + 15} textAnchor="middle" fontSize="10" style={{ fill: 'var(--text-muted)' }}>
            {fmtValue(v, Number.isInteger(v) ? 0 : 1, lang)}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = i * ROW + ROW / 2;
        const [a, b] = [x(Math.min(0, r.med)), x(Math.max(0, r.med))];
        return (
          <g key={r.label}>
            <text x={LABEL_W - 10} y={y + 3.5} textAnchor="end" fontSize="11" style={{ fill: 'var(--text)' }}>
              {r.label.length > 34 ? `${r.label.slice(0, 33)}…` : r.label}
            </text>
            <rect x={a} y={y - BAR / 2} width={Math.max(1, b - a)} height={BAR} style={{ fill: color }} />
            <line x1={x(r.lo)} x2={x(r.hi)} y1={y} y2={y} strokeWidth={1.25} style={{ stroke: 'var(--text)' }} />
            <line x1={x(r.lo)} x2={x(r.lo)} y1={y - 4} y2={y + 4} strokeWidth={1.25} style={{ stroke: 'var(--text)' }} />
            <line x1={x(r.hi)} x2={x(r.hi)} y1={y - 4} y2={y + 4} strokeWidth={1.25} style={{ stroke: 'var(--text)' }} />
            <text x={width - 4} y={y + 3.5} textAnchor="end" fontSize="11" fontWeight="600" style={{ fill: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtValue(r.med, 1, lang)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
