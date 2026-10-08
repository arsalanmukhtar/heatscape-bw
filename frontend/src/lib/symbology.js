import { contrastText, resolveColor, withAlpha } from './color';
import { stats } from './classify';
import { heightExpr, solidData } from './extrude';
import { labelLayers, shownUntil } from './labels';
import { fieldValues, layerData } from './layers';
import { activeQuery, labelData, preparedData } from './prepared';
import { bake, isIconMarker, markerId, patternId } from './mapImages';
import { rampColors } from './ramps';
import { rasterSource } from './rasterImage';
import { rasterRange } from './styleModel';
import { TILED, tileUrl } from '../state/live';

/*
  Style → Mapbox. buildLayerSpec turns one layer's style into a source and the Mapbox
  layers that draw it (ids "<layer>:<role>", e.g. "hospitals:symbol"). Every layer of
  one map layer moves together in the draw order (MapView), so casings and outlines stay
  with their layer. Colours are resolved to literals here (token colours follow the theme).
*/
const TRANSPARENT = 'rgba(0,0,0,0)';
const DEM_URL = 'mapbox://mapbox.mapbox-terrain-dem-v1';
export const CLUSTER_FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

export const DASHES = { solid: null, dash: [4, 3], dot: [0.5, 2], dashdot: [4, 2, 0.5, 2], longdash: [8, 4] };

export function dashArray(dash, custom) {
  if (dash === 'custom') {
    const parts = String(custom ?? '')
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 0);
    return parts.length >= 2 ? parts : null;
  }
  return DASHES[dash] ?? null;
}

/** Value a renderer reads per feature: the field, optionally divided by a second field. */
export function valueExpr(style) {
  const v = ['to-number', ['get', style.field], 0];
  return style.normalizeBy ? ['/', v, ['max', ['to-number', ['get', style.normalizeBy], 0], 1e-9]] : v;
}

/** Resolved colour of every class: its own colour, else the ramp's. */
export function classColors(style) {
  const ramp = rampColors(style.ramp, style.classes.length);
  return style.classes.map((c, i) => resolveColor(c.color ?? ramp[i]));
}

const identity = (c) => c;

/** Colour (or image id, through toOut) per feature for categorized / graduated renderers. */
function byClass(style, base, toOut = identity) {
  if (style.renderer === 'rules') {
    // __rule is the index of the first matching rule (prepared.js), -1 for "else".
    const pairs = style.rules.flatMap((r, i) => [i, toOut(resolveColor(r.color))]);
    const fallback = toOut(style.elseRule.visible ? resolveColor(style.elseRule.color) : TRANSPARENT);
    return pairs.length ? ['match', ['get', '__rule'], ...pairs, fallback] : fallback;
  }
  const colors = classColors(style);
  const classes = style.classes;
  if (style.renderer === 'categorized' && classes.length) {
    const fallback = style.showOther ? toOut(resolveColor(style.otherColor)) : toOut(TRANSPARENT);
    const pairs = classes.flatMap((c, i) => [String(c.value), toOut(colors[i])]);
    return ['match', ['to-string', ['get', style.field]], ...pairs, fallback];
  }
  if (style.renderer === 'graduated' && classes.length) {
    const v = valueExpr(style);
    if (classes.length === 1) return toOut(colors[0]);
    // Continuous colour only for plain colours; images (icons, patterns) always step.
    const lo = classes[0].from;
    const hi = classes[classes.length - 1].to;
    if (style.continuous && toOut === identity && hi > lo) {
      const stops = colors.flatMap((c, i) => [lo + ((hi - lo) * i) / (colors.length - 1), c]);
      return ['interpolate', ['linear'], v, ...stops];
    }
    // Step stops must ascend strictly; classes edited by hand may not, so skip any that do not.
    const steps = [];
    let last = -Infinity;
    classes.slice(1).forEach((c, i) => {
      if (c.from > last) {
        steps.push(c.from, toOut(colors[i + 1]));
        last = c.from;
      }
    });
    return ['step', v, toOut(colors[0]), ...steps];
  }
  return toOut(resolveColor(base));
}

/** Filter hiding classes switched off in the class list (and "other" values). */
function classFilter(style) {
  if (style.renderer === 'rules') {
    const hidden = style.rules.map((r, i) => (r.visible ? null : i)).filter((i) => i != null);
    if (!style.elseRule.visible) hidden.push(-1);
    return hidden.length ? ['!', ['in', ['get', '__rule'], ['literal', hidden]]] : null;
  }
  const classes = style.classes;
  if (style.renderer === 'categorized' && classes.length) {
    const key = ['to-string', ['get', style.field]];
    const shown = classes.filter((c) => c.visible).map((c) => String(c.value));
    const hidden = classes.filter((c) => !c.visible).map((c) => String(c.value));
    if (!style.showOther) return ['in', key, ['literal', shown]];
    return hidden.length ? ['!', ['in', key, ['literal', hidden]]] : null;
  }
  if (style.renderer === 'graduated' && classes.some((c) => !c.visible)) {
    const v = valueExpr(style);
    const last = classes.length - 1;
    const hidden = classes
      .map((c, i) => (c.visible ? null : ['all', ['>=', v, c.from], [i === last ? '<=' : '<', v, c.to]]))
      .filter(Boolean);
    return ['!', ['any', ...hidden]];
  }
  return null;
}

/** [min, max] the graduated-size renderer maps onto sizeMin…sizeMax. */
function sizeDomain(def, style) {
  if (style.rangeMode === 'manual') return [style.rangeMin, style.rangeMax];
  const s = stats(fieldValues(def, style.field, style.normalizeBy));
  return [s.min, s.max === s.min ? s.min + 1 : s.max];
}

function sizeExpr(def, style, at) {
  const [lo, hi] = sizeDomain(def, style);
  return ['interpolate', ['linear'], valueExpr(style), lo, at(style.sizeMin), hi, at(style.sizeMax)];
}

const withFilter = (spec, ...filters) => {
  const f = filters.filter(Boolean);
  return f.length ? { ...spec, filter: f.length === 1 ? f[0] : ['all', ...f] } : spec;
};

function pointLayers(def, style, op, id, extraFilter) {
  const p = style.point;
  const sized = style.renderer === 'graduatedSize';
  const filter = classFilter(style);
  if (p.marker === 'circle') {
    return [
      withFilter(
        {
          id: `${id}:circle`,
          type: 'circle',
          paint: {
            'circle-radius': sized ? sizeExpr(def, style, (d) => d / 2) : p.size / 2,
            'circle-color': byClass(style, p.fill),
            'circle-opacity': p.fillOpacity * op,
            'circle-stroke-color': resolveColor(p.stroke),
            'circle-stroke-width': p.strokeWidth,
            'circle-stroke-opacity': p.strokeOpacity * op,
            'circle-blur': p.blur,
            'circle-translate': [p.offsetX, p.offsetY],
          },
        },
        filter,
        extraFilter,
      ),
    ];
  }
  const base = sized ? style.sizeMax : p.size;
  const image = (color) =>
    markerId({
      marker: p.marker,
      size: base,
      fill: bake(color, p.fillOpacity),
      stroke: bake(p.stroke, p.strokeOpacity),
      strokeWidth: p.strokeWidth,
      glyph: bake(p.glyph),
      badge: p.badge || !isIconMarker(p.marker),
    });
  return [
    withFilter(
      {
        id: `${id}:symbol`,
        type: 'symbol',
        layout: {
          'icon-image': byClass(style, p.fill, image),
          'icon-size': sized ? sizeExpr(def, style, (d) => d / base) : 1,
          'icon-rotate': p.rotation,
          'icon-anchor': p.marker === 'pin' ? 'bottom' : 'center',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': op, 'icon-translate': [p.offsetX, p.offsetY] },
      },
      filter,
      extraFilter,
    ),
  ];
}

function vectorLayers(def, style, op) {
  const id = def.id;
  if (def.geometry === 'point') {
    if (style.renderer === 'heatmap') {
      const h = style.heatmap;
      const colors = rampColors(style.ramp, 7);
      const w = h.weightField ? stats(fieldValues(def, h.weightField)) : null;
      return [
        {
          id: `${id}:heatmap`,
          type: 'heatmap',
          paint: {
            'heatmap-radius': h.radius,
            'heatmap-intensity': h.intensity,
            'heatmap-weight': w ? ['interpolate', ['linear'], ['to-number', ['get', h.weightField], 0], w.min, 0, w.max === w.min ? w.min + 1 : w.max, 1] : 1,
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, TRANSPARENT, ...colors.flatMap((c, i) => [(i + 1) / colors.length, c])],
            'heatmap-opacity': h.opacity * op,
          },
        },
      ];
    }
    if (style.renderer === 'cluster') {
      const cl = style.cluster;
      const color = resolveColor(cl.color);
      return [
        {
          id: `${id}:clusters`,
          type: 'circle',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': color,
            'circle-opacity': op,
            'circle-radius': ['step', ['get', 'point_count'], 12, 10, 16, 50, 22],
            'circle-stroke-color': resolveColor(style.point.stroke),
            'circle-stroke-width': 2,
            'circle-stroke-opacity': op,
          },
        },
        {
          id: `${id}:count`,
          type: 'symbol',
          filter: ['has', 'point_count'],
          layout: {
            visibility: cl.showCount ? 'visible' : 'none',
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': CLUSTER_FONT,
            'text-size': 11,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { 'text-color': contrastText(color), 'text-opacity': op },
        },
        ...pointLayers(def, { ...style, renderer: 'single' }, op, `${id}:single`, ['!', ['has', 'point_count']]),
      ];
    }
    return pointLayers(def, style, op, id);
  }

  if (def.geometry === 'line') {
    const l = style.line;
    const sized = style.renderer === 'graduatedSize';
    const width = sized ? sizeExpr(def, style, (d) => d) : l.width;
    const dash = dashArray(l.dash, l.customDash);
    const layout = { 'line-cap': l.cap, 'line-join': l.join };
    const filter = classFilter(style);
    return [
      l.casing &&
        withFilter(
          {
            id: `${id}:casing`,
            type: 'line',
            layout,
            paint: {
              'line-color': resolveColor(l.casingColor),
              'line-width': sized ? ['+', width, l.casingWidth * 2] : l.width + l.casingWidth * 2,
              'line-opacity': l.opacity * op,
              'line-offset': l.offset,
            },
          },
          filter,
        ),
      withFilter(
        {
          id: `${id}:line`,
          type: 'line',
          layout,
          paint: {
            'line-color': byClass(style, l.color),
            'line-width': width,
            'line-opacity': l.opacity * op,
            'line-offset': l.offset,
            'line-blur': l.blur,
            ...(dash ? { 'line-dasharray': dash } : {}),
          },
        },
        filter,
      ),
    ].filter(Boolean);
  }

  // Polygon.
  const g = style.polygon;
  const filter = classFilter(style);
  const patterned = g.pattern !== 'solid';
  const outlineDash = dashArray(g.outlineDash);
  return [
    g.noFill && withFilter({ id: `${id}:hit`, type: 'fill', paint: { 'fill-color': '#000000', 'fill-opacity': 0 } }, filter),
    !g.noFill &&
      (!patterned || g.patternBackground) &&
      withFilter(
        {
          id: `${id}:fill`,
          type: 'fill',
          paint: { 'fill-color': byClass(style, g.fill), 'fill-opacity': g.fillOpacity * op * (patterned ? 0.35 : 1) },
        },
        filter,
      ),
    !g.noFill &&
      patterned &&
      withFilter(
        {
          id: `${id}:pattern`,
          type: 'fill',
          paint: {
            'fill-pattern': byClass(style, g.fill, (c) => patternId({ pattern: g.pattern, color: bake(c), spacing: g.patternSpacing, width: g.patternWidth })),
            'fill-opacity': g.fillOpacity * op,
          },
        },
        filter,
      ),
    g.outlineWidth > 0 &&
      withFilter(
        {
          id: `${id}:outline`,
          type: 'line',
          paint: {
            'line-color': g.outlineFromClass ? byClass(style, g.outline) : resolveColor(g.outline),
            'line-width': g.outlineWidth,
            'line-opacity': g.outlineOpacity * op,
            ...(outlineDash ? { 'line-dasharray': outlineDash } : {}),
          },
        },
        filter,
      ),
  ].filter(Boolean);
}

/** raster-color expression and the stretch range for a raster style. */
export function rasterColorExpr(def, style) {
  const src = rasterSource(def);
  const nodata = resolveColor(style.raster.nodata);
  const val = ['raster-value'];
  if (style.renderer === 'paletted') {
    const colors = classColors(style);
    const steps = style.classes.flatMap((c, i) => [c.value - 0.5, c.visible ? colors[i] : TRANSPARENT]);
    return ['step', val, nodata, ...steps];
  }
  const [min, max] = rasterRange(def, style);
  const hi = max === min ? min + 1 : max;
  const ramp = style.renderer === 'gray' ? { id: 'Greys', invert: !style.ramp.invert } : style.ramp;
  const discrete = style.raster.interpolation === 'discrete';
  const n = discrete ? style.raster.classCount : 9;
  const colors = rampColors(ramp, n);
  const main = discrete
    ? ['step', val, colors[0], ...colors.slice(1).flatMap((c, i) => [min + ((hi - min) * (i + 1)) / n, c])]
    : ['interpolate', ['linear'], val, ...colors.flatMap((c, i) => [min + ((hi - min) * i) / (n - 1), c])];
  return ['case', ['<', val, src.nodata + (src.range[1] - src.range[0]) / 1000], nodata, main];
}

function rasterLayers(def, style, op) {
  if (def.kind === 'dem') {
    const h = style.hillshade;
    return [
      {
        id: `${def.id}:hillshade`,
        type: 'hillshade',
        paint: {
          'hillshade-exaggeration': h.exaggeration,
          'hillshade-illumination-direction': h.direction,
          'hillshade-illumination-anchor': h.anchor,
          'hillshade-shadow-color': withAlpha(h.shadow, op),
          'hillshade-highlight-color': withAlpha(h.highlight, op),
          'hillshade-accent-color': withAlpha(h.accent, op),
        },
      },
    ];
  }
  const src = rasterSource(def);
  const r = style.raster;
  return [
    {
      id: `${def.id}:raster`,
      type: 'raster',
      paint: {
        'raster-opacity': op,
        'raster-color-mix': src.mix,
        'raster-color-range': [Math.min(src.range[0], rasterRange(def, style)[0]), Math.max(src.range[1], rasterRange(def, style)[1])],
        'raster-color': rasterColorExpr(def, style),
        'raster-brightness-min': r.brightnessMin,
        'raster-brightness-max': r.brightnessMax,
        'raster-contrast': r.contrast,
        'raster-saturation': r.saturation,
        'raster-hue-rotate': r.hue,
        'raster-resampling': r.resampling,
        'raster-fade-duration': 0,
      },
    },
  ];
}

// Swaps the raster-value input of a raster-color expression for a feature's value property.
const fromValue = (e) => (Array.isArray(e) ? (e.length === 1 && e[0] === 'raster-value' ? ['get', 'value'] : e.map(fromValue)) : e);

/** The 3D layer (fill-extrusion) that replaces a layer's 2D drawing while its 3D tab is on. */
function extrudeLayer(def, style, op) {
  const x = style.extrude;
  let color = resolveColor(x.color);
  let filter = null;
  if (x.colorMode === 'style') {
    if (def.raster) color = fromValue(rasterColorExpr(def, style));
    else color = byClass(style, def.geometry === 'point' ? style.point.fill : def.geometry === 'line' ? style.line.color : style.polygon.fill);
  }
  if (def.raster) {
    // Classes switched off in a paletted raster drop their cells.
    const hidden = style.renderer === 'paletted' ? style.classes.filter((c) => !c.visible).map((c) => c.value) : [];
    if (hidden.length) filter = ['!', ['in', ['get', 'value'], ['literal', hidden]]];
  } else filter = classFilter(style);
  return withFilter(
    {
      id: `${def.id}:extrude`,
      type: 'fill-extrusion',
      paint: {
        'fill-extrusion-color': color,
        'fill-extrusion-height': heightExpr(def, x),
        'fill-extrusion-base': x.base,
        'fill-extrusion-opacity': x.opacity * op,
        'fill-extrusion-vertical-gradient': x.gradient,
      },
    },
    filter,
  );
}

/** Highlight for features picked by a selection query (map selection colour, above the layer). */
function selectionLayers(def, accent2) {
  const sel = ['==', ['get', '__sel'], true];
  if (def.geometry === 'point')
    return [{ id: `${def.id}:selected`, type: 'circle', filter: sel, paint: { 'circle-radius': 9, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': accent2, 'circle-stroke-width': 2.5 } }];
  if (def.geometry === 'line') return [{ id: `${def.id}:selected`, type: 'line', filter: sel, paint: { 'line-color': accent2, 'line-width': 4, 'line-opacity': 0.85 } }];
  return [
    { id: `${def.id}:selected-fill`, type: 'fill', filter: sel, paint: { 'fill-color': accent2, 'fill-opacity': 0.18 } },
    { id: `${def.id}:selected`, type: 'line', filter: sel, paint: { 'line-color': accent2, 'line-width': 2.5 } },
  ];
}

/**
 * The 3D layer, split when features are picked (selected measure, block, raster pixel, query
 * selection) or have the popup open: those draw as their own extrusion, in the map selection
 * colour or the popup highlight (yellow), so the whole solid is highlighted, not its footprint.
 */
function extrudeLayers(def, style, op, picked, popped) {
  const layer = extrudeLayer(def, style, op);
  if (!picked && !popped) return [layer];
  const where = (...f) => {
    const all = [layer.filter, ...f].filter(Boolean);
    return all.length === 1 ? all[0] : ['all', ...all];
  };
  const solid = (id, filter, color) => ({ ...layer, id, filter, paint: { ...layer.paint, 'fill-extrusion-color': resolveColor(color), 'fill-extrusion-opacity': Math.max(0.9, layer.paint['fill-extrusion-opacity']) } });
  return [
    { ...layer, filter: where(...[picked, popped].filter(Boolean).map((f) => ['!', f])) },
    picked && solid(`${def.id}:extrude-selected`, where(picked, popped && ['!', popped]), 'var(--accent-2)'),
    popped && solid(`${def.id}:extrude-popup`, where(popped), 'var(--feature-highlight)'),
  ].filter(Boolean);
}

/*
  Tiled layers (def.tiles: vector tiles, state/live.js): the properties the browser computes
  (__sel, __rule, __label, __lclass) are not in the tiles, so their expressions read them by
  feature id from the layer's attribute data. A unit cut into several tiles keeps one id, so
  a filter or colour by id covers all of its parts.
*/
const TILE_MAXZOOM = 14; // deeper zooms draw the z14 tiles enlarged (≈ 0.1 px per tile unit)
const byIdCache = new WeakMap();

/** ['match', id, [ids…], value, …, fallback] of one computed property (cached per feature list). */
function byId(features, key, fallback) {
  if (!byIdCache.has(features)) byIdCache.set(features, new Map());
  const m = byIdCache.get(features);
  if (!m.has(key)) {
    const groups = new Map();
    for (const f of features) {
      const v = f.properties[key];
      if (v === undefined || v === fallback) continue;
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push(String(f.properties.id));
    }
    m.set(key, groups.size ? ['match', ['to-string', ['get', 'id']], ...[...groups].flatMap(([v, ids]) => [ids, v]), fallback] : fallback);
  }
  return m.get(key);
}

/** Features kept by a definition query, as a filter by id. */
const keepIds = (features) => (features.length ? ['match', ['to-string', ['get', 'id']], features.map((f) => String(f.properties.id)), true, false] : ['==', ['get', 'id'], '']);

const swap = (e, table) => (!Array.isArray(e) ? e : e[0] === 'get' && e.length === 2 && e[1] in table ? table[e[1]] : e.map((x) => swap(x, table)));

/** A layer spec drawn from the tiles: their source layer, computed properties by id, the definition query's filter. */
function onTiles(l, sourceLayer, table, keep) {
  const each = (o) => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [k, swap(v, table)]));
  const filters = [l.filter && swap(l.filter, table), keep].filter(Boolean);
  return {
    ...l,
    'source-layer': sourceLayer,
    ...(l.paint && { paint: each(l.paint) }),
    ...(l.layout && { layout: each(l.layout) }),
    ...(filters.length && { filter: filters.length === 1 ? filters[0] : ['all', ...filters] }),
  };
}

/**
 * { sourceId, sourceKey, source, layers, solid, terrain, extra } for one map layer. sourceKey
 * changes when the source itself must be rebuilt (clustering on/off), since Mapbox cannot
 * change it in place. solid: the 3D source and layer; terrain: { source, exaggeration } or null.
 * picked: filter of the features to highlight in 3D (2D selections are map overlays);
 * popped: filter of the feature whose popup is open (yellow in 3D).
 */
export function buildLayerSpec(def, style, shown, picked = null, popped = null) {
  const op = style.opacity;
  // A tiled layer draws once its attributes (and with them the tile version) are loaded.
  const version = def.tiles ? layerData(def)?.version : null;
  const visible = shown && (!def.tiles || version != null);
  const dem = def.kind === 'dem';
  // 3D on: polygons extrude from their own source, points, lines and rasters from a derived
  // one (spec.solid); the DEM keeps its hillshade and lends a second source to the terrain.
  const solid = style.extrude.enabled && !dem;
  const prepared = def.raster || dem ? null : preparedData(def, style);
  let source;
  if (dem) source = { type: 'raster-dem', url: DEM_URL, tileSize: 512 };
  else if (def.raster) {
    const { url, coordinates } = rasterSource(def);
    source = { type: 'image', url, coordinates };
  } else if (style.renderer === 'cluster') source = { type: 'geojson', data: prepared.data, cluster: true, clusterRadius: style.cluster.radius, clusterMaxZoom: style.cluster.maxZoom };
  else if (def.tiles) source = { type: 'vector', tiles: [tileUrl(def.id)], maxzoom: TILE_MAXZOOM, promoteId: 'id' };
  else source = { type: 'geojson', data: prepared.data };

  const clustered = source.cluster ? `c${style.cluster.radius}-${style.cluster.maxZoom}` : def.tiles ? `t${version}` : 'p';
  const sourceId = `${def.id}-src`;
  const show = (l) => ({ ...l, layout: { ...l.layout, visibility: visible ? (l.layout?.visibility ?? 'visible') : 'none' } });
  const zoomed = (l) => show({ ...l, minzoom: style.minZoom, maxzoom: shownUntil(style.maxZoom) });
  const selecting = prepared && activeQuery(def, style)?.mode === 'selection' && style.renderer !== 'cluster';
  const flat = def.raster || dem ? rasterLayers(def, style, op) : vectorLayers(def, style, op);
  // In 3D a query selection is highlighted with the picked features instead of a ground outline.
  const hl = [picked, solid && selecting && ['==', ['get', '__sel'], true]].filter(Boolean);
  const solids = solid ? extrudeLayers(def, style, op, hl.length > 1 ? ['any', ...hl] : (hl[0] ?? null), popped) : [];
  const tiled = def.tiles && prepared.data;
  const keep = tiled && activeQuery(def, style)?.mode === 'definition' ? keepIds(prepared.data.features) : null;
  const computed = tiled ? { ...(selecting && { __sel: byId(prepared.data.features, '__sel', false) }), ...(style.renderer === 'rules' && { __rule: byId(prepared.data.features, '__rule', -1) }) } : null;
  const layers = [
    ...(solid ? (def.geometry === 'polygon' ? solids : []) : flat),
    ...(selecting && !solid ? selectionLayers(def, resolveColor('var(--accent-2)')) : []),
  ]
    .map((l) => (tiled ? onTiles(l, TILED[def.id], computed, keep) : l))
    .map(zoomed);

  let solidSpec = null;
  if (dem) solidSpec = { sourceId: `${def.id}-terrain`, sourceKey: `${def.id}-terrain`, source: { type: 'raster-dem', url: DEM_URL, tileSize: 512 }, layers: [] };
  else if (solid && def.geometry !== 'polygon')
    solidSpec = { sourceId: `${def.id}-3d`, sourceKey: `${def.id}-3d`, source: { type: 'geojson', data: solidData(def, style, prepared?.data) }, layers: solids.map(zoomed) };
  const terrain = dem && visible && style.extrude.enabled ? { source: `${def.id}-terrain`, exaggeration: style.extrude.exaggeration } : null;

  // Labels draw from their own point/line source (centroids, inside points, outlines);
  // perimeter labels of a tiled layer draw along the unit outlines in the tiles.
  const labels = prepared ? labelData(def, style) : null;
  const alongTiles = tiled && style.label.placement.polygon === 'perimeter';
  const extra = !labels
    ? []
    : alongTiles
      ? [
          {
            sourceId: `${def.id}-labels`,
            sourceKey: `${def.id}-labels-t${version}`,
            source,
            layers: labelLayers(def, style)
              .map((l) => onTiles(l, TILED[def.id], { __label: byId(labels.features, '__label', ''), __lclass: byId(labels.features, '__lclass', -1) }, keep))
              .map(show),
          },
        ]
      : [{ sourceId: `${def.id}-labels`, sourceKey: `${def.id}-labels`, source: { type: 'geojson', data: labels }, layers: labelLayers(def, style).map(show) }];
  return { sourceId, sourceKey: `${sourceId}-${clustered}`, source, layers, solid: solidSpec, terrain, extra };
}
