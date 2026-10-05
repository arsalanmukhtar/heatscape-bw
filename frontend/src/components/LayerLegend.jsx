import { useState } from 'react';
import { t } from '../i18n';
import { resolveColor, withAlpha } from '../lib/color';
import { legendFor } from '../lib/legend';
import { ICONS } from '../lib/mapImages';
import { dashArray } from '../lib/symbology';

const SHOWN = 6;

// Marker outlines in a -1…1 box (same shapes as lib/mapImages.js draws on the map).
const SHAPE_PATHS = {
  square: 'M-0.8 -0.8H0.8V0.8H-0.8Z',
  triangle: 'M0 -0.95L0.95 0.75H-0.95Z',
  diamond: 'M0 -1L1 0L0 1L-1 0Z',
  cross: 'M-0.32 -1H0.32V-0.32H1V0.32H0.32V1H-0.32V0.32H-1V-0.32H-0.32Z',
  star: Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 0.42 : 1;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`;
  }).join('') + 'Z',
  pin: 'M0 1C-0.15 0.55 -0.72 0.18 -0.72 -0.28A0.72 0.72 0 0 1 0.72 -0.28C0.72 0.18 0.15 0.55 0 1Z',
};

/*
  Legend symbols get a thin outline in the theme's strong border colour (OUTLINE), drawn just
  outside the symbol, so very light or very dark data colours never melt into the panel in
  either theme. Set in style (not attributes) so the CSS variable resolves.
*/
const OUTLINE = 'var(--border-strong)';
const ring = (width) => ({ fill: 'none', stroke: OUTLINE, strokeWidth: width });

/** One legend symbol (16 px), drawn from the layer's symbol settings. */
export function LegendSwatch({ swatch, box = 16 }) {
  const { geometry, symbol: s, color, size } = swatch;
  const c = resolveColor(color);
  const half = box / 2;

  if (geometry === 'raster') return <span className="block shrink-0 border border-border-strong" style={{ width: box - 4, height: box - 4, background: c }} aria-hidden />;

  if (geometry === 'line') {
    const w = Math.max(1, Math.min(4, size ?? s.width));
    const dash = dashArray(s.dash, s.customDash);
    const casing = s.casing ? w + 2 * Math.min(2, s.casingWidth) : 0;
    return (
      <svg width={box} height={box} className="shrink-0" aria-hidden>
        {/* Outline under the whole line (solid, so dashes keep a visible track). */}
        <line x1="1.5" x2={box - 1.5} y1={half} y2={half} strokeLinecap={s.cap} style={ring(Math.max(w, casing) + 1.5)} />
        {s.casing && <line x1="1.5" x2={box - 1.5} y1={half} y2={half} stroke={resolveColor(s.casingColor)} strokeWidth={casing} strokeLinecap={s.cap} />}
        <line x1="1.5" x2={box - 1.5} y1={half} y2={half} stroke={c} strokeOpacity={s.opacity} strokeWidth={w} strokeLinecap={s.cap} strokeDasharray={dash ? dash.map((d) => d * w).join(' ') : undefined} />
      </svg>
    );
  }

  if (geometry === 'polygon') {
    const id = `p${s.pattern}${c.replace(/[^a-z0-9]/gi, '')}`;
    const patterned = s.pattern !== 'solid' && !s.noFill;
    const sp = 4;
    return (
      <svg width={box} height={box} className="shrink-0" aria-hidden>
        {patterned && (
          <defs>
            <pattern id={id} width={sp} height={sp} patternUnits="userSpaceOnUse">
              {(s.pattern === 'hatch45' || s.pattern === 'cross') && <path d={`M0 ${sp}L${sp} 0`} stroke={c} strokeWidth="1" />}
              {(s.pattern === 'hatch135' || s.pattern === 'cross') && <path d={`M0 0L${sp} ${sp}`} stroke={c} strokeWidth="1" />}
              {s.pattern === 'horizontal' && <path d={`M0 ${sp / 2}H${sp}`} stroke={c} strokeWidth="1" />}
              {s.pattern === 'vertical' && <path d={`M${sp / 2} 0V${sp}`} stroke={c} strokeWidth="1" />}
              {s.pattern === 'dots' && <circle cx={sp / 2} cy={sp / 2} r="0.9" fill={c} />}
            </pattern>
          </defs>
        )}
        <rect x="0.5" y="0.5" width={box - 1} height={box - 1} style={ring(1)} />
        <rect
          x="2"
          y="2"
          width={box - 4}
          height={box - 4}
          fill={s.noFill ? 'none' : patterned ? `url(#${id})` : withAlpha(c, Math.max(0.25, s.fillOpacity))}
          stroke={s.outlineWidth > 0 ? resolveColor(s.outline) : 'none'}
          strokeWidth={Math.min(2, s.outlineWidth)}
        />
      </svg>
    );
  }

  // Point.
  const d = Math.max(4, Math.min(box - 2, size ?? s.size));
  const r = d / 2 - 0.5;
  const stroke = s.strokeWidth > 0 ? withAlpha(s.stroke, s.strokeOpacity) : 'none';
  const sw = Math.min(2, s.strokeWidth);
  const Icon = ICONS[s.marker];
  // Icon alone: a halo in the outline colour behind the glyph.
  if (Icon && !s.badge) return <Icon size={d} className="shrink-0" style={{ color: c, filter: `drop-shadow(0 0 0.6px ${OUTLINE}) drop-shadow(0 0 0.6px ${OUTLINE})` }} aria-hidden />;
  const round = Icon || s.marker === 'circle' || !SHAPE_PATHS[s.marker];
  const outer = r + sw / 2 + 0.75;
  return (
    <svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`} className="shrink-0" aria-hidden>
      {round ? (
        <>
          <circle r={outer} style={ring(1)} />
          <circle r={r} fill={withAlpha(c, s.fillOpacity)} stroke={stroke} strokeWidth={sw} />
        </>
      ) : (
        <>
          <path d={SHAPE_PATHS[s.marker]} transform={`scale(${r})`} strokeLinejoin="round" style={ring((sw + 2) / r)} />
          <path d={SHAPE_PATHS[s.marker]} transform={`scale(${r})`} fill={withAlpha(c, s.fillOpacity)} stroke={stroke} strokeWidth={sw / r} strokeLinejoin="round" />
        </>
      )}
      {Icon && <Icon x={-d * 0.3} y={-d * 0.3} size={d * 0.6} color={resolveColor(s.glyph)} />}
    </svg>
  );
}

/** Legend of one layer, generated from its style; long class lists fold after SHOWN rows. */
export function LayerLegend({ def, style, dim }) {
  const [all, setAll] = useState(false);
  const legend = legendFor(def, style);

  if (legend.ramp) {
    const { colors, min, max, discrete } = legend.ramp;
    const bg = discrete
      ? `linear-gradient(to right, ${colors.map((c, i) => `${c} ${(i / colors.length) * 100}% ${((i + 1) / colors.length) * 100}%`).join(', ')})`
      : `linear-gradient(to right, ${colors.join(', ')})`;
    return (
      <div className={`mt-1.5 transition-[opacity,filter] duration-200 ${dim ? 'opacity-25 grayscale' : ''}`}>
        <span className="block h-2 outline outline-1 outline-border-strong" style={{ background: bg }} aria-hidden />
        <span className="mt-1 flex justify-between text-2xs text-muted tabular-nums">
          <span>{min}</span>
          <span>{max}</span>
        </span>
      </div>
    );
  }

  const items = legend.items ?? [];
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <ul className={`mt-1 flex flex-col transition-[opacity,filter] duration-200 ${dim ? 'opacity-25 grayscale' : ''}`}>
      {shown.map((item, i) => (
        <li key={i} className="flex h-5 items-center gap-2">
          <LegendSwatch swatch={item.swatch} />
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{item.label}</span>
        </li>
      ))}
      {items.length > SHOWN && (
        <li>
          <button type="button" onClick={() => setAll(!all)} className="h-5 text-2xs text-muted hover:text-text">
            {all ? t.layers.legendLess : t.layers.legendMore(items.length - SHOWN)}
          </button>
        </li>
      )}
    </ul>
  );
}
