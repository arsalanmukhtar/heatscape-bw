import { useMap } from 'react-map-gl/mapbox';
import { LuRotate3D } from 'react-icons/lu';
import { t } from '../../i18n';
import { heightDomain } from '../../lib/extrude';
import { numericFields } from '../../lib/layers';
import { useSymbology } from '../../state/symbology';
import { Check, ColorField, Field, NumberField, Section, Segmented, Select, Slider } from '../controls';

const x3 = t.symbology.extrude;
const m = (v) => `${v} m`;
const pct = (v) => `${Math.round(v * 100)}%`;
const fmt = (v) => (Number.isFinite(v) ? Number(v.toFixed(1)).toLocaleString('en-US') : '–');
const btn = 'flex h-7 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:bg-hover';
const TILT = 55;

/*
  3D tab: draws the layer as fill-extrusions instead of its 2D symbols, with the height from a
  field (or the raster cell value) and the colour from the Style tab or a single colour.
  Polygons rise as they are, points become columns, lines walls, raster cells columns; the
  DEM drapes the map over terrain. Turning 3D on tilts a flat map so the height shows.
*/
export function ExtrudeTab({ def }) {
  const { main } = useMap();
  const style = useSymbology((s) => s.styles[def.id]);
  const update = useSymbology((s) => s.update);
  const x = style.extrude;
  const set = (key, value) => update(def.id, 'extrude', { ...x, [key]: value });
  const kind = def.kind === 'dem' ? 'dem' : def.raster ? 'raster' : def.geometry;

  const tilt = (pitch) => main?.easeTo({ pitch, duration: 800 });
  const enable = (on) => {
    set('enabled', on);
    if (on && (main?.getPitch() ?? TILT) < 20) tilt(TILT);
  };

  const head = (
    <Section title={x3.title}>
      <Check checked={x.enabled} onChange={enable} label={x3.show} />
      <p className="text-2xs text-muted">{x3.hints[kind]}</p>
      <button type="button" onClick={() => tilt((main?.getPitch() ?? 0) < 20 ? TILT : 0)} className={`${btn} self-start`}>
        <LuRotate3D size={13} aria-hidden />
        <span>{x3.tilt}</span>
      </button>
    </Section>
  );

  if (kind === 'dem') {
    return (
      <>
        {head}
        <Section title={x3.terrain}>
          <Slider label={x3.exaggeration} value={x.exaggeration} min={0.5} max={5} step={0.1} onChange={(v) => set('exaggeration', v)} format={(v) => `× ${v}`} />
        </Section>
      </>
    );
  }

  const numeric = numericFields(def);
  const byValue = x.heightMode === 'field' && (kind === 'raster' || x.field);
  const [lo, hi] = byValue ? heightDomain(def, { ...x, rangeMode: 'data' }) : [NaN, NaN];

  return (
    <>
      {head}
      <Section title={x3.height}>
        <Field label={x3.heightFrom}>
          <Segmented
            value={x.heightMode}
            onChange={(v) => set('heightMode', v)}
            label={x3.heightFrom}
            options={[
              { value: 'field', label: kind === 'raster' ? x3.cellValue : x3.field },
              { value: 'constant', label: x3.constant },
            ]}
          />
        </Field>
        {x.heightMode === 'field' && kind !== 'raster' && (
          <Field label={x3.field}>
            <Select value={x.field ?? ''} onChange={(v) => set('field', v || null)} label={x3.field} options={numeric.map((f) => ({ value: f.key, label: f.label }))} />
          </Field>
        )}
        {byValue ? (
          <>
            <Field label={x3.range} hint={x3.rangeHint}>
              <Segmented value={x.rangeMode} onChange={(v) => set('rangeMode', v)} label={x3.range} options={[{ value: 'data', label: x3.fromData }, { value: 'manual', label: x3.manual }]} />
            </Field>
            {x.rangeMode === 'manual' ? (
              <Field label={x3.values}>
                <NumberField value={x.rangeMin} label={x3.valueMin} className="w-20" onChange={(v) => set('rangeMin', v)} />
                <span className="text-xs text-muted">–</span>
                <NumberField value={x.rangeMax} label={x3.valueMax} className="w-20" onChange={(v) => set('rangeMax', v)} />
              </Field>
            ) : (
              <p className="text-2xs tabular-nums text-muted">{x3.dataRange(fmt(lo), fmt(hi))}</p>
            )}
            <Field label={x3.scale}>
              <Segmented value={x.scale} onChange={(v) => set('scale', v)} label={x3.scale} options={[{ value: 'linear', label: x3.linear }, { value: 'sqrt', label: x3.sqrt, title: x3.sqrtHint }]} />
            </Field>
            <Slider label={x3.minHeight} value={x.minHeight} min={0} max={1000} step={10} onChange={(v) => set('minHeight', v)} format={m} />
            <Slider label={x3.maxHeight} value={x.maxHeight} min={50} max={5000} step={50} onChange={(v) => set('maxHeight', v)} format={m} />
          </>
        ) : (
          <Slider label={x3.fixedHeight} value={x.height} min={10} max={3000} step={10} onChange={(v) => set('height', v)} format={m} />
        )}
        <Field label={x3.base} hint={x3.baseHint}>
          <NumberField value={x.base} min={0} step={10} label={x3.base} onChange={(v) => set('base', Math.max(0, v))} />
          <span className="text-xs text-muted">m</span>
        </Field>
      </Section>

      {kind === 'point' && (
        <Section title={x3.footprint}>
          <Field label={x3.shape}>
            <Segmented value={x.shape} onChange={(v) => set('shape', v)} label={x3.shape} options={['square', 'circle', 'hex'].map((v) => ({ value: v, label: x3.shapes[v] }))} />
          </Field>
          <Slider label={x3.size} value={x.size} min={20} max={1000} step={10} onChange={(v) => set('size', v)} format={m} />
        </Section>
      )}
      {kind === 'line' && (
        <Section title={x3.footprint}>
          <Slider label={x3.wallWidth} value={x.width} min={2} max={200} step={1} onChange={(v) => set('width', v)} format={m} />
        </Section>
      )}

      <Section title={x3.color}>
        <Field label={x3.colorFrom}>
          <Segmented value={x.colorMode} onChange={(v) => set('colorMode', v)} label={x3.colorFrom} options={[{ value: 'style', label: x3.fromStyle }, { value: 'single', label: x3.single }]} />
        </Field>
        {x.colorMode === 'single' && (
          <Field label={x3.colorLabel}>
            <ColorField value={x.color} onChange={(v) => set('color', v)} label={x3.colorLabel} />
          </Field>
        )}
        <Slider label={x3.opacity} value={x.opacity} min={0.1} max={1} step={0.05} onChange={(v) => set('opacity', v)} format={pct} />
        <Check checked={x.gradient} onChange={(v) => set('gradient', v)} label={x3.gradient} />
      </Section>
    </>
  );
}
