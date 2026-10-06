import { stats } from './classify';
import { fieldValues } from './layers';

/*
  3D geometry for the 3D tab. Mapbox extrudes polygons only, so points become footprints
  (square, circle or hex of a size in metres), lines become walls, raster cells become
  squares carrying their value. Polygons extrude as they are. Walls along a polygon ring sit
  on its inner side, so the shared edges of neighbouring cells do not overlap.
  Results are cached per data object and the settings that shape them.
*/
const M_PER_DEG = 111320;
const kx = (lat) => 1 / (M_PER_DEG * Math.cos((lat * Math.PI) / 180));

/** Closed ring of a column footprint around a point. */
function footprint([lon, lat], shape, size) {
  const n = shape === 'circle' ? 24 : shape === 'hex' ? 6 : 4;
  const start = shape === 'square' ? Math.PI / 4 : shape === 'hex' ? Math.PI / 6 : 0;
  const r = shape === 'square' ? (size / 2) * Math.SQRT2 : size / 2;
  const ring = Array.from({ length: n }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / n;
    return [lon + Math.cos(a) * r * kx(lat), lat + (Math.sin(a) * r) / M_PER_DEG];
  });
  return [...ring, ring[0]];
}

// Signed area in lon/lat (> 0: counter-clockwise).
const signedArea = (ring) => ring.slice(0, -1).reduce((a, p, i) => a + p[0] * ring[i + 1][1] - ring[i + 1][0] * p[1], 0) / 2;

/** Quads of a wall along a line; side = 0 centres it, ±1 puts it left/right of the line. */
function wall(coords, width, side) {
  const quads = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [a, b] = [coords[i], coords[i + 1]];
    const k = kx((a[1] + b[1]) / 2);
    const dx = (b[0] - a[0]) / k;
    const dy = (b[1] - a[1]) * M_PER_DEG;
    const len = Math.hypot(dx, dy);
    if (!len) continue;
    // Left normal in metres, back to degrees.
    const nx = (-dy / len) * k;
    const ny = dx / len / M_PER_DEG;
    const off = (t) => [t * nx * width, t * ny * width];
    const [o1, o2] = side ? [off(0), off(side)] : [off(-0.5), off(0.5)];
    const p = (c, o) => [c[0] + o[0], c[1] + o[1]];
    quads.push([[p(a, o1), p(b, o1), p(b, o2), p(a, o2), p(a, o1)]]);
  }
  return quads;
}

function walls(geometry, width) {
  const { type, coordinates: c } = geometry;
  const lines = type === 'LineString' ? [c] : type === 'MultiLineString' ? c : [];
  const rings = type === 'Polygon' ? c : type === 'MultiPolygon' ? c.flat() : [];
  return [
    ...lines.flatMap((l) => wall(l, width, 0)),
    // Inner side: left of a counter-clockwise ring, right of a clockwise one.
    ...rings.flatMap((r) => wall(r, width, signedArea(r) > 0 ? 1 : -1)),
  ];
}

const pointOf = (g) => (g.type === 'Point' ? g.coordinates : g.coordinates[0]);

const cache = new WeakMap();
function memo(data, key, build) {
  if (!cache.has(data)) cache.set(data, new Map());
  const m = cache.get(data);
  if (!m.has(key)) {
    if (m.size > 20) m.clear();
    m.set(key, build());
  }
  return m.get(key);
}

/** Raster cells as square polygons with their value and index i (no-data cells left out). */
function rasterCells(def) {
  return memo(def.raster, 'cells', () => {
    const { cols, rows, values, bounds } = def.raster;
    const [w, s, e, n] = bounds;
    const dLon = (e - w) / cols;
    const dLat = (n - s) / rows;
    const features = [];
    values.forEach((value, i) => {
      if (value == null) return;
      const x = w + (i % cols) * dLon;
      const y = n - Math.floor(i / cols) * dLat;
      features.push({ type: 'Feature', properties: { value, i }, geometry: { type: 'Polygon', coordinates: [[[x, y], [x + dLon, y], [x + dLon, y - dLat], [x, y - dLat], [x, y]]] } });
    });
    return { type: 'FeatureCollection', features };
  });
}

/** FeatureCollection to extrude for a point, line or raster layer (polygons use their own data). */
export function solidData(def, style, data) {
  if (def.raster) return rasterCells(def);
  if (!data) return { type: 'FeatureCollection', features: [] };
  const x = style.extrude;
  const key = def.geometry === 'point' ? `p:${x.shape}:${x.size}` : `l:${x.width}`;
  return memo(data, key, () => ({
    type: 'FeatureCollection',
    features: data.features.map((f) => ({
      ...f,
      geometry: def.geometry === 'point' ? { type: 'Polygon', coordinates: [footprint(pointOf(f.geometry), x.shape, x.size)] } : { type: 'MultiPolygon', coordinates: walls(f.geometry, x.width) },
    })),
  }));
}

/** [min, max] of the values mapped onto minHeight…maxHeight. */
export function heightDomain(def, x) {
  if (x.rangeMode === 'manual') return [x.rangeMin, x.rangeMax];
  const s = stats(def.raster ? fieldValues(def) : fieldValues(def, x.field));
  return [s.min, s.max];
}

/** fill-extrusion-height: base + a height from the value (linear or square root), or a fixed height. */
export function heightExpr(def, x) {
  if (x.heightMode === 'constant' || (!def.raster && !x.field)) return x.base + x.height;
  const [lo, hi] = heightDomain(def, x);
  const v = def.raster ? ['get', 'value'] : ['to-number', ['get', x.field], 0];
  const t = ['max', 0, ['min', 1, ['/', ['-', v, lo], hi > lo ? hi - lo : 1]]];
  return ['+', x.base + x.minHeight, ['*', x.maxHeight - x.minHeight, x.scale === 'sqrt' ? ['sqrt', t] : t]];
}
