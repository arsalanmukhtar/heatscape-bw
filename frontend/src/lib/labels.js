import { resolveColor, withAlpha } from './color';
import { bake } from './mapImages';

/*
  Label layers (Label tab → Mapbox symbol layer on the label features from prepared.js).
  Fonts are limited to stacks the Mapbox glyph service serves for every basemap; each
  stack falls back to Arial Unicode MS for characters the font lacks.
*/
export const FONTS = {
  'DIN Pro': ['Regular', 'Medium', 'Bold', 'Italic'],
  'Open Sans': ['Regular', 'Semibold', 'Bold', 'Italic'],
  Roboto: ['Regular', 'Medium', 'Bold', 'Italic'],
  'Arial Unicode MS': ['Regular', 'Bold'],
};
export const FONT_FAMILIES = Object.keys(FONTS);
const FALLBACK = 'Arial Unicode MS Regular';

export function fontStack(family, style) {
  const name = `${family} ${FONTS[family]?.includes(style) ? style : 'Regular'}`;
  return name === FALLBACK ? [name] : [name, FALLBACK];
}
const boldOf = (family) => (FONTS[family]?.includes('Bold') ? 'Bold' : FONTS[family]?.[0]);

/** Label position around a point → the Mapbox text-anchor (the side of the text nearest the point). */
const ANCHOR_FOR = {
  center: 'center',
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
  'top-left': 'bottom-right',
  'top-right': 'bottom-left',
  'bottom-left': 'top-right',
  'bottom-right': 'top-left',
};
export const POSITIONS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
// Cartographic order (QGIS "around point"): above right first, as map conventions prefer.
const AUTO_ANCHORS = ['bottom-left', 'bottom', 'left', 'top-left', 'bottom-right', 'right', 'top', 'top-right'];

/** Image id for the label background box (fill + 1 px outline, stretched to the text). */
export const labelBoxId = (fill, outline) => ['hs-lb', fill, outline].join('|');

/** Mapbox layer(s) for the labels of one layer. */
export function labelLayers(def, style) {
  const L = style.label;
  const P = L.placement;
  const visible = L.classes.map((c, i) => (c.visible ? i : null)).filter((i) => i != null);
  const hidden = L.classes.map((c, i) => (c.visible ? null : i)).filter((i) => i != null);
  const byClass = (base, pick) => {
    const pairs = visible.flatMap((i) => [i, pick(L.classes[i])]);
    return pairs.length ? ['match', ['get', '__lclass'], ...pairs, base] : base;
  };
  const font = fontStack(L.font, L.fontStyle);
  const bold = fontStack(L.font, boldOf(L.font));
  // Font stacks are arrays: inside an expression they must be wrapped in "literal".
  const fonts = visible.some((i) => L.classes[i].bold) ? byClass(['literal', font], (c) => ['literal', c.bold ? bold : font]) : font;
  const layout = {
    'text-field': ['get', '__label'],
    'text-font': fonts,
    'text-size': byClass(L.size, (c) => c.size ?? L.size),
    'text-letter-spacing': L.letterSpacing,
    'text-line-height': L.lineHeight,
    'text-max-width': L.maxWidth,
    'text-transform': L.transform,
    'text-justify': L.justify,
    'text-padding': L.padding,
    'text-allow-overlap': L.allowOverlap,
    'text-ignore-placement': L.allowOverlap,
    ...(L.priorityField ? { 'symbol-sort-key': ['-', 0, ['to-number', ['get', L.priorityField], 0]] } : {}),
    ...(P.rotation === 'angle' ? { 'text-rotate': P.angle } : P.rotation === 'field' && P.rotationField ? { 'text-rotate': ['to-number', ['get', P.rotationField], 0] } : {}),
  };

  const along = (def.geometry === 'line' && P.line !== 'horizontal') || (def.geometry === 'polygon' && P.polygon === 'perimeter');
  if (along) {
    Object.assign(layout, {
      'symbol-placement': def.geometry === 'line' ? P.line : 'line',
      'symbol-spacing': P.spacing,
      'text-keep-upright': P.keepUpright,
      'text-max-angle': P.maxAngle,
      'text-offset': [0, P.linePosition === 'above' ? -0.9 : P.linePosition === 'below' ? 0.9 : 0],
    });
  } else if (def.geometry === 'point') {
    if (P.point === 'auto') Object.assign(layout, { 'text-variable-anchor': AUTO_ANCHORS, 'text-radial-offset': P.distance });
    else Object.assign(layout, { 'text-anchor': ANCHOR_FOR[P.anchor] ?? 'center', 'text-radial-offset': P.anchor === 'center' ? 0 : P.distance });
  } else {
    layout['text-anchor'] = 'center';
  }

  const paint = {
    'text-color': byClass(resolveColor(L.color), (c) => resolveColor(c.color ?? L.color)),
    'text-opacity': L.opacity * style.opacity,
    'text-halo-color': L.halo.enabled ? withAlpha(L.halo.color, L.halo.opacity) : 'rgba(0,0,0,0)',
    'text-halo-width': L.halo.enabled ? L.halo.width : 0,
    'text-halo-blur': L.halo.enabled ? L.halo.blur : 0,
  };

  if (L.background.enabled) {
    const p = L.background.padding;
    Object.assign(layout, {
      'icon-image': labelBoxId(bake(L.background.color, L.background.opacity), bake(L.background.outline, L.background.outlineOpacity)),
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [p, p + 1, p, p + 1],
      'icon-allow-overlap': L.allowOverlap,
      'icon-ignore-placement': L.allowOverlap,
      'icon-rotation-alignment': along ? 'map' : 'viewport',
    });
    paint['icon-opacity'] = style.opacity;
  }

  return [
    {
      id: `${def.id}:labels`,
      type: 'symbol',
      label: true,
      layout,
      paint,
      minzoom: L.minZoom,
      maxzoom: L.maxZoom,
      ...(hidden.length ? { filter: ['!', ['in', ['get', '__lclass'], ['literal', hidden]]] } : {}),
    },
  ];
}
