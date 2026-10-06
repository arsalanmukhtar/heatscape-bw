import { TEMP_DOMAIN } from '../data/mock';
import { computeBreaks, percentile, stats, uniqueValues } from './classify';
import { t } from '../i18n';
import { fieldValues, layerData, LAYERS } from './layers';
import { MEASURE_TYPES } from './measures';

/*
  Layer style model (JSON, saved per layer). One object per layer holds every setting;
  only the parts relevant to its geometry and renderer are used.

  Class lists: { value } (categorized, paletted) or { from, to } (graduated), plus
  color (null = from the ramp), label (null = automatic), visible.
*/
export const RENDERERS = {
  point: ['single', 'categorized', 'graduated', 'graduatedSize', 'rules', 'heatmap', 'cluster'],
  line: ['single', 'categorized', 'graduated', 'graduatedSize', 'rules'],
  polygon: ['single', 'categorized', 'graduated', 'rules'],
  continuous: ['pseudocolor', 'gray'],
  classified: ['paletted', 'pseudocolor'],
  dem: ['hillshade'],
};

export const renderersFor = (def) => RENDERERS[def.geometry === 'raster' ? def.kind : def.geometry];

// Settings whose change rebuilds the class list.
export const RECLASSIFY_KEYS = ['renderer', 'field', 'normalizeBy', 'method', 'classCount', 'sdInterval', 'interval', 'rangeMode', 'rangeMin', 'rangeMax'];

const BASE = {
  renderer: 'single',
  opacity: 1,
  minZoom: 0,
  maxZoom: 24,
  showLegend: true,
  point: {
    marker: 'circle',
    badge: true,
    size: 10,
    fill: 'var(--accent)',
    fillOpacity: 1,
    stroke: 'var(--surface-strong)',
    strokeWidth: 1.5,
    strokeOpacity: 1,
    glyph: '#ffffff',
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    blur: 0,
  },
  line: {
    color: 'var(--accent)',
    width: 1.5,
    opacity: 1,
    dash: 'solid',
    customDash: '4 2',
    cap: 'round',
    join: 'round',
    offset: 0,
    blur: 0,
    casing: false,
    casingColor: 'var(--surface-strong)',
    casingWidth: 1.5,
  },
  polygon: {
    fill: 'var(--accent)',
    fillOpacity: 0.7,
    noFill: false,
    pattern: 'solid',
    patternSpacing: 8,
    patternWidth: 1,
    patternBackground: false,
    outline: 'var(--surface-strong)',
    outlineWidth: 0,
    outlineOpacity: 1,
    outlineDash: 'solid',
    outlineFromClass: false, // categorized/graduated: outline in each class colour
  },
  // 3D tab: when on, the layer is drawn as fill-extrusions instead of its 2D symbols
  // (polygons raised, columns on points and raster cells, walls along lines; terrain for the DEM).
  extrude: {
    enabled: false,
    heightMode: 'field', // field (raster: cell value) | constant
    field: null,
    rangeMode: 'data', // data | manual: the values mapped onto minHeight…maxHeight
    rangeMin: 0,
    rangeMax: 100,
    scale: 'linear', // linear | sqrt
    minHeight: 20, // m
    maxHeight: 800, // m
    height: 200, // m, constant mode
    base: 0, // m above ground
    colorMode: 'style', // style (the Style tab's colours) | single
    color: 'var(--accent)',
    opacity: 0.9,
    gradient: true, // sides darken toward the ground
    shape: 'square', // points: square | circle | hex
    size: 150, // points: footprint width, m
    width: 25, // lines: wall thickness, m
    exaggeration: 1.5, // DEM: terrain height factor
  },
  // Categorized / graduated.
  field: null,
  normalizeBy: null,
  method: 'equal',
  classCount: 5,
  sdInterval: 1,
  interval: 1,
  rangeMode: 'data', // data | manual
  rangeMin: 0,
  rangeMax: 100,
  precision: 1,
  ramp: { id: 'YlOrRd', invert: false, stops: null },
  continuous: false,
  classes: [],
  showOther: true,
  otherColor: '#9aa3ad',
  // Graduated size (diameter px for points, width px for lines).
  sizeMin: 2,
  sizeMax: 14,
  heatmap: { radius: 18, intensity: 1, weightField: null, opacity: 0.85 },
  cluster: { radius: 40, maxZoom: 14, color: 'var(--accent)', showCount: true },
  raster: {
    statsMode: 'data', // data | cut | manual
    min: 0,
    max: 1,
    interpolation: 'linear', // linear | discrete
    classCount: 9,
    nodata: '#00000000',
    brightnessMin: 0,
    brightnessMax: 1,
    contrast: 0,
    saturation: 0,
    hue: 0,
    resampling: 'linear',
  },
  hillshade: { exaggeration: 0.5, direction: 335, anchor: 'viewport', shadow: '#000000', highlight: '#ffffff', accent: '#000000' },
  // Rule-based renderer: first matching rule wins; "else" catches the rest.
  rules: [], // { label, filter (SQL), color, visible }
  elseRule: { visible: true, color: 'var(--unc-suppress)', label: null },
  // Labels (Label tab). Light text on a dark halo reads on every basemap.
  label: {
    enabled: false,
    mode: 'field', // field | expression
    field: null,
    expression: '',
    decimals: 1,
    font: 'DIN Pro',
    fontStyle: 'Medium',
    size: 12,
    color: '#ffffff',
    opacity: 1,
    letterSpacing: 0,
    lineHeight: 1.2,
    maxWidth: 10,
    transform: 'none', // none | uppercase | lowercase
    justify: 'auto', // auto | left | center | right
    halo: { enabled: true, color: '#0b0f14', width: 1.2, blur: 0.5, opacity: 0.9 },
    background: { enabled: false, color: '#0b0f14', opacity: 0.8, outline: '#ffffff', outlineOpacity: 0.25, padding: 3 },
    placement: {
      point: 'auto', // auto (cartographic, tries 8 positions) | fixed
      anchor: 'top', // fixed position: centre or one of 8 around the point
      distance: 0.8, // em
      line: 'line', // line (along, curved) | line-center | horizontal
      linePosition: 'above', // above | on | below
      spacing: 250,
      keepUpright: true,
      maxAngle: 45,
      polygon: 'inside', // centroid | inside (visual centre) | perimeter
      rotation: 'none', // none | angle | field
      angle: 0,
      rotationField: null,
    },
    minZoom: 0,
    maxZoom: 24,
    allowOverlap: false,
    priorityField: null,
    padding: 2,
    classes: [], // { filter (SQL), color, size, bold, visible }: first match wins
  },
  // Query tab: draft SQL and builder; `applied` is the query the map uses ('' = none).
  query: { mode: 'definition', sql: '', applied: '', builder: { combinator: 'AND', conditions: [] }, saved: [] },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

// Today's map look, per layer: Reset brings these back.
const OVERRIDES = {
  surfaceTemp: {
    renderer: 'graduated',
    field: 't',
    method: 'equal',
    classCount: 9,
    rangeMode: 'manual',
    rangeMin: TEMP_DOMAIN[0],
    rangeMax: TEMP_DOMAIN[1],
    ramp: { id: 'heat', invert: false, stops: null },
    continuous: true,
    polygon: { fillOpacity: 0.72, outlineWidth: 0 },
  },
  airTemp: {
    renderer: 'graduated',
    field: 't',
    method: 'equal',
    classCount: 9,
    rangeMode: 'manual',
    rangeMin: TEMP_DOMAIN[0],
    rangeMax: TEMP_DOMAIN[1],
    ramp: { id: 'heat', invert: false, stops: null },
    continuous: true,
    line: { width: 1.2, opacity: 0.9 },
  },
  blocks: { polygon: { fill: 'var(--accent)', fillOpacity: 0.12, outline: 'var(--accent)', outlineWidth: 1 } },
  sealing: {
    renderer: 'graduatedSize',
    field: 'sealing',
    rangeMode: 'manual',
    rangeMin: 0,
    rangeMax: 100,
    sizeMin: 1,
    sizeMax: 8,
    point: { fill: 'var(--seal-4)', fillOpacity: 0.65, strokeWidth: 0 },
    extrude: { size: 300 },
  },
  hospitals: { point: { fill: 'var(--level-high)', size: 12, strokeWidth: 2 } },
  water: { point: { fill: 'var(--accent-2)', size: 12, strokeWidth: 2 } },
  lstRaster: {
    renderer: 'pseudocolor',
    opacity: 0.8,
    ramp: { id: 'heat', invert: false, stops: null },
    raster: { statsMode: 'manual', min: TEMP_DOMAIN[0], max: TEMP_DOMAIN[1] },
  },
  hazardRaster: { renderer: 'paletted', opacity: 0.75, ramp: { id: 'YlOrRd', invert: false, stops: null }, raster: { resampling: 'nearest' } },
  hillshade: { renderer: 'hillshade' },
  // Footprints outlined in their type colour over a faint tint; buffers dashed in neutral grey.
  measures: {
    renderer: 'categorized',
    field: 'type',
    showOther: false,
    polygon: { fillOpacity: 0.16, outlineWidth: 2, outlineFromClass: true },
    presetClasses: MEASURE_TYPES.map((m) => ({ value: m.id, color: m.color, label: t.measures.types[m.id], visible: true })),
  },
  measureBuffers: { line: { color: 'var(--unc-suppress)', width: 1.25, opacity: 0.9, dash: 'dash', cap: 'butt' } },
};

/** Deep merge for plain objects; arrays and scalars from `over` replace those in `base`. */
export function deepMerge(base, over) {
  if (over == null) return clone(base);
  const out = clone(base);
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = deepMerge(base[k], v);
    else if (v !== undefined) out[k] = clone(v);
  }
  return out;
}

/** Numeric range [min, max] used for raster stretching. */
export function rasterRange(def, style) {
  const r = style.raster;
  if (r.statsMode === 'manual') return [r.min, r.max];
  const s = stats(fieldValues(def));
  return r.statsMode === 'cut' ? [percentile(s.sorted, 0.02), percentile(s.sorted, 0.98)] : [s.min, s.max];
}

/** The class list a style should have for its current settings (colours and labels reset). */
export function buildClasses(def, style) {
  if (def.geometry === 'raster') {
    if (style.renderer === 'paletted') {
      const known = def.raster.classes;
      const values = known?.map((k) => k.value) ?? uniqueValues(fieldValues(def)).map((u) => u.value).sort((a, b) => a - b);
      return values.map((value) => ({ value, color: null, label: known?.find((k) => k.value === value)?.label ?? null, visible: true }));
    }
    return [];
  }
  if (!style.field) return [];
  if (style.renderer === 'categorized') {
    const rows = fieldValues(def, style.field);
    const field = def.fields.find((f) => f.key === style.field);
    const raw = field?.type === 'number' ? rows : (layerData(def)?.features ?? []).map((f) => f.properties[style.field]);
    return uniqueValues(raw).map(({ value }) => ({ value, color: null, label: field?.labels?.[value] ?? null, visible: true }));
  }
  if (style.renderer === 'graduated') {
    const values = fieldValues(def, style.field, style.normalizeBy);
    const manual = style.method === 'manual' && style.classes.length ? [style.classes[0].from, ...style.classes.map((c) => c.to)] : null;
    const breaks = computeBreaks(values, style.method, style.classCount, {
      range: style.rangeMode === 'manual' ? [style.rangeMin, style.rangeMax] : null,
      sdInterval: style.sdInterval,
      interval: style.interval,
      manual,
    });
    return breaks.slice(0, -1).map((from, i) => ({ from, to: breaks[i + 1], color: null, label: null, visible: true }));
  }
  return [];
}

/** Default style of a layer (today's look), with its classes built. */
export function defaultStyle(def) {
  const style = deepMerge(BASE, OVERRIDES[def.id]);
  if (!style.field && def.fields) style.field = (def.fields.find((f) => f.type === 'number' && f.kind !== 'coord') ?? def.fields[1] ?? def.fields[0])?.key ?? null;
  // Labels default to the layer's name-like field, else its main value.
  if (def.fields) style.label.field = (def.fields.find((f) => f.kind === 'text') ?? def.fields.find((f) => f.key === style.field) ?? def.fields[0]).key;
  // 3D height defaults to the main value field (a number field for categorized layers).
  const numeric = (def.fields ?? []).filter((f) => f.type === 'number' && f.kind !== 'coord');
  style.extrude.field = numeric.find((f) => f.key === style.field)?.key ?? numeric[0]?.key ?? null;
  style.classes = style.presetClasses ?? buildClasses(def, style);
  delete style.presetClasses;
  return style;
}

export const DEFAULT_STYLES = Object.fromEntries(LAYERS.map((def) => [def.id, defaultStyle(def)]));

/** A saved or imported style made safe for its layer: missing settings filled from the defaults. */
export function normalizeStyle(def, saved) {
  const base = DEFAULT_STYLES[def.id];
  if (!saved || typeof saved !== 'object') return clone(base);
  // Styles saved before the 3D tab kept polygon extrusion under polygon.extrude*.
  const old = saved.polygon;
  if (old?.extrude && !saved.extrude) saved = { ...saved, extrude: { enabled: true, field: old.extrudeField ?? base.extrude.field, base: old.extrudeBase ?? 0 } };
  const style = deepMerge(base, saved);
  if (style.polygon) ['extrude', 'extrudeField', 'extrudeScale', 'extrudeBase'].forEach((k) => delete style.polygon[k]);
  if (def.fields && !def.fields.some((f) => f.key === style.extrude.field && f.type === 'number')) style.extrude.field = base.extrude.field;
  if (!renderersFor(def).includes(style.renderer)) style.renderer = base.renderer;
  if (def.fields && style.field && !def.fields.some((f) => f.key === style.field)) {
    style.field = base.field;
    style.classes = buildClasses(def, style);
  }
  if (!Array.isArray(style.classes)) style.classes = buildClasses(def, style);
  return style;
}
