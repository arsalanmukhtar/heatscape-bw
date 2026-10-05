import { cssVar } from './css';

/*
  Colour helpers for symbology. Style colours are stored either as a token reference
  ('var(--heat-5)', follows the theme) or as a literal (#rrggbb, #rrggbbaa, rgb()/rgba()).
  Mapbox needs literals, so everything passes through resolveColor before it reaches a
  paint property.
*/
const TRANSPARENT = 'rgba(0,0,0,0)';

export function resolveColor(c) {
  if (!c) return TRANSPARENT;
  const m = /^var\((--[\w-]+)\)$/.exec(c);
  return m ? cssVar(m[1]) || '#888888' : c;
}

/** { r, g, b, a } with r/g/b 0–255 and a 0–1, or null for an unreadable colour. */
export function parseColor(input) {
  const c = resolveColor(input).trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(c);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (m) {
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  }
  return null;
}

const hex2 = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');

/** #rrggbb (alpha dropped). */
export function toHex(input) {
  const c = typeof input === 'object' ? input : parseColor(input);
  return c ? `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}` : '#000000';
}

/** rgba() string with the alpha multiplied by a (0–1). */
export function withAlpha(input, a = 1) {
  const c = parseColor(input);
  if (!c) return TRANSPARENT;
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${+(c.a * a).toFixed(3)})`;
}

/** Black or white text for a background, by relative luminance. */
export function contrastText(input) {
  const c = parseColor(input);
  if (!c) return '#ffffff';
  const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const l = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  return l > 0.4 ? '#111111' : '#ffffff';
}

// sRGB <-> OKLab, so interpolated ramps stay perceptually even (no muddy midpoints).
const toLin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLin = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function toOklab({ r, g, b }) {
  const [R, G, B] = [toLin(r), toLin(g), toLin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function fromOklab([L, A, Bv]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * Bv) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * Bv) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * Bv) ** 3;
  return {
    r: fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/** Colour at t (0–1) along stops [{ color, at }] (at 0–1, ascending), mixed in OKLab. */
export function colorAt(stops, t) {
  if (!stops.length) return '#000000';
  if (t <= stops[0].at) return toHex(stops[0].color);
  const last = stops[stops.length - 1];
  if (t >= last.at) return toHex(last.color);
  const i = stops.findIndex((s) => s.at >= t);
  const a = stops[i - 1];
  const b = stops[i];
  const k = (t - a.at) / (b.at - a.at || 1);
  const pa = toOklab(parseColor(a.color) ?? { r: 0, g: 0, b: 0 });
  const pb = toOklab(parseColor(b.color) ?? { r: 0, g: 0, b: 0 });
  return toHex(fromOklab(pa.map((v, j) => v + (pb[j] - v) * k)));
}
