import { colorAt, toHex } from './color';

/*
  Colour ramps for symbology. Our own ramps reference design tokens (they follow the
  theme); the others are ColorBrewer and matplotlib ramps as fixed hex values.
  kind: sequential (magnitude) | diverging (two poles) | qualitative (categories).
*/
const tokens = (name, n = 9) => Array.from({ length: n }, (_, i) => `var(--${name}-${i + 1})`);

export const RAMPS = [
  { id: 'heat', label: 'Heat', kind: 'sequential', colors: tokens('heat') },
  { id: 'vulnerability', label: 'Vulnerability', kind: 'sequential', colors: tokens('vuln') },
  { id: 'sealing', label: 'Sealing', kind: 'sequential', colors: tokens('seal') },
  { id: 'YlOrRd', label: 'Yellow–Orange–Red', kind: 'sequential', colors: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'] },
  { id: 'OrRd', label: 'Orange–Red', kind: 'sequential', colors: ['#fff7ec', '#fee8c8', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#b30000', '#7f0000'] },
  { id: 'Reds', label: 'Reds', kind: 'sequential', colors: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'] },
  { id: 'Blues', label: 'Blues', kind: 'sequential', colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'] },
  { id: 'Greens', label: 'Greens', kind: 'sequential', colors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'] },
  { id: 'Purples', label: 'Purples', kind: 'sequential', colors: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'] },
  { id: 'Greys', label: 'Greys', kind: 'sequential', colors: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000'] },
  { id: 'YlGnBu', label: 'Yellow–Green–Blue', kind: 'sequential', colors: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'] },
  { id: 'viridis', label: 'Viridis', kind: 'sequential', colors: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'] },
  { id: 'magma', label: 'Magma', kind: 'sequential', colors: ['#000004', '#180f3d', '#440f76', '#721f81', '#9e2f7f', '#cd4071', '#f1605d', '#fd9668', '#feca8d', '#fcfdbf'] },
  { id: 'inferno', label: 'Inferno', kind: 'sequential', colors: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'] },
  { id: 'plasma', label: 'Plasma', kind: 'sequential', colors: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'] },
  { id: 'cividis', label: 'Cividis', kind: 'sequential', colors: ['#00224e', '#123570', '#3b496c', '#575d6d', '#707173', '#8a8779', '#a69d75', '#c4b56c', '#e4cf5b', '#fee838'] },
  { id: 'RdYlBu', label: 'Red–Yellow–Blue', kind: 'diverging', colors: ['#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffbf', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4'] },
  { id: 'RdBu', label: 'Red–Blue', kind: 'diverging', colors: ['#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac'] },
  { id: 'Spectral', label: 'Spectral', kind: 'diverging', colors: ['#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd'] },
  { id: 'BrBG', label: 'Brown–Teal', kind: 'diverging', colors: ['#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e'] },
  { id: 'PiYG', label: 'Pink–Green', kind: 'diverging', colors: ['#c51b7d', '#de77ae', '#f1b6da', '#fde0ef', '#f7f7f7', '#e6f5d0', '#b8e186', '#7fbc41', '#4d9221'] },
  { id: 'Set2', label: 'Set 2', kind: 'qualitative', colors: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'] },
  { id: 'Dark2', label: 'Dark 2', kind: 'qualitative', colors: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'] },
  { id: 'Paired', label: 'Paired', kind: 'qualitative', colors: ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a', '#ffff99', '#b15928'] },
];

export const CUSTOM_RAMP = 'custom';
export const DEFAULT_CUSTOM_STOPS = [
  { color: '#2c7bb6', at: 0 },
  { color: '#ffffbf', at: 0.5 },
  { color: '#d7191c', at: 1 },
];

export const rampById = (id) => RAMPS.find((r) => r.id === id) ?? RAMPS[0];

/** Stops [{ color, at }] of a ramp setting { id, invert, stops }, colours resolved. */
export function rampStops(ramp) {
  const stops =
    ramp?.id === CUSTOM_RAMP && ramp.stops?.length
      ? [...ramp.stops].sort((a, b) => a.at - b.at)
      : rampById(ramp?.id).colors.map((color, i, all) => ({ color, at: all.length > 1 ? i / (all.length - 1) : 0 }));
  const resolved = stops.map((s) => ({ color: toHex(s.color), at: s.at }));
  return ramp?.invert ? resolved.map((s) => ({ color: s.color, at: 1 - s.at })).reverse() : resolved;
}

/**
 * n colours from a ramp. Sequential and diverging ramps are sampled evenly (OKLab);
 * qualitative ramps hand out their colours in order and repeat past their length.
 */
export function rampColors(ramp, n) {
  if (n <= 0) return [];
  const def = ramp?.id === CUSTOM_RAMP ? null : rampById(ramp?.id);
  if (def?.kind === 'qualitative') {
    const colors = def.colors.map((c) => toHex(c));
    const list = ramp.invert ? [...colors].reverse() : colors;
    return Array.from({ length: n }, (_, i) => list[i % list.length]);
  }
  const stops = rampStops(ramp);
  return Array.from({ length: n }, (_, i) => colorAt(stops, n === 1 ? 0.5 : i / (n - 1)));
}

/** CSS gradient for previews (ramp pickers, legends). */
export function rampGradient(ramp, steps = 9) {
  const colors = rampColors(ramp, steps);
  return `linear-gradient(to right, ${colors.join(', ')})`;
}
