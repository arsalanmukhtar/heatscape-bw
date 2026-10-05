import { useState } from 'react';
import { t } from '../../i18n';

const e = t.effect;

/*
  Summer LST per year for the measure footprint (line + interval band, --series-1) and its
  control area (dashed, muted), with a vertical line at the completion date. One y-axis
  (°C). Hovering a year shows its values; the legend names both series.
*/
export function EffectChart({ series, completed, large = false }) {
  const [hover, setHover] = useState(null);
  const W = large ? 900 : 300;
  const H = large ? 300 : 156;
  const PAD = { l: 30, r: 10, t: 14, b: 22 };
  const years = series.map((s) => s.year);
  const lo = Math.floor(Math.min(...series.map((s) => Math.min(s.mLo, s.cLo))) - 0.5);
  const hi = Math.ceil(Math.max(...series.map((s) => Math.max(s.mHi, s.cHi))) + 0.5);
  const x0 = years[0];
  const x1 = years[years.length - 1] + 1;
  const x = (yr) => PAD.l + ((yr - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const at = (s) => x(s.year + 0.6); // mid-July of each summer
  const done = completed ? Number(completed.slice(0, 4)) + (Number(completed.slice(5, 7)) - 0.5) / 12 : null;
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((v, i, a) => a.length <= 6 || (v - lo) % 2 === 0);
  const band = `${series.map((s) => `${at(s)},${y(s.mHi)}`).join(' ')} ${[...series].reverse().map((s) => `${at(s)},${y(s.mLo)}`).join(' ')}`;
  const line = (key) => series.map((s, i) => `${i ? 'L' : 'M'}${at(s)} ${y(s[key])}`).join('');
  const h = hover != null ? series[hover] : null;

  const onMove = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    let best = 0;
    series.forEach((s, i) => Math.abs(at(s) - px) < Math.abs(at(series[best]) - px) && (best = i));
    setHover(best);
  };

  return (
    <figure className="m-0">
      <figcaption className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="block h-0.5 w-4" style={{ background: 'var(--series-1)' }} aria-hidden />
          <span>{e.seriesMeasure}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="block w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--text-muted)' }} aria-hidden />
          <span>{e.seriesControl}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="block h-2.5 w-4" style={{ background: 'color-mix(in srgb, var(--series-1) 22%, transparent)' }} aria-hidden />
          <span>{e.seriesBand}</span>
        </span>
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={e.chartLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--chart-grid)' }} />
              <text x={PAD.l - 5} y={y(v)} dy="0.32em" textAnchor="end" fontSize="9" style={{ fill: 'var(--text-muted)' }} className="tabular-nums">
                {v}
              </text>
            </g>
          ))}
          <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} style={{ stroke: 'var(--chart-axis)' }} />
          {years.map((yr, i) => (large || i % 2 === 0 ? (
            <text key={yr} x={x(yr + 0.6)} y={H - 7} textAnchor="middle" fontSize="9" style={{ fill: 'var(--text-muted)' }} className="tabular-nums">
              {yr}
            </text>
          ) : null))}
          <polygon points={band} style={{ fill: 'color-mix(in srgb, var(--series-1) 22%, transparent)' }} />
          <path d={line('c')} fill="none" strokeWidth="1.5" strokeDasharray="4 3" style={{ stroke: 'var(--text-muted)' }} />
          <path d={line('m')} fill="none" strokeWidth="2" style={{ stroke: 'var(--series-1)' }} />
          {series.map((s) => (
            <circle key={s.year} cx={at(s)} cy={y(s.m)} r={large ? 3.5 : 2.6} strokeWidth="1.5" style={{ fill: 'var(--series-1)', stroke: 'var(--surface-strong)' }} />
          ))}
          {done != null && done >= x0 && done <= x1 && (
            <g>
              <line x1={x(done)} x2={x(done)} y1={PAD.t - 4} y2={H - PAD.b} strokeWidth="1.25" strokeDasharray="2 2" style={{ stroke: 'var(--text)' }} />
              <text x={x(done) + 4} y={PAD.t + 4} fontSize="9" fontWeight="600" style={{ fill: 'var(--text)' }}>
                {e.completedMark}
              </text>
            </g>
          )}
          {h && <line x1={at(h)} x2={at(h)} y1={PAD.t} y2={H - PAD.b} style={{ stroke: 'var(--border-strong)' }} />}
        </svg>
        {h && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 border border-border-strong bg-surface-strong px-2.5 py-1.5 text-2xs shadow-[var(--shadow-glass)]"
            style={at(h) / W > 0.6 ? { right: `${(1 - at(h) / W) * 100 + 2}%` } : { left: `${(at(h) / W) * 100 + 2}%` }}
          >
            <p className="font-semibold text-text">{e.summer(h.year)}</p>
            <p className="tabular-nums text-text">
              {e.seriesMeasure}: {h.m.toFixed(1)} °C ({h.mLo.toFixed(1)}–{h.mHi.toFixed(1)})
            </p>
            <p className="tabular-nums text-muted">
              {e.seriesControl}: {h.c.toFixed(1)} °C
            </p>
            <p className="tabular-nums text-muted">{e.scenes(h.n)}</p>
          </div>
        )}
      </div>
    </figure>
  );
}
