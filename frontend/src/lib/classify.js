/*
  Class breaks for graduated symbology. Every method runs on the full dataset (all
  features of the layer, not only the rendered ones), so breaks never change on pan/zoom.
  computeBreaks returns ascending breaks [b0 … bn] for n classes (b0 = lower bound of the
  first class, bn = upper bound of the last).
*/
export const METHODS = ['equal', 'quantile', 'jenks', 'stddev', 'pretty', 'geometric', 'defined', 'manual'];

const JENKS_SAMPLE = 1000;

export function stats(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { sorted: v, min: 0, max: 0, mean: 0, sd: 0 };
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length);
  return { sorted: v, min: v[0], max: v[v.length - 1], mean, sd };
}

/** Value at percentile p (0–1) of an ascending array. */
export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}

const uniq = (arr) => arr.filter((x, i) => i === 0 || x > arr[i - 1]);

function equal(min, max, n) {
  return Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n);
}

function quantile(sorted, n) {
  return uniq(Array.from({ length: n + 1 }, (_, i) => percentile(sorted, i / n)));
}

// Fisher–Jenks natural breaks (minimises within-class variance) on an evenly spaced sample.
function jenks(sorted, n) {
  const step = Math.max(1, Math.floor(sorted.length / JENKS_SAMPLE));
  const data = sorted.filter((_, i) => i % step === 0);
  if (data[data.length - 1] !== sorted[sorted.length - 1]) data.push(sorted[sorted.length - 1]);
  const m = data.length;
  if (n >= m) return uniq(data);
  const lower = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  const variance = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(Infinity));
  for (let j = 1; j <= n; j++) {
    lower[1][j] = 1;
    variance[1][j] = 0;
  }
  for (let l = 2; l <= m; l++) {
    let s1 = 0;
    let s2 = 0;
    let w = 0;
    let v = 0;
    for (let k = 1; k <= l; k++) {
      const i3 = l - k + 1;
      const val = data[i3 - 1];
      s2 += val * val;
      s1 += val;
      w += 1;
      v = s2 - (s1 * s1) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= n; j++) {
          if (variance[l][j] >= v + variance[i4][j - 1]) {
            lower[l][j] = i3;
            variance[l][j] = v + variance[i4][j - 1];
          }
        }
      }
    }
    lower[l][1] = 1;
    variance[l][1] = v;
  }
  const breaks = new Array(n + 1);
  breaks[n] = data[m - 1];
  breaks[0] = data[0];
  let k = m;
  for (let j = n; j >= 2; j--) {
    const id = lower[k][j] - 2;
    breaks[j - 1] = data[id];
    k = lower[k][j] - 1;
  }
  return uniq(breaks);
}

// Classes centred on the mean, each `interval` standard deviations wide (ArcGIS/QGIS style).
function stddev({ min, max, mean, sd }, interval) {
  if (!sd) return [min, max];
  const w = sd * interval;
  const breaks = [mean - w / 2, mean + w / 2];
  while (breaks[0] > min) breaks.unshift(breaks[0] - w);
  while (breaks[breaks.length - 1] < max) breaks.push(breaks[breaks.length - 1] + w);
  breaks[0] = min;
  breaks[breaks.length - 1] = max;
  return uniq(breaks);
}

// Round-number breaks close to n classes (1, 2, 2.5, 5 × 10^k steps).
function pretty(min, max, n) {
  const raw = (max - min) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const breaks = [];
  for (let b = start; b < max + step * 0.999; b += step) breaks.push(+b.toFixed(10));
  return breaks.length > 1 ? breaks : [min, max];
}

// Geometric series: each class is r times wider than the previous (needs a positive range,
// so the values are shifted to start at 1 when necessary).
function geometric(min, max, n) {
  const shift = min <= 0 ? 1 - min : 0;
  const a = min + shift;
  const r = ((max + shift) / a) ** (1 / n);
  return Array.from({ length: n + 1 }, (_, i) => a * r ** i - shift);
}

function defined(min, max, interval) {
  const iv = interval > 0 ? interval : (max - min) / 5 || 1;
  const start = Math.floor(min / iv) * iv;
  const breaks = [];
  for (let b = start; b < max + iv * 0.999 && breaks.length < 100; b += iv) breaks.push(+b.toFixed(10));
  return breaks.length > 1 ? breaks : [min, max];
}

/**
 * opts: { range: [min, max] (equal/defined/pretty, optional), sdInterval, interval, manual }
 * manual: existing breaks to keep.
 */
export function computeBreaks(values, method, n, opts = {}) {
  const s = stats(values);
  const min = opts.range ? opts.range[0] : s.min;
  const max = opts.range ? opts.range[1] : s.max;
  if (min === max || (!s.sorted.length && !opts.range)) return [min, max];
  // A manual range classifies before any data arrive (live layers); data-driven methods then use equal steps.
  if (!s.sorted.length && ['quantile', 'jenks', 'stddev'].includes(method)) return equal(min, max, n);
  switch (method) {
    case 'quantile':
      return quantile(s.sorted, n);
    case 'jenks':
      return jenks(s.sorted, n);
    case 'stddev':
      return stddev(s, opts.sdInterval || 1);
    case 'pretty':
      return pretty(min, max, n);
    case 'geometric':
      return geometric(min, max, n);
    case 'defined':
      return defined(min, max, opts.interval);
    case 'manual':
      return opts.manual?.length > 1 ? opts.manual : equal(min, max, n);
    default:
      return equal(min, max, n);
  }
}

/** Distinct values of a field, most frequent first, with their counts. */
export function uniqueValues(values, limit = 60) {
  const counts = new Map();
  for (const v of values) {
    if (v == null || v === '') continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

/** Label number, trimmed to `precision` decimals. */
export const fmtNum = (v, precision = 1) =>
  Number.isFinite(v) ? Number(v.toFixed(precision)).toLocaleString('en-US', { maximumFractionDigits: precision }) : '–';
