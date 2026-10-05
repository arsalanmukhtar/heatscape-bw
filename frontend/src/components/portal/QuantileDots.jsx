import { TEMP_DOMAIN } from '../../data/mock';
import { CITY_MEDIAN, divColor } from '../../lib/portal';

const W = 320;
const H = 104;
const PAD = 16;
const R = 5;
const BIN = 0.5; // °C per column
const BASE = H - 28;

/*
  Quantile dot plot: 20 dots, each one of 20 equally likely values of the place's surface
  temperature, stacked in 0.5 °C columns on a °C axis, with the Mannheim median marked.
  A wide spread reads as "less sure" without any statistics. Dots take the map's colour
  for their value (blue/green cooler, orange/red hotter than the median; redundant with position).
*/
export function QuantileDots({ values, label, medianLabel }) {
  const lo = Math.min(TEMP_DOMAIN[0], Math.floor(Math.min(...values)) - 1);
  const hi = Math.max(TEMP_DOMAIN[1], Math.ceil(Math.max(...values)) + 1);
  const x = (v) => PAD + ((v - lo) / (hi - lo)) * (W - 2 * PAD);
  const stacks = new Map();
  const dots = values.map((v) => {
    const bin = Math.round(v / BIN) * BIN;
    const n = stacks.get(bin) ?? 0;
    stacks.set(bin, n + 1);
    return { v, cx: x(bin), cy: BASE - R - n * (2 * R + 1) };
  });
  const ticks = [];
  for (let v = Math.ceil(lo / 2) * 2; v <= hi; v += 2) ticks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
      <line x1={x(CITY_MEDIAN)} x2={x(CITY_MEDIAN)} y1={10} y2={BASE} strokeDasharray="3 3" style={{ stroke: 'var(--text-muted)' }} />
      <text x={x(CITY_MEDIAN)} y={8} textAnchor="middle" fontSize="9" style={{ fill: 'var(--text-muted)' }}>
        {medianLabel}
      </text>
      <line x1={PAD} x2={W - PAD} y1={BASE} y2={BASE} style={{ stroke: 'var(--border-strong)' }} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={BASE} y2={BASE + 4} style={{ stroke: 'var(--border-strong)' }} />
          <text x={x(v)} y={BASE + 15} textAnchor="middle" fontSize="10" style={{ fill: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {v}
          </text>
        </g>
      ))}
      <text x={W - PAD} y={H - 2} textAnchor="end" fontSize="9" style={{ fill: 'var(--text-muted)' }}>
        °C
      </text>
      {/* Data marks may be round (design contract); a surface ring keeps neighbours apart. */}
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={R} style={{ fill: divColor(d.v), stroke: 'var(--surface-strong)' }} strokeWidth={1.5} />
      ))}
    </svg>
  );
}
