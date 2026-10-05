import {
  LuBus,
  LuDroplet,
  LuFactory,
  LuFlame,
  LuHospital,
  LuHouse,
  LuLeaf,
  LuSchool,
  LuThermometer,
  LuTreePine,
  LuTriangleAlert,
  LuZap,
} from 'react-icons/lu';
import { parseColor, withAlpha } from './color';

/*
  Marker and fill-pattern images, drawn on a canvas when Mapbox asks for them
  (styleimagemissing). The image id carries every parameter, so a style change simply
  asks for a new id and theme or basemap switches redraw what is needed:
    hs-mk|<marker>|<size>|<fill>|<stroke>|<strokeWidth>|<glyph>|<badge>
    hs-pt|<pattern>|<color>|<spacing>|<lineWidth>
    hs-lb|<fill>|<outline>                  (label background box)
  Colours in ids are literal rgba() strings (stroke and fill alpha baked in).
*/
const RATIO = 2;

export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'cross', 'star', 'pin'];
export const ICONS = {
  hospital: LuHospital,
  water: LuDroplet,
  thermometer: LuThermometer,
  flame: LuFlame,
  tree: LuTreePine,
  leaf: LuLeaf,
  school: LuSchool,
  home: LuHouse,
  factory: LuFactory,
  alert: LuTriangleAlert,
  bus: LuBus,
  power: LuZap,
};
export const MARKERS = [...SHAPES, ...Object.keys(ICONS)];
export const isIconMarker = (m) => m in ICONS;
export const PATTERNS = ['solid', 'hatch45', 'hatch135', 'cross', 'horizontal', 'vertical', 'dots'];

/** Shape outline in a unit box (-1…1), as canvas path commands. */
function shapePath(ctx, shape) {
  ctx.beginPath();
  switch (shape) {
    case 'square':
      ctx.rect(-0.8, -0.8, 1.6, 1.6);
      break;
    case 'triangle':
      ctx.moveTo(0, -0.95);
      ctx.lineTo(0.95, 0.75);
      ctx.lineTo(-0.95, 0.75);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(0, -1);
      ctx.lineTo(1, 0);
      ctx.lineTo(0, 1);
      ctx.lineTo(-1, 0);
      ctx.closePath();
      break;
    case 'cross': {
      const a = 0.32;
      [[-a, -1], [a, -1], [a, -a], [1, -a], [1, a], [a, a], [a, 1], [-a, 1], [-a, a], [-1, a], [-1, -a], [-a, -a]].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      break;
    }
    case 'star':
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.42 : 1;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        if (i) ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
        else ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      }
      ctx.closePath();
      break;
    case 'pin':
      ctx.moveTo(0, 1);
      ctx.bezierCurveTo(-0.15, 0.55, -0.72, 0.18, -0.72, -0.28);
      ctx.arc(0, -0.28, 0.72, Math.PI, 0);
      ctx.bezierCurveTo(0.72, 0.18, 0.15, 0.55, 0, 1);
      ctx.closePath();
      break;
    default:
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
  }
}

// Lucide icons are 24-unit stroke drawings; walk the react-icons element tree and stroke
// it at `size` px. lineWidth is in icon units (2 = the icon's own weight; wider = halo).
function drawIcon(ctx, Icon, color, size, lineWidth = 2) {
  const children = [].concat(Icon({}).props.children ?? []).flat();
  ctx.save();
  ctx.scale(size / 24, size / 24);
  ctx.translate(-12, -12);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const child of children) {
    const a = child?.props ?? {};
    const p = new Path2D();
    switch (child?.type) {
      case 'path':
        p.addPath(new Path2D(a.d));
        break;
      case 'circle':
        p.arc(+a.cx, +a.cy, +a.r, 0, Math.PI * 2);
        break;
      case 'ellipse':
        p.ellipse(+a.cx, +a.cy, +a.rx, +a.ry, 0, 0, Math.PI * 2);
        break;
      case 'rect':
        p.rect(+(a.x ?? 0), +(a.y ?? 0), +a.width, +a.height);
        break;
      case 'line':
        p.moveTo(+a.x1, +a.y1);
        p.lineTo(+a.x2, +a.y2);
        break;
      case 'polyline':
      case 'polygon': {
        const pts = String(a.points).trim().split(/[\s,]+/).map(Number);
        for (let i = 0; i < pts.length; i += 2) (i ? p.lineTo : p.moveTo).call(p, pts[i], pts[i + 1]);
        if (child.type === 'polygon') p.closePath();
        break;
      }
      default:
        continue;
    }
    ctx.stroke(p);
  }
  ctx.restore();
}

function canvas(px) {
  const el = document.createElement('canvas');
  el.width = el.height = Math.max(2, Math.ceil(px * RATIO));
  const ctx = el.getContext('2d');
  ctx.scale(RATIO, RATIO);
  return { el, ctx };
}

/** Image id for a marker. Colours are literal; size in CSS px. */
export function markerId({ marker, size, fill, stroke, strokeWidth, glyph, badge }) {
  return ['hs-mk', marker, Math.round(size * 2) / 2, fill, stroke, strokeWidth, glyph, badge ? 1 : 0].join('|');
}

function drawMarker([, marker, sizeS, fill, stroke, swS, glyph, badgeS]) {
  const size = +sizeS;
  const sw = +swS;
  const pad = sw + 1;
  const box = size + pad * 2;
  const { el, ctx } = canvas(box);
  ctx.translate(box / 2, box / 2);
  const Icon = ICONS[marker];
  if (Icon && badgeS === '0') {
    // Glyph only: a halo (stroke colour, wider line) under the glyph in the fill colour.
    if (sw > 0) drawIcon(ctx, Icon, stroke, size, 2 + (sw * 2 * 24) / size);
    drawIcon(ctx, Icon, fill, size);
  } else {
    ctx.save();
    ctx.scale(size / 2, size / 2);
    shapePath(ctx, Icon ? 'circle' : marker);
    ctx.restore();
    ctx.fillStyle = fill;
    ctx.fill();
    if (sw > 0) {
      ctx.lineWidth = sw;
      ctx.strokeStyle = stroke;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    if (Icon) drawIcon(ctx, Icon, glyph, size * 0.6);
  }
  return { el, ctx };
}

/** Image id for a fill pattern. */
export function patternId({ pattern, color, spacing, width }) {
  return ['hs-pt', pattern, color, spacing, width].join('|');
}

function drawPattern([, pattern, color, spacingS, widthS]) {
  const s = Math.max(3, +spacingS);
  const w = Math.max(0.5, +widthS);
  const { el, ctx } = canvas(s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = w;
  const line = (x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  // Diagonals are drawn three times (shifted by one tile) so they join across tile edges.
  const diag = (dir) => [-s, 0, s].forEach((d) => (dir > 0 ? line(d, s, d + s, 0) : line(d, 0, d + s, s)));
  if (pattern === 'hatch45' || pattern === 'cross') diag(1);
  if (pattern === 'hatch135' || pattern === 'cross') diag(-1);
  if (pattern === 'horizontal') line(0, s / 2, s, s / 2);
  if (pattern === 'vertical') line(s / 2, 0, s / 2, s);
  if (pattern === 'dots') {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, w * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  return { el, ctx };
}

// Label background: a 24 px box, fill + 1 px outline. Only its middle stretches to fit the
// text (stretchX/Y, in image pixels), so the outline keeps its width at any label size.
const BOX = 24;
function drawLabelBox([, fill, outline]) {
  const { el, ctx } = canvas(BOX);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, BOX, BOX);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, BOX - 1, BOX - 1);
  const a = 4 * RATIO;
  const b = (BOX - 4) * RATIO;
  return { el, ctx, options: { stretchX: [[a, b]], stretchY: [[a, b]], content: [a, a, b, b] } };
}

const DRAW = { 'hs-mk': drawMarker, 'hs-pt': drawPattern, 'hs-lb': drawLabelBox };

/** Adds a generated image for a missing id; returns false for ids it does not own. */
export function addGeneratedImage(map, id) {
  const parts = id.split('|');
  const draw = DRAW[parts[0]];
  if (!draw) return false;
  if (map.hasImage(id)) return true;
  const { el, ctx, options } = draw(parts);
  map.addImage(id, ctx.getImageData(0, 0, el.width, el.height), { pixelRatio: RATIO, ...options });
  return true;
}

/** Literal colour with an opacity baked in, for image ids. */
export const bake = (color, opacity = 1) => withAlpha(color, opacity);
export const isTransparent = (color) => (parseColor(color)?.a ?? 1) === 0;
