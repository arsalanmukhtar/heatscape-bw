import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuPipette } from 'react-icons/lu';
import { t } from '../i18n';
import { parseColor, resolveColor, toHex } from '../lib/color';

/*
  Colour picker popover (replaces the browser's native picker): saturation/value square,
  hue and opacity bars, hex + opacity inputs, an eyedropper where the browser has one, and
  three rows of presets (neutrals with transparent and black, vivid colours, data tokens).
  Token presets keep their var(--…) reference so they follow the theme.
  Output: #rrggbb, or #rrggbbaa when opacity is below 100 %.
*/
const PRESETS = [
  ['transparent', '#000000', '#1f2328', '#3d434b', '#6b7280', '#9aa3ad', '#c9ced6', '#e5e7eb', '#f5f5f5', '#ffffff'],
  ['#d7191c', '#f46d43', '#fdae61', '#fee08b', '#a6d96a', '#1a9641', '#00a6a6', '#2c7bb6', '#5e4fa2', '#c51b7d'],
  ['var(--heat-3)', 'var(--heat-5)', 'var(--heat-7)', 'var(--heat-9)', 'var(--vuln-3)', 'var(--vuln-6)', 'var(--vuln-9)', 'var(--seal-3)', 'var(--seal-6)', 'var(--accent-2)'],
];
export const CHECKER = 'repeating-conic-gradient(var(--border-strong) 0 25%, transparent 0 50%) 0 0 / 8px 8px';
const WIDTH = 248;

function rgbToHsv({ r, g, b }) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  let h = 0;
  if (d) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

function hsvToRgb({ h, s, v }) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return { r: f(5), g: f(3), b: f(1) };
}

const out = (hsv, a) => {
  const hex = toHex(hsvToRgb(hsv));
  return a < 1 ? `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}` : hex;
};

/** Pointer drag on an element, reporting x/y as 0–1 fractions. */
function useDrag(onMove) {
  return (e) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const report = (ev) => {
      const r = el.getBoundingClientRect();
      onMove(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
    };
    report(e);
    const move = (ev) => report(ev);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
}

/** Popover with the picker, anchored to `anchor` (a DOM element). */
export function ColorPicker({ value, onChange, onClose, anchor, label }) {
  const start = parseColor(value) ?? { r: 0, g: 0, b: 0, a: 1 };
  const [hsv, setHsv] = useState(() => rgbToHsv(start));
  const [alpha, setAlpha] = useState(start.a);
  const [hex, setHex] = useState(toHex(start).toUpperCase());
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  // Keep local state in step when the value changes from outside (presets, undo).
  useEffect(() => {
    const c = parseColor(value);
    if (!c) return;
    if (toHex(hsvToRgb(hsv)) !== toHex(c)) setHsv(rgbToHsv(c));
    setAlpha(c.a);
    setHex(toHex(c).toUpperCase());
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const r = anchor?.getBoundingClientRect();
    if (!r) return;
    const h = ref.current?.offsetHeight ?? 340;
    const below = window.innerHeight - r.bottom > h + 8;
    const left = Math.max(8, Math.min(window.innerWidth - WIDTH - 8, r.left));
    setPos(below ? { left, top: r.bottom + 4 } : { left, top: Math.max(8, r.top - h - 4) });
  }, [anchor]);

  useEffect(() => {
    const away = (e) => !ref.current?.contains(e.target) && !anchor?.contains(e.target) && onClose();
    const esc = (e) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    const scroll = (e) => !ref.current?.contains(e.target) && onClose();
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc, true);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc, true);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [anchor, onClose]);

  const emit = (nextHsv, nextAlpha) => {
    setHsv(nextHsv);
    setAlpha(nextAlpha);
    setHex(toHex(hsvToRgb(nextHsv)).toUpperCase());
    onChange(out(nextHsv, nextAlpha));
  };
  const dragSV = useDrag((x, y) => emit({ ...hsv, s: x, v: 1 - y }, alpha));
  const dragHue = useDrag((x) => emit({ ...hsv, h: x * 359.9 }, alpha));
  const dragAlpha = useDrag((x) => emit(hsv, Math.round(x * 100) / 100));
  const rgb = hsvToRgb(hsv);
  const solid = toHex(rgb);

  const pickScreen = async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      const c = parseColor(sRGBHex);
      if (c) emit(rgbToHsv(c), alpha);
    } catch {
      /* cancelled */
    }
  };

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="fixed z-[70] flex flex-col gap-2.5 border border-border-strong bg-surface-strong p-2.5 shadow-[var(--shadow-glass)]"
      style={{ width: WIDTH, ...(pos ?? { left: -9999, top: 0 }) }}
    >
      {/* Saturation (x) × value (y) for the current hue. */}
      <div
        onPointerDown={dragSV}
        className="relative h-36 cursor-crosshair touch-none"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
      >
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: solid }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="relative size-8 shrink-0 border border-border-strong" style={{ background: CHECKER }}>
          <span className="absolute inset-0" style={{ background: `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})` }} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div onPointerDown={dragHue} className="relative h-3 cursor-pointer touch-none" style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }} aria-label={t.colorPicker.hue}>
            <span className="pointer-events-none absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" style={{ left: `${(hsv.h / 360) * 100}%` }} />
          </div>
          <div onPointerDown={dragAlpha} className="relative h-3 cursor-pointer touch-none" style={{ background: CHECKER }} aria-label={t.colorPicker.opacity}>
            <span className="absolute inset-0" style={{ background: `linear-gradient(to right, transparent, ${solid})` }} />
            <span className="pointer-events-none absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" style={{ left: `${alpha * 100}%` }} />
          </div>
        </div>
        {'EyeDropper' in window && (
          <button type="button" onClick={pickScreen} aria-label={t.colorPicker.eyedropper} title={t.colorPicker.eyedropper} className="grid size-7 shrink-0 place-items-center text-muted hover:bg-hover hover:text-text">
            <LuPipette size={13} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-2xs uppercase tracking-[var(--tracking-caps)] text-muted">{t.colorPicker.hex}</span>
        <input
          type="text"
          value={hex}
          aria-label={t.colorPicker.hex}
          onChange={(e) => setHex(e.target.value.toUpperCase())}
          onBlur={() => {
            const c = /^#?[0-9a-f]{6}$/i.test(hex) ? parseColor(hex.startsWith('#') ? hex : `#${hex}`) : null;
            if (c) emit(rgbToHsv(c), alpha);
            else setHex(solid.toUpperCase());
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-7 min-w-0 flex-1 border border-border bg-field px-2 font-mono text-xs text-text outline-none focus:border-accent-line"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={Math.round(alpha * 100)}
          aria-label={t.colorPicker.opacity}
          title={t.colorPicker.opacity}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) emit(hsv, Math.max(0, Math.min(100, n)) / 100);
          }}
          className="h-7 w-12 border border-border bg-field px-1.5 text-right text-xs tabular-nums text-text outline-none focus:border-accent-line"
        />
        <span className="text-xs text-muted">%</span>
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-2.5" role="group" aria-label={t.colorPicker.presets}>
        {PRESETS.map((row, i) => (
          <div key={i} className="grid grid-cols-10 gap-1">
            {row.map((p) => {
              const isClear = p === 'transparent';
              const name = isClear ? t.colorPicker.transparent : p.startsWith('var(') ? p.slice(6, -1) : p.toUpperCase();
              return (
                <button
                  key={p}
                  type="button"
                  aria-label={name}
                  title={name}
                  onClick={() => onChange(isClear ? '#00000000' : p)}
                  className="relative aspect-square overflow-hidden border border-border-strong hover:outline hover:outline-1 hover:outline-accent"
                  style={{ background: isClear ? CHECKER : resolveColor(p) }}
                >
                  {isClear && <span className="absolute left-1/2 top-1/2 h-px w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-danger" aria-hidden />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
