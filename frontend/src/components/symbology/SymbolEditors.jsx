import { t } from '../../i18n';
import { numericFields } from '../../lib/layers';
import { isIconMarker, MARKERS, PATTERNS } from '../../lib/mapImages';
import { useSymbology } from '../../state/symbology';
import { LegendSwatch } from '../LayerLegend';
import { Check, ColorField, Field, NumberField, Section, Segmented, Select, Slider, TextField } from '../controls';
import { RampPicker } from './Classification';

const s = t.symbology;
const pct = (v) => `${Math.round(v * 100)}%`;
const px = (v) => `${v} px`;
const deg = (v) => `${v}°`;

// Renderers that colour features by class: the symbol colour is then only the base.
const classed = (style) => ['categorized', 'graduated', 'rules'].includes(style.renderer);

function useSetter(id) {
  const update = useSymbology((st) => st.update);
  return (path) => (v) => update(id, path, v);
}

/** Grid of marker shapes and icons, each drawn as its own legend swatch. */
function MarkerPicker({ id, symbol }) {
  const set = useSetter(id);
  return (
    <div role="radiogroup" aria-label={s.marker} className="grid grid-cols-7 gap-1">
      {MARKERS.map((m) => {
        const on = symbol.marker === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={s.markers[m]}
            title={s.markers[m]}
            onClick={() => set('point.marker')(m)}
            className={`grid h-8 place-items-center border ${on ? 'border-accent-line bg-accent-soft' : 'border-border hover:bg-hover'}`}
          >
            <LegendSwatch swatch={{ geometry: 'point', symbol: { ...symbol, marker: m, strokeWidth: Math.min(1, symbol.strokeWidth) }, color: symbol.fill, size: 14 }} />
          </button>
        );
      })}
    </div>
  );
}

export function PointSymbolSection({ id, style }) {
  const set = useSetter(id);
  const p = style.point;
  const icon = isIconMarker(p.marker);
  const sized = style.renderer === 'graduatedSize';
  return (
    <Section title={classed(style) ? s.baseSymbol : s.symbol}>
      <MarkerPicker id={id} symbol={p} />
      {icon && <Check checked={p.badge} onChange={set('point.badge')} label={s.badge} hint={s.badgeHint} />}
      {!sized && <Slider label={s.size} value={p.size} min={2} max={48} step={0.5} onChange={set('point.size')} format={px} />}
      {!classed(style) && (
        <Field label={icon && !p.badge ? s.iconColor : s.fill}>
          <ColorField value={p.fill} onChange={set('point.fill')} label={s.fill} />
        </Field>
      )}
      <Slider label={s.fillOpacity} value={p.fillOpacity} min={0} max={1} step={0.05} onChange={set('point.fillOpacity')} format={pct} />
      {icon && p.badge && (
        <Field label={s.glyph}>
          <ColorField value={p.glyph} onChange={set('point.glyph')} label={s.glyph} />
        </Field>
      )}
      <Field label={icon && !p.badge ? s.halo : s.stroke}>
        <ColorField value={p.stroke} onChange={set('point.stroke')} label={s.stroke} />
      </Field>
      <Slider label={icon && !p.badge ? s.haloWidth : s.strokeWidth} value={p.strokeWidth} min={0} max={8} step={0.5} onChange={set('point.strokeWidth')} format={px} />
      <Slider label={s.strokeOpacity} value={p.strokeOpacity} min={0} max={1} step={0.05} onChange={set('point.strokeOpacity')} format={pct} />
      {p.marker !== 'circle' && <Slider label={s.rotation} value={p.rotation} min={0} max={359} onChange={set('point.rotation')} format={deg} />}
      {p.marker === 'circle' && <Slider label={s.blur} value={p.blur} min={0} max={1} step={0.05} onChange={set('point.blur')} format={pct} />}
      <Field label={s.offset}>
        <span className="text-xs text-muted">X</span>
        <NumberField value={p.offsetX} min={-50} max={50} label={s.offsetX} className="w-14" onChange={set('point.offsetX')} />
        <span className="text-xs text-muted">Y</span>
        <NumberField value={p.offsetY} min={-50} max={50} label={s.offsetY} className="w-14" onChange={set('point.offsetY')} />
      </Field>
    </Section>
  );
}

const DASH_OPTIONS = ['solid', 'dash', 'dot', 'dashdot', 'longdash', 'custom'];

function DashSelect({ value, onChange, label, symbol, allowCustom = true }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      label={label}
      options={DASH_OPTIONS.filter((d) => allowCustom || d !== 'custom').map((d) => ({
        value: d,
        label: s.dashes[d],
        preview: d !== 'custom' && <LegendSwatch swatch={{ geometry: 'line', symbol: { ...symbol, dash: d, casing: false, opacity: 1 }, color: 'var(--text)', size: 2 }} box={28} />,
      }))}
    />
  );
}

export function LineSymbolSection({ id, style }) {
  const set = useSetter(id);
  const l = style.line;
  return (
    <Section title={classed(style) ? s.baseSymbol : s.symbol}>
      {!classed(style) && (
        <Field label={s.color}>
          <ColorField value={l.color} onChange={set('line.color')} label={s.color} />
        </Field>
      )}
      {style.renderer !== 'graduatedSize' && <Slider label={s.width} value={l.width} min={0.25} max={12} step={0.25} onChange={set('line.width')} format={px} />}
      <Slider label={s.opacity} value={l.opacity} min={0} max={1} step={0.05} onChange={set('line.opacity')} format={pct} />
      <Field label={s.dash}>
        <DashSelect value={l.dash} onChange={set('line.dash')} label={s.dash} symbol={l} />
      </Field>
      {l.dash === 'custom' && (
        <Field label={s.customDash} hint={s.customDashHint}>
          <TextField value={l.customDash} onChange={set('line.customDash')} label={s.customDash} placeholder="4 2" />
        </Field>
      )}
      <Field label={s.cap}>
        <Segmented value={l.cap} onChange={set('line.cap')} label={s.cap} options={['butt', 'round', 'square'].map((v) => ({ value: v, label: s.caps[v] }))} />
      </Field>
      <Field label={s.join}>
        <Segmented value={l.join} onChange={set('line.join')} label={s.join} options={['miter', 'round', 'bevel'].map((v) => ({ value: v, label: s.joins[v] }))} />
      </Field>
      <Slider label={s.lineOffset} value={l.offset} min={-10} max={10} step={0.5} onChange={set('line.offset')} format={px} />
      <Slider label={s.blur} value={l.blur} min={0} max={5} step={0.25} onChange={set('line.blur')} format={px} />
      <Check checked={l.casing} onChange={set('line.casing')} label={s.casing} hint={s.casingHint} />
      {l.casing && (
        <>
          <Field label={s.casingColor}>
            <ColorField value={l.casingColor} onChange={set('line.casingColor')} label={s.casingColor} />
          </Field>
          <Slider label={s.casingWidth} value={l.casingWidth} min={0.5} max={6} step={0.25} onChange={set('line.casingWidth')} format={px} />
        </>
      )}
    </Section>
  );
}

export function PolygonSymbolSection({ def, id, style }) {
  const set = useSetter(id);
  const g = style.polygon;
  const numeric = numericFields(def);
  return (
    <Section title={classed(style) ? s.baseSymbol : s.symbol}>
      <Check checked={g.noFill} onChange={set('polygon.noFill')} label={s.noFill} />
      {!g.noFill && (
        <>
          {!classed(style) && (
            <Field label={s.fill}>
              <ColorField value={g.fill} onChange={set('polygon.fill')} label={s.fill} />
            </Field>
          )}
          <Slider label={s.fillOpacity} value={g.fillOpacity} min={0} max={1} step={0.05} onChange={set('polygon.fillOpacity')} format={pct} />
          <Field label={s.pattern}>
            <Select
              value={g.pattern}
              onChange={set('polygon.pattern')}
              label={s.pattern}
              options={PATTERNS.map((p) => ({
                value: p,
                label: s.patterns[p],
                preview: <LegendSwatch swatch={{ geometry: 'polygon', symbol: { ...g, pattern: p, outlineWidth: 1, outline: 'var(--border-strong)', fillOpacity: 1 }, color: 'var(--text)' }} />,
              }))}
            />
          </Field>
          {g.pattern !== 'solid' && (
            <>
              <Slider label={s.spacing} value={g.patternSpacing} min={4} max={24} onChange={set('polygon.patternSpacing')} format={px} />
              <Slider label={s.lineWidth} value={g.patternWidth} min={0.5} max={4} step={0.25} onChange={set('polygon.patternWidth')} format={px} />
              <Check checked={g.patternBackground} onChange={set('polygon.patternBackground')} label={s.patternBackground} />
            </>
          )}
        </>
      )}
      <Field label={s.outline}>
        <ColorField value={g.outline} onChange={set('polygon.outline')} label={s.outline} />
      </Field>
      <Slider label={s.outlineWidth} value={g.outlineWidth} min={0} max={6} step={0.25} onChange={set('polygon.outlineWidth')} format={px} />
      {classed(style) && <Check checked={g.outlineFromClass} onChange={set('polygon.outlineFromClass')} label={s.outlineFromClass} />}
      {g.outlineWidth > 0 && (
        <>
          <Slider label={s.outlineOpacity} value={g.outlineOpacity} min={0} max={1} step={0.05} onChange={set('polygon.outlineOpacity')} format={pct} />
          <Field label={s.dash}>
            <DashSelect value={g.outlineDash} onChange={set('polygon.outlineDash')} label={s.dash} symbol={{ ...style.line, width: 2 }} allowCustom={false} />
          </Field>
        </>
      )}
      <Check checked={g.extrude} onChange={set('polygon.extrude')} label={s.extrude} hint={s.extrudeHint} />
      {g.extrude && (
        <>
          <Field label={s.heightField}>
            <Select
              value={g.extrudeField ?? ''}
              onChange={(v) => set('polygon.extrudeField')(v || null)}
              label={s.heightField}
              options={[{ value: '', label: s.none }, ...numeric.map((f) => ({ value: f.key, label: f.label }))]}
            />
          </Field>
          <Slider label={s.heightScale} value={g.extrudeScale} min={1} max={200} onChange={set('polygon.extrudeScale')} format={(v) => `× ${v}`} />
          <Field label={s.base}>
            <NumberField value={g.extrudeBase} min={0} label={s.base} onChange={set('polygon.extrudeBase')} />
            <span className="text-xs text-muted">m</span>
          </Field>
        </>
      )}
    </Section>
  );
}

export function HeatmapSection({ def, id, style }) {
  const update = useSymbology((st) => st.update);
  const h = style.heatmap;
  const setH = (key) => (v) => update(id, 'heatmap', { ...h, [key]: v });
  return (
    <Section title={s.renderers.heatmap}>
      <Slider label={s.radius} value={h.radius} min={2} max={60} onChange={setH('radius')} format={px} />
      <Slider label={s.intensity} value={h.intensity} min={0.1} max={5} step={0.1} onChange={setH('intensity')} />
      <Field label={s.weight}>
        <Select
          value={h.weightField ?? ''}
          onChange={(v) => setH('weightField')(v || null)}
          label={s.weight}
          options={[{ value: '', label: s.none }, ...numericFields(def).map((f) => ({ value: f.key, label: f.label }))]}
        />
      </Field>
      <RampPicker id={id} style={style} />
      <Slider label={s.opacity} value={h.opacity} min={0} max={1} step={0.05} onChange={setH('opacity')} format={pct} />
    </Section>
  );
}

export function ClusterSection({ id, style }) {
  const update = useSymbology((st) => st.update);
  const c = style.cluster;
  const setC = (key) => (v) => update(id, 'cluster', { ...c, [key]: v });
  return (
    <Section title={s.renderers.cluster}>
      <Slider label={s.clusterRadius} value={c.radius} min={10} max={100} onChange={setC('radius')} format={px} />
      <Slider label={s.clusterMaxZoom} value={c.maxZoom} min={4} max={18} onChange={setC('maxZoom')} />
      <Field label={s.clusterColor}>
        <ColorField value={c.color} onChange={setC('color')} label={s.clusterColor} />
      </Field>
      <Check checked={c.showCount} onChange={setC('showCount')} label={s.showCount} />
    </Section>
  );
}

export function RasterRenderingSection({ id, style }) {
  const update = useSymbology((st) => st.update);
  const r = style.raster;
  const setR = (key) => (v) => update(id, 'raster', { ...r, [key]: v });
  return (
    <Section title={s.rendering} defaultOpen={false}>
      <Slider label={s.brightnessMin} value={r.brightnessMin} min={0} max={1} step={0.05} onChange={setR('brightnessMin')} format={pct} />
      <Slider label={s.brightnessMax} value={r.brightnessMax} min={0} max={1} step={0.05} onChange={setR('brightnessMax')} format={pct} />
      <Slider label={s.contrast} value={r.contrast} min={-1} max={1} step={0.05} onChange={setR('contrast')} format={pct} />
      <Slider label={s.saturation} value={r.saturation} min={-1} max={1} step={0.05} onChange={setR('saturation')} format={pct} />
      <Slider label={s.hue} value={r.hue} min={0} max={359} onChange={setR('hue')} format={deg} />
      <Field label={s.resampling}>
        <Segmented value={r.resampling} onChange={setR('resampling')} label={s.resampling} options={[{ value: 'linear', label: s.bilinear }, { value: 'nearest', label: s.nearest }]} />
      </Field>
    </Section>
  );
}

export function HillshadeSection({ id, style }) {
  const update = useSymbology((st) => st.update);
  const h = style.hillshade;
  const setH = (key) => (v) => update(id, 'hillshade', { ...h, [key]: v });
  return (
    <Section title={s.renderers.hillshade}>
      <Slider label={s.exaggeration} value={h.exaggeration} min={0} max={1} step={0.05} onChange={setH('exaggeration')} format={pct} />
      <Slider label={s.sunDirection} value={h.direction} min={0} max={359} onChange={setH('direction')} format={deg} />
      <Field label={s.lightAnchor}>
        <Segmented value={h.anchor} onChange={setH('anchor')} label={s.lightAnchor} options={[{ value: 'map', label: s.anchorMap }, { value: 'viewport', label: s.anchorViewport }]} />
      </Field>
      <Field label={s.shadow}>
        <ColorField value={h.shadow} onChange={setH('shadow')} label={s.shadow} />
      </Field>
      <Field label={s.highlight}>
        <ColorField value={h.highlight} onChange={setH('highlight')} label={s.highlight} />
      </Field>
      <Field label={s.accent}>
        <ColorField value={h.accent} onChange={setH('accent')} label={s.accent} />
      </Field>
    </Section>
  );
}

