import { t } from '../i18n';
import { fmtNum, stats } from './classify';
import { resolveColor } from './color';
import { fieldValues } from './layers';
import { rampColors } from './ramps';
import { rasterRange } from './styleModel';
import { classColors } from './symbology';

/*
  Legend of a layer, generated from its style (so it always matches the map).
  { items: [{ label, swatch }] } for symbol legends, or { ramp: { colors, min, max } } for
  continuous ones. swatch: { geometry, color, size? } plus the layer's symbol settings,
  which LegendSwatch draws.
*/
const lbl = (c, auto) => c.label ?? auto;

/** Automatic class label (used when the class has no label of its own). */
export function autoLabel(style, c, unit = '') {
  if ('value' in c) return String(c.value);
  return `${fmtNum(c.from, style.precision)} – ${fmtNum(c.to, style.precision)}${unit}`;
}

export function legendFor(def, style) {
  const symbol = def.geometry === 'raster' ? null : style[def.geometry];
  const sw = (color, extra) => ({ geometry: def.geometry, symbol, color, ...extra });
  const base = symbol ? resolveColor(symbol.fill ?? symbol.color) : null;
  const unit = def.raster?.unit ?? '';

  switch (style.renderer) {
    case 'categorized':
    case 'graduated': {
      const colors = classColors(style);
      // Continuous colour applies to plain colours; icon markers and patterns always step.
      const plain = !(def.geometry === 'point' && symbol.marker !== 'circle') && !(def.geometry === 'polygon' && symbol.pattern !== 'solid');
      if (style.renderer === 'graduated' && style.continuous && plain) {
        const first = style.classes[0];
        const last = style.classes[style.classes.length - 1];
        return { ramp: { colors, min: fmtNum(first?.from, style.precision), max: fmtNum(last?.to, style.precision) } };
      }
      const items = style.classes.filter((c) => c.visible).map((c) => ({ label: lbl(c, autoLabel(style, c)), swatch: sw(colors[style.classes.indexOf(c)]) }));
      if (style.renderer === 'categorized' && style.showOther) items.push({ label: t.symbology.otherValues, swatch: sw(resolveColor(style.otherColor)) });
      return { items };
    }
    case 'graduatedSize': {
      const [lo, hi] = style.rangeMode === 'manual' ? [style.rangeMin, style.rangeMax] : (({ min, max }) => [min, max])(stats(fieldValues(def, style.field, style.normalizeBy)));
      return {
        items: [0, 0.5, 1].map((k) => ({
          label: fmtNum(lo + (hi - lo) * k, style.precision),
          swatch: sw(base, { size: style.sizeMin + (style.sizeMax - style.sizeMin) * k }),
        })),
      };
    }
    case 'rules': {
      const items = style.rules.filter((r) => r.visible).map((r) => ({ label: r.label || r.filter || t.symbology.rules.untitled, swatch: sw(resolveColor(r.color)) }));
      if (style.elseRule.visible) items.push({ label: t.symbology.rules.else, swatch: sw(resolveColor(style.elseRule.color)) });
      return { items };
    }
    case 'heatmap':
      return { ramp: { colors: rampColors(style.ramp, 7), min: t.symbology.low, max: t.symbology.high } };
    case 'cluster':
      return {
        items: [
          { label: t.symbology.clusterLabel, swatch: { geometry: 'point', symbol: { ...symbol, marker: 'circle' }, color: resolveColor(style.cluster.color), size: 14, count: true } },
          { label: t.symbology.singleFeature, swatch: sw(base) },
        ],
      };
    case 'pseudocolor':
    case 'gray': {
      const [min, max] = rasterRange(def, style);
      const ramp = style.renderer === 'gray' ? { id: 'Greys', invert: !style.ramp.invert } : style.ramp;
      const n = style.raster.interpolation === 'discrete' ? style.raster.classCount : 9;
      return { ramp: { colors: rampColors(ramp, n), min: `${fmtNum(min, 1)}${unit}`, max: `${fmtNum(max, 1)}${unit}`, discrete: style.raster.interpolation === 'discrete' } };
    }
    case 'paletted': {
      const colors = classColors(style);
      return { items: style.classes.filter((c) => c.visible).map((c) => ({ label: lbl(c, String(c.value)), swatch: { geometry: 'raster', color: colors[style.classes.indexOf(c)] } })) };
    }
    case 'hillshade':
      return { ramp: { colors: [resolveColor(style.hillshade.shadow), resolveColor(style.hillshade.highlight)], min: t.symbology.shadow, max: t.symbology.highlight } };
    default:
      return { items: [{ label: t.symbology.allFeatures, swatch: sw(base) }] };
  }
}
