import {
  AIR_GRID,
  BLOCKS,
  HAZARD_RASTER,
  LST_RASTER,
  SEALING_POINTS,
  SURFACE_GRID,
  blockBounds,
} from '../data/mock';
import { t } from '../i18n';
import { MEASURE_STATUSES, MEASURE_TYPES, measuresFC } from './measures';
import { allMeasures, useMeasures } from '../state/measures';
import { liveData } from '../state/live';

/*
  Map layers that can be styled. Each entry: id (also the visibility key in
  workspace.layers), attribution (provider keys from lib/attribution.js, credited on the
  map while the layer is shown), group, geometry (point | line | polygon | raster), label, and either
  vector data (GeoJSON) with fields, or a raster (kind: continuous | classified | dem).
  field.kind drives table cells: text | id | num | int | pct | temp | green | chip | coord.
  Feature-level ids live in properties.id so tables, queries and styles share one key.
*/
const toFeature = (properties, geometry) => ({ type: 'Feature', properties, geometry });

const BLOCKS_FC = {
  type: 'FeatureCollection',
  features: BLOCKS.map((b) => {
    const [[w, s], [e, n]] = blockBounds(b);
    const { center, weekly, ...props } = b;
    return toFeature(props, { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
  }),
};

const c = t.layers.fields;
const COORDS = [
  { key: 'lon', label: c.lon, kind: 'coord', type: 'number' },
  { key: 'lat', label: c.lat, kind: 'coord', type: 'number' },
];
const GRID_FIELDS = [
  { key: 'id', label: c.id, kind: 'id', type: 'string' },
  { key: 't', label: c.temp, kind: 'temp', type: 'number' },
  { key: 'heatClass', label: c.heatClass, kind: 'chip', type: 'string' },
  ...COORDS,
];
// Live open-data layers (state/live.js; GeoJSON from /api/layers/…, imported by the worker).
const live = (id) => () => liveData(id);
const HOSPITAL_FIELDS = [
  { key: 'id', label: c.id, kind: 'id', type: 'string' },
  { key: 'name', label: c.name, kind: 'text', type: 'string' },
  { key: 'address', label: c.address, kind: 'text', type: 'string' },
  { key: 'postcode', label: c.postcode, kind: 'text', type: 'string' },
  { key: 'locality', label: c.locality, kind: 'text', type: 'string' },
  { key: 'phone', label: c.phone, kind: 'text', type: 'string' },
  { key: 'website', label: c.website, kind: 'text', type: 'string' },
  { key: 'confidence', label: c.confidence, kind: 'num', type: 'number' },
  ...COORDS,
];
const WATER_FIELDS = [
  { key: 'id', label: c.id, kind: 'id', type: 'string' },
  { key: 'name', label: c.name, kind: 'text', type: 'string' },
  { key: 'kind', label: c.kind, kind: 'text', type: 'string' },
  { key: 'operator', label: c.operator, kind: 'text', type: 'string' },
  ...COORDS,
];
const STATION_FIELDS = [
  { key: 'id', label: c.id, kind: 'id', type: 'string' },
  { key: 'name', label: c.name, kind: 'text', type: 'string' },
  { key: 'latestTemp', label: c.latestTemp, kind: 'num', type: 'number' },
  { key: 'observedAt', label: c.observedAt, kind: 'text', type: 'string' },
  { key: 'lastDay', label: c.lastDay, kind: 'text', type: 'string' },
  { key: 'lastDayMax', label: c.lastDayMax, kind: 'num', type: 'number' },
  { key: 'lastDayMin', label: c.lastDayMin, kind: 'num', type: 'number' },
  { key: 'season', label: c.season, kind: 'text', type: 'string' },
  { key: 'summerDays', label: c.summerDays, kind: 'int', type: 'number' },
  { key: 'heatDays', label: c.heatDays, kind: 'int', type: 'number' },
  { key: 'tropicalNights', label: c.tropicalNights, kind: 'int', type: 'number' },
  { key: 'summerMax', label: c.summerMax, kind: 'num', type: 'number' },
  { key: 'elevation', label: c.elevation, kind: 'int', type: 'number' },
  ...COORDS,
];
// Administrative units (BKG VG250-EW for Baden-Württemberg and neighbouring Länder; OSM city districts / quarters).
const ADMIN_FIELDS = [
  { key: 'id', label: c.id, kind: 'id', type: 'string' },
  { key: 'name', label: c.name, kind: 'text', type: 'string' },
  { key: 'type', label: c.adminType, kind: 'text', type: 'string' },
  { key: 'ars', label: c.ars, kind: 'text', type: 'string' },
  { key: 'population', label: c.population, kind: 'int', type: 'number' },
  { key: 'area', label: c.areaKm2, kind: 'num', type: 'number' },
  { key: 'density', label: c.density, kind: 'int', type: 'number' },
  { key: 'district', label: c.parentDistrict, kind: 'text', type: 'string' },
  { key: 'region', label: c.parentRegion, kind: 'text', type: 'string' },
  { key: 'state', label: c.parentState, kind: 'text', type: 'string' },
  { key: 'nuts', label: c.nuts, kind: 'text', type: 'string' },
  ...COORDS,
];
const admin = (id, attribution) => ({ id, attribution, group: 'admin', geometry: 'polygon', label: t.layers[id], getData: live(id), fields: ADMIN_FIELDS });
const POPULATION_FIELDS = [
  { key: 'id', label: c.id, kind: 'id', type: 'string' },
  { key: 'population', label: c.population, kind: 'int', type: 'number' },
  { key: 'meanAge', label: c.meanAge, kind: 'num', type: 'number' },
  ...COORDS,
];

// Measures register as live layers: footprints and their analysis buffers.
const measureData = (part) => () => measuresFC(allMeasures(useMeasures.getState().added, useMeasures.getState().statusLog))[part];
const MEASURE_FIELDS = [
  { key: 'id', label: c.id, kind: 'id', type: 'string' },
  { key: 'name', label: c.name, kind: 'text', type: 'string' },
  { key: 'type', label: c.measureType, kind: 'measureType', type: 'string', labels: Object.fromEntries(MEASURE_TYPES.map((m) => [m.id, t.measures.types[m.id]])) },
  { key: 'status', label: c.status, kind: 'measureStatus', type: 'string', labels: Object.fromEntries(MEASURE_STATUSES.map((m) => [m.id, t.measures.statuses[m.id]])) },
  { key: 'district', label: t.table.columns.district, kind: 'text', type: 'string' },
  { key: 'completed', label: c.completed, kind: 'text', type: 'string' },
  { key: 'area', label: c.area, kind: 'int', type: 'number' },
  { key: 'cost', label: c.cost, kind: 'int', type: 'number' },
  { key: 'residents', label: c.residents, kind: 'int', type: 'number' },
  { key: 'effect', label: c.effect, kind: 'effect', type: 'number' },
];

export const LAYER_GROUPS = [
  { id: 'admin', label: t.layers.admin },
  { id: 'heat', label: t.layers.heatIslands },
  { id: 'adaptation', label: t.layers.adaptation },
  { id: 'urban', label: t.layers.urban },
  { id: 'infrastructure', label: t.layers.infrastructure },
  { id: 'raster', label: t.layers.rasters },
];

export const LAYERS = [
  { id: 'surfaceTemp', attribution: ['usgs'], group: 'heat', geometry: 'polygon', label: t.layers.surfaceTemp, data: SURFACE_GRID, fields: GRID_FIELDS },
  { id: 'airTemp', attribution: ['dwd'], group: 'heat', geometry: 'line', label: t.layers.airTemp, data: AIR_GRID, fields: GRID_FIELDS },
  {
    id: 'blocks',
    attribution: ['usgs', 'destatis', 'lgl'],
    group: 'urban',
    geometry: 'polygon',
    label: t.layers.blocks,
    data: BLOCKS_FC,
    fields: [
      { key: 'id', label: t.table.columns.id, kind: 'id', type: 'string' },
      { key: 'district', label: t.table.columns.district, kind: 'text', type: 'string' },
      { key: 'avgTemp', label: t.table.columns.avgTemp, kind: 'num', type: 'number' },
      { key: 'peakTemp', label: t.table.columns.peakTemp, kind: 'temp', type: 'number' },
      { key: 'lstDay', label: c.lstDay, kind: 'num', type: 'number' },
      { key: 'sealing', label: t.table.columns.sealing, kind: 'pct', type: 'number' },
      { key: 'greenCover', label: t.table.columns.greenCover, kind: 'green', type: 'number' },
      { key: 'popDensity', label: t.table.columns.popDensity, kind: 'int', type: 'number' },
      { key: 'vulnerability', label: c.vulnerability, kind: 'int', type: 'number' },
      { key: 'risk', label: t.table.columns.risk, kind: 'chip', type: 'string' },
    ],
  },
  {
    id: 'sealing',
    attribution: ['copernicus'],
    group: 'urban',
    geometry: 'point',
    label: t.layers.sealing,
    data: SEALING_POINTS,
    fields: [
      { key: 'id', label: c.id, kind: 'id', type: 'string' },
      { key: 'sealing', label: t.table.columns.sealing, kind: 'pct', type: 'number' },
      { key: 'band', label: c.band, kind: 'text', type: 'string' },
      ...COORDS,
    ],
  },
  { id: 'hospitals', attribution: ['overture'], group: 'infrastructure', geometry: 'point', label: t.layers.hospitals, getData: live('hospitals'), fields: HOSPITAL_FIELDS },
  { id: 'water', attribution: ['osm'], group: 'infrastructure', geometry: 'point', label: t.layers.water, getData: live('water'), fields: WATER_FIELDS },
  { id: 'dwdStations', attribution: ['dwd'], group: 'heat', geometry: 'point', label: t.layers.dwdStations, getData: live('dwdStations'), fields: STATION_FIELDS },
  { id: 'population', attribution: ['destatis'], group: 'urban', geometry: 'polygon', label: t.layers.population, getData: live('population'), fields: POPULATION_FIELDS },
  { id: 'measures', attribution: ['usgs', 'copernicus'], group: 'adaptation', geometry: 'polygon', label: t.layers.measures, getData: measureData('footprints'), fields: MEASURE_FIELDS },
  { id: 'measureBuffers', attribution: [], group: 'adaptation', geometry: 'line', label: t.layers.measureBuffers, getData: measureData('buffers'), fields: MEASURE_FIELDS },
  admin('adminLand', ['bkg']),
  admin('adminRbz', ['bkg']),
  admin('adminKrs', ['bkg']),
  admin('adminVwg', ['bkg']),
  admin('adminGem', ['bkg']),
  admin('adminOsm9', ['overture', 'osm']),
  admin('adminOsm10', ['overture', 'osm']),
  { id: 'lstRaster', attribution: ['usgs'], group: 'raster', geometry: 'raster', kind: 'continuous', label: t.layers.lstRaster, raster: LST_RASTER },
  { id: 'hazardRaster', attribution: ['usgs', 'dwd'], group: 'raster', geometry: 'raster', kind: 'classified', label: t.layers.hazardRaster, raster: HAZARD_RASTER },
  { id: 'hillshade', attribution: ['mapbox'], group: 'raster', geometry: 'raster', kind: 'dem', label: t.layers.hillshade },
];

export const layerById = (id) => LAYERS.find((l) => l.id === id);

/** Draw order, bottom to top. 'priority' is the scenario overlay, kept in the stack so data can sit above or below it. */
export const DEFAULT_ORDER = ['hillshade', 'lstRaster', 'hazardRaster', 'surfaceTemp', 'population', 'blocks', 'airTemp', 'priority', 'measureBuffers', 'measures', 'adminGem', 'adminVwg', 'adminOsm10', 'adminOsm9', 'adminKrs', 'adminRbz', 'adminLand', 'sealing', 'hospitals', 'water', 'dwdStations'];

// Centre of a feature's coordinates (good enough for points and grid cells).
function centerOf(geometry) {
  const pts = geometry.type === 'Point' ? [geometry.coordinates] : geometry.coordinates.flat(geometry.type === 'Polygon' ? 1 : 0);
  const ring = geometry.type === 'Polygon' ? pts.slice(0, -1) : pts;
  const sum = ring.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

/** A vector layer's GeoJSON: fixed data, or live data (measures) read on each call. */
export const layerData = (def) => (def?.getData ? def.getData() : def?.data) ?? null;
export const isVector = (def) => !!(def?.data || def?.getData);

// Rows per data object, so live layers rebuild their rows when their data changes.
const rowCache = new WeakMap();

/** Attribute rows of a vector layer: properties plus lon/lat of the feature centre. */
export function layerRows(def) {
  const data = layerData(def);
  if (!data) return [];
  if (!rowCache.has(data)) {
    rowCache.set(
      data,
      data.features.map((f) => {
        const [lon, lat] = centerOf(f.geometry);
        return { ...f.properties, lon: +lon.toFixed(5), lat: +lat.toFixed(5) };
      }),
    );
  }
  return rowCache.get(data);
}

/** Display text of a field value (labels for coded values such as measure types). */
export const fieldText = (field, value) => field?.labels?.[value] ?? value;

/** Numeric fields of a layer (for graduated renderers, normalisation, weights). */
export const numericFields = (def) => (def?.fields ?? []).filter((f) => f.type === 'number' && f.kind !== 'coord');
/** Fields that make sense as categories. */
export const categoryFields = (def) => (def?.fields ?? []).filter((f) => f.kind !== 'coord');

/** Values of a field across the whole layer; normalizeBy divides by a second field. */
export function fieldValues(def, field, normalizeBy) {
  if (def?.raster) return def.raster.values.filter((v) => v != null);
  return layerRows(def).map((r) => {
    const v = Number(r[field]);
    if (!normalizeBy) return v;
    const d = Number(r[normalizeBy]);
    return d ? v / d : NaN;
  });
}

/** Raster cell by index: { index, row, col, value, bounds: [w, s, e, n], size (m) }. */
export function rasterCellAt(def, index) {
  const { cols, rows, values, bounds } = def.raster;
  const [w, s, e, n] = bounds;
  const dLon = (e - w) / cols;
  const dLat = (n - s) / rows;
  const row = Math.floor(index / cols);
  const col = index % cols;
  return { index, row, col, value: values[index] ?? null, bounds: [w + col * dLon, n - (row + 1) * dLat, w + (col + 1) * dLon, n - row * dLat], size: Math.round(dLat * 111320) };
}

/** The raster cell under a point, or null outside the raster. */
export function rasterCell(def, lon, lat) {
  const { cols, rows, bounds } = def.raster;
  const [w, s, e, n] = bounds;
  if (lon < w || lon >= e || lat <= s || lat > n) return null;
  return rasterCellAt(def, Math.floor((n - lat) / ((n - s) / rows)) * cols + Math.floor((lon - w) / ((e - w) / cols)));
}

/** The GeoJSON feature of a vector layer with this id (properties.id), or null. */
export function featureById(def, id) {
  if (id == null) return null;
  return layerData(def)?.features.find((f) => String(f.properties.id) === String(id)) ?? null;
}

/** [[west, south], [east, north]] of a layer, for zoom to layer. */
export function layerBounds(def) {
  if (def?.raster) {
    const [w, s, e, n] = def.raster.bounds;
    return [[w, s], [e, n]];
  }
  const data = layerData(def);
  if (!data?.features.length) return [[8.42, 49.43], [8.6, 49.56]];
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (c) => {
    if (typeof c[0] === 'number') {
      w = Math.min(w, c[0]);
      e = Math.max(e, c[0]);
      s = Math.min(s, c[1]);
      n = Math.max(n, c[1]);
    } else c.forEach(visit);
  };
  data.features.forEach((f) => visit(f.geometry.coordinates));
  return [[w, s], [e, n]];
}
