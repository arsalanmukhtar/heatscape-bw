import { useLayoutEffect, useRef, useState } from 'react';
import { rem, useRootScale } from '../../lib/useRootScale';

/** Width of an element, kept current on resize (charts draw at their real width). */
function useMeasuredWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/*
  Chart frame in design px (the 16px desktop base): the measured width divided by the UI
  scale, drawn through a viewBox at the real size, so heights, labels and bars scale with
  the root font size like the rest of the UI.
*/
function useWidth() {
  const [ref, real] = useMeasuredWidth();
  const k = useRootScale();
  return [ref, real / k, k];
}

const frame = (w, h, k) => ({ width: w * k, height: h * k, viewBox: `0 0 ${w} ${h}` });

const niceMax = (v) => {
  const p = 10 ** Math.floor(Math.log10(v || 1));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((m) => m >= v) ?? v;
};

/*
  Vertical bars from zero: one series in one hue, unless bars carry a status colour (the
  card then shows a legend naming the colours). Square ends (no rounded corners anywhere).
  Hover: a tooltip per bar (title).
*/
export function Bars({ data, height = 160, format = (v) => v, color = 'var(--series-1)', large = false }) {
  const [ref, w, k] = useWidth();
  const h = large ? height * 2 : height;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const left = 36;
  const bottom = 20;
  const plotW = Math.max(0, w - left - 4);
  const plotH = h - bottom - 8;
  const step = plotW / data.length;
  const bw = Math.max(2, Math.min(28, step - 2));
  const ticks = [0, 0.5, 1].map((k) => k * max);
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 48)));
  return (
    <div ref={ref} className="w-full">
      {w > 0 && (
        <svg {...frame(w, h, k)} role="img" className="block">
          {ticks.map((v) => {
            const y = 8 + plotH - (v / max) * plotH;
            return (
              <g key={v}>
                <line x1={left} x2={w - 4} y1={y} y2={y} style={{ stroke: v === 0 ? 'var(--border-strong)' : 'var(--border-soft)' }} />
                <text x={left - 6} y={y + 3} textAnchor="end" fontSize="10" style={{ fill: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {format(v)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const bh = (d.value / max) * plotH;
            const x = left + i * step + (step - bw) / 2;
            return (
              <g key={d.key}>
                <rect x={x} y={8 + plotH - bh} width={bw} height={Math.max(1, bh)} style={{ fill: d.color ?? color }}>
                  <title>{d.title ?? `${d.label}: ${format(d.value)}`}</title>
                </rect>
                {i % labelEvery === 0 && (
                  <text x={x + bw / 2} y={h - 6} textAnchor="middle" fontSize="10" style={{ fill: 'var(--text-muted)' }}>
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/**
 * Gantt-style timeline: one row per pipeline, a bar per run from start to end over
 * [from, to] (ms), coloured by run status (legend beside the chart).
 */
export function Timeline({ rows, from, to, colorOf, large = false }) {
  const [ref, w, k] = useWidth();
  const labelW = large ? 220 : 170;
  const rowH = large ? 30 : 24;
  const plotW = Math.max(0, w - labelW - 8);
  const x = (t) => labelW + ((t - from) / (to - from)) * plotW;
  const hours = Array.from({ length: 5 }, (_, i) => from + ((to - from) * i) / 4);
  const h = rows.length * rowH + 22;
  return (
    <div ref={ref} className="w-full">
      {w > 0 && (
        <svg {...frame(w, h, k)} role="img" className="block">
          {hours.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={rows.length * rowH} style={{ stroke: 'var(--border-soft)' }} />
              <text x={x(t)} y={h - 6} textAnchor="middle" fontSize="10" style={{ fill: 'var(--text-muted)' }}>
                {new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </text>
            </g>
          ))}
          {rows.map((r, i) => (
            <g key={r.id}>
              <text x={0} y={i * rowH + rowH / 2 + 3.5} fontSize="11" style={{ fill: 'var(--text)' }}>
                {r.label.length > (large ? 32 : 24) ? `${r.label.slice(0, large ? 31 : 23)}…` : r.label}
              </text>
              {r.runs
                .filter((run) => run.end > from && run.start < to)
                .map((run) => {
                  const x0 = x(Math.max(from, run.start));
                  const x1 = x(Math.min(to, run.end));
                  return (
                    <rect key={run.id} x={x0} y={i * rowH + 6} width={Math.max(3, x1 - x0)} height={rowH - 12} style={{ fill: colorOf(run.status) }}>
                      <title>{run.title}</title>
                    </rect>
                  );
                })}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

/** Small trend line (e.g. evaluation pass rate over runs). */
export function Sparkline({ values, width = 120, height = 32, color = 'var(--series-1)' }) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6)]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: rem(width), height: rem(height) }} aria-hidden className="block">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" strokeWidth={2} style={{ stroke: color }} />
      <rect x={pts[pts.length - 1][0] - 3} y={pts[pts.length - 1][1] - 3} width={6} height={6} style={{ fill: color }} />
    </svg>
  );
}
