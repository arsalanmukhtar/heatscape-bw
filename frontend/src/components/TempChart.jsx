import { useId, useState } from 'react';

const W = 170;
const H = 104;
const PAD = { l: 20, r: 6, t: 6, b: 18 };

/**
 * Small line chart with a crosshair tooltip. One y-axis, recessive gridlines.
 * series: [{ name, values[], color, dashed? }] — the first series gets the area fill.
 */
export function TempChart({ labels, series, domain, ticks, unit }) {
  const [hover, setHover] = useState(null);
  const gradientId = useId();
  const [lo, hi] = domain;
  const x = (i) => PAD.l + ((W - PAD.l - PAD.r) * i) / (labels.length - 1);
  const y = (v) => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - lo) / (hi - lo));
  const path = (values) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const lead = series[0];

  return (
    <div className="flex gap-3">
      <div className="relative min-w-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full overflow-visible"
          role="img"
          aria-label={series.map((s) => `${s.name}: ${s.values.join(', ')} ${unit}`).join('; ')}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - box.left) / box.width) * W;
            const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (labels.length - 1));
            setHover(Math.max(0, Math.min(labels.length - 1, i)));
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={lead.color} stopOpacity="0.18" />
              <stop offset="1" stopColor={lead.color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
              <text x={PAD.l - 5} y={y(v)} dy="0.32em" textAnchor="end" fontSize="9" fill="var(--text-muted)">
                {v}
              </text>
            </g>
          ))}
          <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--chart-axis)" />
          {labels.map((l, i) => (
            <text key={l} x={x(i)} y={H - 5} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
              {l}
            </text>
          ))}

          <path d={`${path(lead.values)} L${x(labels.length - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`} fill={`url(#${gradientId})`} />

          {[...series].reverse().map((s) => (
            <g key={s.name}>
              <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.25 : 2} strokeDasharray={s.dashed ? '3 2.5' : undefined} />
              {!s.dashed && s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.6} fill={s.color} stroke="var(--surface-strong)" strokeWidth={1} />)}
            </g>
          ))}

          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--border-strong)" />}
        </svg>

        {hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 border border-border-strong bg-surface-strong px-2 py-1.5 text-2xs shadow-[var(--shadow-glass)]"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <p className="mb-0.5 font-semibold text-text">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center gap-1.5 whitespace-nowrap text-muted">
                <span className="inline-block h-0.5 w-2.5" style={{ background: s.color }} />
                {s.name}
                <span className="ml-auto pl-2 tabular-nums text-text">
                  {s.values[hover].toFixed(1)} {unit}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      <ul className="flex shrink-0 flex-col gap-2 pt-1 text-2xs text-muted">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5 whitespace-nowrap">
            <svg width="22" height="8" aria-hidden>
              <line x1="0" x2="22" y1="4" y2="4" stroke={s.color} strokeWidth={s.dashed ? 1.25 : 2} strokeDasharray={s.dashed ? '3 2.5' : undefined} />
              {!s.dashed && <circle cx="11" cy="4" r="2.6" fill={s.color} />}
            </svg>
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
