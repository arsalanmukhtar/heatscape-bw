import { fieldText, layerData } from './layers';
import { compiled, evaluate } from './sqlExpr';

/*
  Per-layer data as the map draws it, derived from the layer's GeoJSON and its style:
    query (definition): features that do not match are dropped;
    query (selection):  matching features get __sel = true (highlighted, nothing hidden);
    rules renderer:     __rule = index of the first matching rule, -1 for "else".
  labelData builds the label features: text (__label) and label class (__lclass), placed
  on points, along lines, or at polygon centroids / inside points / outlines.
  Results are cached per data object and the settings that shape them.
*/
// Fields an expression may use (coordinates are table-only, not feature properties).
export const exprFields = (def) => (def.fields ?? []).filter((f) => f.kind !== 'coord');
const keysOf = (def) => exprFields(def).map((f) => f.key);
const cache = new WeakMap();
function memo(data, key, build) {
  if (!cache.has(data)) cache.set(data, new Map());
  const m = cache.get(data);
  if (!m.has(key)) {
    if (m.size > 40) m.clear();
    m.set(key, build());
  }
  return m.get(key);
}

/** The active query of a style (applied SQL compiled), or null. */
export function activeQuery(def, style) {
  const sql = style.query?.applied;
  if (!sql) return null;
  const ast = compiled(sql, keysOf(def));
  return ast ? { ast, mode: style.query.mode } : null;
}

/** { data, matched, total } for drawing: query applied, rule index attached. */
export function preparedData(def, style) {
  const data = layerData(def);
  if (!data) return { data: null, matched: 0, total: 0 };
  const q = activeQuery(def, style);
  const rules = style.renderer === 'rules' ? style.rules.map((r) => compiled(r.filter, keysOf(def))) : null;
  if (!q && !rules) return { data, matched: data.features.length, total: data.features.length };
  const key = JSON.stringify([style.query?.applied, style.query?.mode, rules && style.rules.map((r) => r.filter)]);
  return memo(data, key, () => {
    let matched = 0;
    const features = [];
    for (const f of data.features) {
      const hit = q ? !!evaluate(q.ast, f.properties) : true;
      if (hit) matched++;
      if (q?.mode === 'definition' && !hit) continue;
      const props = { ...f.properties };
      if (q?.mode === 'selection') props.__sel = hit;
      if (rules) props.__rule = rules.findIndex((ast) => ast && !!evaluate(ast, f.properties));
      features.push({ ...f, properties: props });
    }
    return { data: { type: 'FeatureCollection', features }, matched, total: data.features.length };
  });
}

/** Ids of the features matching the applied query (for zoom and table). */
export function queryMatches(def, style) {
  const data = layerData(def);
  const q = activeQuery(def, style);
  if (!data || !q) return null;
  return data.features.filter((f) => evaluate(q.ast, f.properties)).map((f) => f.properties.id);
}

const outer = (g) => (g.type === 'MultiPolygon' ? g.coordinates[0] : g.coordinates);

function ringCentroid(ring) {
  const pts = ring.slice(0, -1);
  const s = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [s[0] / pts.length, s[1] / pts.length];
}

function inside([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function edgeDistance([x, y], ring) {
  let d = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[i + 1];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
    d = Math.min(d, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return d;
}

/** Visual centre: the point inside the polygon farthest from its edges (grid search + one refinement). */
function visualCenter(poly) {
  const ring = poly[0];
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  let best = ringCentroid(ring);
  let bestD = inside(best, ring) ? edgeDistance(best, ring) : -1;
  let [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  for (let pass = 0; pass < 2; pass++) {
    const n = 12;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const p = [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * j) / n];
        if (!inside(p, ring)) continue;
        const d = edgeDistance(p, ring) - (poly.slice(1).some((h) => inside(p, h)) ? Infinity : 0);
        if (d > bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    const w = (x1 - x0) / 6;
    const h = (y1 - y0) / 6;
    [x0, y0, x1, y1] = [best[0] - w, best[1] - h, best[0] + w, best[1] + h];
  }
  return best;
}

function lineMid(coords) {
  const line = Array.isArray(coords[0][0]) ? coords[0] : coords;
  return line[Math.floor(line.length / 2)];
}

/** Label text of one feature, from a field (with decimals) or an expression. */
export function labelText(def, label, props) {
  if (label.mode === 'expression') {
    const ast = compiled(label.expression, keysOf(def));
    if (!ast) return '';
    const v = evaluate(ast, props);
    return typeof v === 'number' ? String(Number(v.toFixed(label.decimals))) : (v ?? '');
  }
  const field = def.fields?.find((f) => f.key === label.field);
  const v = props[label.field];
  if (v == null || v === '') return '';
  return typeof v === 'number' ? Number(v.toFixed(label.decimals)).toLocaleString('en-US') : String(fieldText(field, v));
}

/** Label features for a layer (FeatureCollection), or null when labels are off. */
export function labelData(def, style) {
  const label = style.label;
  if (!label?.enabled || def.geometry === 'raster') return null;
  const { data } = preparedData(def, style);
  if (!data) return null;
  const key = JSON.stringify(['labels', label.mode, label.field, label.expression, label.decimals, label.placement, label.classes.map((c) => c.filter), style.query?.applied, style.query?.mode, style.renderer === 'rules' && style.rules.map((r) => r.filter)]);
  return memo(data, key, () => {
    const classAsts = label.classes.map((c) => compiled(c.filter, keysOf(def)));
    const features = [];
    for (const f of data.features) {
      const text = labelText(def, label, f.properties);
      if (!text) continue;
      const g = f.geometry;
      let geometry = g;
      if (def.geometry === 'polygon') {
        // Tiled layers carry a point inside each unit instead of its boundary (perimeter labels draw from the tiles).
        if (g.type === 'Point') geometry = g;
        else if (label.placement.polygon === 'perimeter') geometry = { type: 'LineString', coordinates: outer(g)[0] };
        else geometry = { type: 'Point', coordinates: label.placement.polygon === 'inside' ? visualCenter(outer(g)) : ringCentroid(outer(g)[0]) };
      } else if (def.geometry === 'line') {
        const lineCoords = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates;
        geometry = label.placement.line === 'horizontal' ? { type: 'Point', coordinates: lineMid(lineCoords) } : { type: 'LineString', coordinates: Array.isArray(lineCoords[0][0]) ? lineCoords[0] : lineCoords };
      }
      const lclass = classAsts.findIndex((ast) => ast && !!evaluate(ast, f.properties));
      features.push({ type: 'Feature', properties: { ...f.properties, __label: text, __lclass: lclass }, geometry });
    }
    return { type: 'FeatureCollection', features };
  });
}
