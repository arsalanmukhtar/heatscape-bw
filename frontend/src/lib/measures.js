import { LuDroplets, LuLeafyGreen, LuShovel, LuTreeDeciduous, LuUmbrella } from 'react-icons/lu';

/*
  Adaptation measures: types, statuses, geometry helpers and GeoJSON builders.
  Types are listed in their validated colour order (tokens.css, --measure-*); every list,
  legend and chart uses this order so a colour always sits next to the same neighbours.
*/
export const MEASURE_TYPES = [
  { id: 'desealing', color: 'var(--measure-desealing)', Icon: LuShovel },
  { id: 'greenroof', color: 'var(--measure-greenroof)', Icon: LuLeafyGreen },
  { id: 'shade', color: 'var(--measure-shade)', Icon: LuUmbrella },
  { id: 'trees', color: 'var(--measure-trees)', Icon: LuTreeDeciduous },
  { id: 'water', color: 'var(--measure-water)', Icon: LuDroplets },
];
export const measureType = (id) => MEASURE_TYPES.find((m) => m.id === id) ?? MEASURE_TYPES[0];

// Workflow states (status tokens, not heat levels: a plan must not look like a reading).
export const MEASURE_STATUSES = [
  { id: 'planned', color: 'var(--text-muted)' },
  { id: 'progress', color: 'var(--warning)' },
  { id: 'completed', color: 'var(--info)' },
  { id: 'monitored', color: 'var(--success)' },
];
export const measureStatus = (id) => MEASURE_STATUSES.find((s) => s.id === id) ?? MEASURE_STATUSES[0];

/** Analysis buffer around a footprint, metres (Landsat thermal pixels are 30 m, resampled from 100 m). */
export const BUFFER_M = 100;
// Effects need this many post-completion summers before they are estimated.
export const MIN_SUMMERS = 2;

const M_PER_DEG = 111320;
const toLocal = (lat0) => ([lon, lat]) => [lon * M_PER_DEG * Math.cos((lat0 * Math.PI) / 180), lat * M_PER_DEG];
const toLonLat = (lat0) => ([x, y]) => [x / (M_PER_DEG * Math.cos((lat0 * Math.PI) / 180)), y / M_PER_DEG];

const outerRing = (geometry) => (geometry.type === 'MultiPolygon' ? geometry.coordinates[0][0] : geometry.coordinates[0]);

/** Area of a (multi)polygon in m² (local equirectangular projection; fine at block scale). */
export function areaM2(geometry) {
  if (!geometry) return 0;
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  let total = 0;
  for (const poly of polys) {
    poly.forEach((ring, k) => {
      const lat0 = ring[0][1];
      const pts = ring.map(toLocal(lat0));
      let a = 0;
      for (let i = 0; i < pts.length - 1; i++) a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
      total += (k === 0 ? 1 : -1) * Math.abs(a / 2);
    });
  }
  return Math.round(total);
}

/** Centre of the outer ring (vertex average). */
export function centroid(geometry) {
  const ring = outerRing(geometry).slice(0, -1);
  const s = ring.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [s[0] / ring.length, s[1] / ring.length];
}

// Andrew's monotone chain convex hull.
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Analysis buffer: the footprint's convex hull grown by `m` metres with rounded corners
 * (exact for convex footprints, a slight overestimate for concave ones; the backend will
 * use ST_Buffer).
 */
export function bufferPolygon(geometry, m = BUFFER_M) {
  const ring = outerRing(geometry);
  const lat0 = ring[0][1];
  const pts = ring.map(toLocal(lat0));
  const circle = pts.flatMap(([x, y]) => Array.from({ length: 16 }, (_, i) => [x + m * Math.cos((i / 16) * 2 * Math.PI), y + m * Math.sin((i / 16) * 2 * Math.PI)]));
  const h = hull(circle).map(toLonLat(lat0));
  return { type: 'Polygon', coordinates: [[...h, h[0]]] };
}

/** Rectangle of w × h metres around a centre, rotated by deg (mock footprints). */
export function rectAround([lon, lat], w, h, deg = 0) {
  const r = (deg * Math.PI) / 180;
  const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]);
  const base = toLocal(lat)([lon, lat]);
  const ll = corners.map(([x, y]) => toLonLat(lat)([base[0] + x, base[1] + y]));
  return { type: 'Polygon', coordinates: [[...ll, ll[0]]] };
}

/** Effect summary shown in lists and tables: DiD median in °C, or null. */
export const effectValue = (m) => (m.effect ? m.effect.did.med : null);

const props = (m) => ({
  id: m.id,
  name: m.name,
  type: m.type,
  status: m.status,
  district: m.district,
  completed: m.completed ?? '',
  year: m.completed ? Number(m.completed.slice(0, 4)) : null,
  area: m.area,
  cost: m.cost,
  trees: m.trees ?? 0,
  residents: m.residents ?? 0,
  effect: effectValue(m),
});

/** Footprints as a FeatureCollection (memoised per measures array). */
const fcCache = new WeakMap();
export function measuresFC(measures) {
  if (!fcCache.has(measures)) {
    fcCache.set(measures, {
      footprints: { type: 'FeatureCollection', features: measures.map((m) => ({ type: 'Feature', properties: props(m), geometry: m.geometry })) },
      buffers: { type: 'FeatureCollection', features: measures.map((m) => ({ type: 'Feature', properties: props(m), geometry: bufferPolygon(m.geometry) })) },
    });
  }
  return fcCache.get(measures);
}
