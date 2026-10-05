import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

/*
  Static abstract heat raster for the sign-in pages: a square-cell grid coloured from the
  heat ramp at low opacity over a dark grid, scaled to cover the panel (centred, cropped).
  Around the titles (the elements in `avoid`, measured live) the cells fade smoothly to a
  much lower opacity, with a little per-cell jitter so the edge reads as raster, not a box. Deterministic (same picture on every load).
  Decoration, not data: no legend, hidden from screen readers.
*/
const COLS = 36;
const ROWS = 48;
const OPACITY = 0.42;
const TEXT_OPACITY = 0.2; // cells right behind a title
const PAD = 8; // px around each title kept at the lowest opacity
const FADE = 140; // px over which the opacity rises back to normal
// Hot spots: centre x, centre y (0–1), radius, strength.
const SPOTS = [
  [0.32, 0.3, 0.17, 1],
  [0.68, 0.52, 0.2, 0.9],
  [0.42, 0.78, 0.13, 0.75],
  [0.84, 0.18, 0.1, 0.6],
  [0.12, 0.62, 0.09, 0.5],
];

// Small repeatable noise per cell so edges look like a raster, not a gradient.
const noise = (c, r) => {
  const x = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const CELLS = (() => {
  const out = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const x = c / COLS;
      const y = r / ROWS;
      let v = SPOTS.reduce((sum, [cx, cy, rad, k]) => sum + k * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * rad * rad)), 0);
      v += (noise(c, r) - 0.5) * 0.18;
      if (v < 0.14) continue;
      out.push({ c, r, level: Math.min(9, Math.max(1, Math.ceil(v * 9))) });
    }
  }
  return out;
})();

export function HeatVisual({ className = '', avoid = [] }) {
  const grid = `auth-grid-${useId().replace(/[^\w-]/g, '')}`; // unique: the page can show two copies
  const ref = useRef(null);
  const [frame, setFrame] = useState({ w: 0, h: 0, boxes: [] });

  // Measure the panel and the titles (fonts loading or a resize move them).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const p = el.getBoundingClientRect();
      const boxes = avoid
        .map((a) => a.current?.getBoundingClientRect())
        .filter((b) => b && b.width)
        .map((b) => ({ left: b.left - p.left - PAD, right: b.right - p.left + PAD, top: b.top - p.top - PAD, bottom: b.bottom - p.top + PAD }));
      setFrame({ w: p.width, h: p.height, boxes });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    avoid.forEach((a) => a.current && ro.observe(a.current));
    measure();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the refs are fixed for the page's life
  }, []);

  // Cover the panel: one cell size for both axes, grid centred and cropped.
  const size = Math.max(frame.w / COLS, frame.h / ROWS);
  const ox = (frame.w - COLS * size) / 2;
  const oy = (frame.h - ROWS * size) / 2;
  const key = JSON.stringify([frame.w, frame.h, frame.boxes.map((b) => [b.left, b.right, b.top, b.bottom].map(Math.round))]);
  const cells = useMemo(
    () =>
      CELLS.map((cell) => {
        const x = ox + cell.c * size;
        const y = oy + cell.r * size;
        // Distance from the cell centre to the nearest title box (0 inside it).
        const [cx, cy] = [x + size / 2, y + size / 2];
        const d = Math.min(Infinity, ...frame.boxes.map((b) => Math.hypot(Math.max(b.left - cx, 0, cx - b.right), Math.max(b.top - cy, 0, cy - b.bottom))));
        const t = Math.min(1, Math.max(0, d / FADE + (noise(cell.r, cell.c) - 0.5) * 0.35));
        const ease = t * t * (3 - 2 * t); // smoothstep
        return { ...cell, x, y, opacity: (TEXT_OPACITY + (OPACITY - TEXT_OPACITY) * ease).toFixed(3) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key stands for frame
    [key],
  );

  return (
    <div ref={ref} aria-hidden className={`overflow-hidden bg-bg-deep ${className}`}>
      {frame.w > 0 && (
        <svg width={frame.w} height={frame.h} className="block">
          <defs>
            <pattern id={grid} x={ox} y={oy} width={size} height={size} patternUnits="userSpaceOnUse">
              <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" strokeWidth="1" style={{ stroke: 'var(--border-soft)' }} />
            </pattern>
          </defs>
          {cells.map(({ c, r, x, y, level, opacity }) => (
            <rect key={`${c}-${r}`} x={x} y={y} width={size} height={size} opacity={opacity} style={{ fill: `var(--heat-${level})` }} />
          ))}
          <rect width="100%" height="100%" fill={`url(#${grid})`} />
        </svg>
      )}
    </div>
  );
}
