import { useMemo, useState } from 'react';
import { LuArrowRightLeft, LuPlus, LuRefreshCw, LuTrash2 } from 'react-icons/lu';
import { t } from '../../i18n';
import { fmtNum, METHODS, stats } from '../../lib/classify';
import { categoryFields, fieldValues, layerRows, numericFields } from '../../lib/layers';
import { autoLabel } from '../../lib/legend';
import { CUSTOM_RAMP, DEFAULT_CUSTOM_STOPS, RAMPS, rampGradient } from '../../lib/ramps';
import { rasterRange } from '../../lib/styleModel';
import { classColors } from '../../lib/symbology';
import { matchesSearch } from '../../lib/search';
import { useSymbology } from '../../state/symbology';
import { Checkbox } from '../Checkbox';
import { Check, ColorField, Field, NumberField, Section, Segmented, Select, TextField } from '../controls';
import { SearchBar } from '../SearchBar';

const s = t.symbology;
const SEARCH_FROM = 8;

/** Ramp dropdown with gradient previews, an invert toggle and, for a custom ramp, its stops. */
export function RampPicker({ id, style }) {
  const update = useSymbology((st) => st.update);
  const ramp = style.ramp;
  const options = [
    ...RAMPS.map((r) => ({ value: r.id, label: r.label, preview: <span className="h-3 w-28 shrink-0" style={{ background: rampGradient({ id: r.id }) }} /> })),
    { value: CUSTOM_RAMP, label: s.customRamp, preview: <span className="h-3 w-28 shrink-0" style={{ background: rampGradient({ id: CUSTOM_RAMP, stops: ramp.stops ?? DEFAULT_CUSTOM_STOPS }) }} /> },
  ];
  const stops = ramp.stops ?? DEFAULT_CUSTOM_STOPS;
  const setStops = (next) => update(id, 'ramp', { ...ramp, stops: next });

  return (
    <>
      <Field label={s.ramp}>
        <Select
          value={ramp.id}
          onChange={(v) => update(id, 'ramp', { ...ramp, id: v, stops: v === CUSTOM_RAMP ? stops : ramp.stops })}
          options={options}
          label={s.ramp}
          className="min-w-0 flex-1"
          menuWidth={300}
          renderValue={() => <span className="h-3 min-w-0 flex-1" style={{ background: rampGradient(ramp) }} />}
        />
        <button
          type="button"
          onClick={() => update(id, 'ramp', { ...ramp, invert: !ramp.invert })}
          aria-pressed={ramp.invert}
          aria-label={s.invert}
          title={s.invert}
          className={`grid size-7 shrink-0 place-items-center border border-border ${ramp.invert ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-text'}`}
        >
          <LuArrowRightLeft size={13} />
        </button>
      </Field>
      {ramp.id === CUSTOM_RAMP && (
        <div className="flex flex-col gap-1.5 border border-border p-2">
          {stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <ColorField value={stop.color} label={s.stopColor(i + 1)} onChange={(c) => setStops(stops.map((x, j) => (j === i ? { ...x, color: c } : x)))} />
              <NumberField value={Math.round(stop.at * 100)} min={0} max={100} label={s.stopAt} className="w-14" onChange={(v) => setStops(stops.map((x, j) => (j === i ? { ...x, at: Math.max(0, Math.min(100, v)) / 100 } : x)))} />
              <span className="text-xs text-muted">%</span>
              <button
                type="button"
                disabled={stops.length <= 2}
                onClick={() => setStops(stops.filter((_, j) => j !== i))}
                aria-label={s.removeStop}
                title={s.removeStop}
                className="ml-auto grid size-7 place-items-center text-muted hover:bg-hover hover:text-text disabled:opacity-30"
              >
                <LuTrash2 size={12} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setStops([...stops, { color: '#ffffff', at: 1 }])} className="flex h-7 items-center gap-1.5 self-start px-1 text-xs text-accent hover:bg-hover">
            <LuPlus size={12} />
            <span>{s.addStop}</span>
          </button>
        </div>
      )}
    </>
  );
}

/** Value histogram (30 bins) with the class breaks or the stretch range marked. */
export function Histogram({ values, marks = [], domain }) {
  const { bins, lo, hi } = useMemo(() => {
    const st = stats(values);
    const [a, b] = domain ?? [st.min, st.max];
    const n = 30;
    const counts = new Array(n).fill(0);
    for (const v of st.sorted) counts[Math.min(n - 1, Math.max(0, Math.floor(((v - a) / (b - a || 1)) * n)))] += 1;
    return { bins: counts, lo: a, hi: b };
  }, [values, domain]);
  const max = Math.max(...bins, 1);
  const x = (v) => ((v - lo) / (hi - lo || 1)) * 300;
  return (
    <figure className="m-0">
      <svg viewBox="0 0 300 56" preserveAspectRatio="none" className="block h-14 w-full border border-border-soft bg-field" role="img" aria-label={s.histogram}>
        {bins.map((c, i) => (
          <rect key={i} x={i * 10 + 0.5} width="9" y={56 - (c / max) * 52} height={(c / max) * 52} fill="var(--border-strong)" />
        ))}
        {marks.map((m, i) => (
          <line key={i} x1={x(m)} x2={x(m)} y1="0" y2="56" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <figcaption className="mt-0.5 flex justify-between text-2xs tabular-nums text-muted">
        <span>{fmtNum(lo, 2)}</span>
        <span>{fmtNum(hi, 2)}</span>
      </figcaption>
    </figure>
  );
}

/** Class list: visibility, colour, value or range, label, feature count. */
export function ClassList({ def, id, style }) {
  const { updateClass } = useSymbology();
  const [query, setQuery] = useState('');
  const colors = classColors(style);
  const graduated = style.renderer === 'graduated';
  const raster = def.geometry === 'raster';

  // Features per class (rasters: cells per class).
  const counts = useMemo(() => {
    if (raster) {
      const v = fieldValues(def);
      return style.classes.map((c) => v.filter((x) => x === c.value).length);
    }
    if (graduated) {
      const v = fieldValues(def, style.field, style.normalizeBy);
      const last = style.classes.length - 1;
      return style.classes.map((c, i) => v.filter((x) => x >= c.from && (i === last ? x <= c.to : x < c.to)).length);
    }
    const rows = layerRows(def);
    return style.classes.map((c) => rows.filter((r) => String(r[style.field]) === String(c.value)).length);
  }, [def, raster, graduated, style.classes, style.field, style.normalizeBy]);

  const rows = style.classes.map((c, i) => ({ c, i })).filter(({ c }) => matchesSearch(query, [c.value ?? '', c.label ?? autoLabel(style, c)]));

  return (
    <div className="flex flex-col gap-1.5">
      {style.classes.length > SEARCH_FROM && <SearchBar value={query} onChange={setQuery} placeholder={s.searchClasses} className="w-full" />}
      <div className="flex h-6 items-center gap-1.5 border-b border-border text-2xs uppercase tracking-[var(--tracking-caps)] text-muted">
        <span className="w-4 shrink-0" />
        <span className="w-5 shrink-0" />
        <span className={graduated ? 'w-[116px] shrink-0' : 'w-16 shrink-0'}>{graduated ? s.range : s.value}</span>
        <span className="min-w-0 flex-1">{s.label}</span>
        <span className="w-9 shrink-0 text-right">{s.count}</span>
      </div>
      <ul className="flex max-h-72 flex-col overflow-y-auto">
        {rows.map(({ c, i }) => (
          <li key={i} className="flex h-8 items-center gap-1.5">
            <Checkbox checked={c.visible} onChange={() => updateClass(id, i, { visible: !c.visible })} label={s.showClass} />
            <ColorField value={colors[i]} onChange={(c) => updateClass(id, i, { color: c })} label={s.classColor} compact size="size-5" />
            {graduated ? (
              <span className="flex w-[116px] shrink-0 items-center gap-1">
                <NumberField value={+c.from.toFixed(style.precision + 1)} step="any" label={s.from} className="w-[54px]" onChange={(v) => updateClass(id, i, { from: v })} />
                <NumberField value={+c.to.toFixed(style.precision + 1)} step="any" label={s.to} className="w-[54px]" onChange={(v) => updateClass(id, i, { to: v })} />
              </span>
            ) : (
              <span className="w-16 shrink-0 truncate text-xs text-text" title={String(c.value)}>
                {String(c.value)}
              </span>
            )}
            <TextField value={c.label ?? ''} placeholder={autoLabel(style, c, raster ? '' : '')} label={s.label} className="min-w-0 flex-1" onChange={(v) => updateClass(id, i, { label: v === '' ? null : v })} />
            <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-muted">{counts[i]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReclassifyButton({ id }) {
  const reclassify = useSymbology((st) => st.reclassify);
  return (
    <button type="button" onClick={() => reclassify(id)} title={s.reclassifyHint} className="flex h-7 items-center gap-1.5 self-start border border-border px-2 text-xs text-text hover:bg-hover">
      <LuRefreshCw size={12} />
      <span>{s.reclassify}</span>
    </button>
  );
}

const fieldOptions = (fields, withNone) => [...(withNone ? [{ value: '', label: s.none }] : []), ...fields.map((f) => ({ value: f.key, label: f.label }))];

/** Range controls shared by graduated colour and size: data range or a manual min/max. */
function RangeFields({ id, style }) {
  const update = useSymbology((st) => st.update);
  return (
    <>
      <Field label={s.rangeFrom}>
        <Segmented value={style.rangeMode} onChange={(v) => update(id, 'rangeMode', v)} label={s.rangeFrom} options={[{ value: 'data', label: s.data }, { value: 'manual', label: s.manual }]} />
      </Field>
      {style.rangeMode === 'manual' && (
        <Field label={s.minMax}>
          <NumberField value={style.rangeMin} step="any" label={s.min} className="w-20" onChange={(v) => update(id, 'rangeMin', v)} />
          <NumberField value={style.rangeMax} step="any" label={s.max} className="w-20" onChange={(v) => update(id, 'rangeMax', v)} />
        </Field>
      )}
    </>
  );
}

/** Settings of the categorized, graduated and graduated-size renderers. */
export function ClassificationSection({ def, id, style }) {
  const update = useSymbology((st) => st.update);
  const set = (path) => (v) => update(id, path, v);
  const numeric = numericFields(def);

  if (style.renderer === 'categorized') {
    return (
      <Section title={s.classification}>
        <Field label={s.field}>
          <Select value={style.field} onChange={set('field')} options={fieldOptions(categoryFields(def))} label={s.field} />
        </Field>
        <RampPicker id={id} style={style} />
        <Field label={s.otherValues}>
          <Check checked={style.showOther} onChange={set('showOther')} label={s.show} />
          {style.showOther && <ColorField value={style.otherColor} onChange={set('otherColor')} label={s.otherValues} />}
        </Field>
        <ClassList def={def} id={id} style={style} />
        <ReclassifyButton id={id} />
      </Section>
    );
  }

  if (style.renderer === 'graduated') {
    const values = fieldValues(def, style.field, style.normalizeBy);
    const usesCount = !['stddev', 'defined'].includes(style.method);
    const usesRange = ['equal', 'defined', 'pretty', 'geometric'].includes(style.method);
    return (
      <Section title={s.classification}>
        <Field label={s.field}>
          <Select value={style.field} onChange={set('field')} options={fieldOptions(numeric)} label={s.field} />
        </Field>
        <Field label={s.normalizeBy} hint={s.normalizeHint}>
          <Select value={style.normalizeBy ?? ''} onChange={(v) => update(id, 'normalizeBy', v || null)} options={fieldOptions(numeric.filter((f) => f.key !== style.field), true)} label={s.normalizeBy} />
        </Field>
        <Field label={s.method}>
          <Select value={style.method} onChange={set('method')} options={METHODS.map((m) => ({ value: m, label: s.methods[m] }))} label={s.method} />
        </Field>
        {usesCount && (
          <Field label={s.classes}>
            <NumberField value={style.classCount} min={2} max={12} label={s.classes} onChange={(v) => update(id, 'classCount', Math.max(2, Math.min(12, Math.round(v))))} />
          </Field>
        )}
        {style.method === 'stddev' && (
          <Field label={s.interval}>
            <Segmented value={style.sdInterval} onChange={set('sdInterval')} label={s.interval} options={[1, 0.5, 0.25].map((v) => ({ value: v, label: `${v} σ` }))} />
          </Field>
        )}
        {style.method === 'defined' && (
          <Field label={s.interval}>
            <NumberField value={style.interval} min={0} step="any" label={s.interval} className="w-20" onChange={(v) => v > 0 && update(id, 'interval', v)} />
          </Field>
        )}
        {usesRange && <RangeFields id={id} style={style} />}
        <Field label={s.precision}>
          <NumberField value={style.precision} min={0} max={4} label={s.precision} onChange={(v) => update(id, 'precision', Math.max(0, Math.min(4, Math.round(v))))} />
        </Field>
        <RampPicker id={id} style={style} />
        <Check checked={style.continuous} onChange={set('continuous')} label={s.continuous} hint={s.continuousHint} />
        <Histogram values={values} marks={style.classes.length ? [style.classes[0].from, ...style.classes.map((c) => c.to)] : []} />
        <ClassList def={def} id={id} style={style} />
        <ReclassifyButton id={id} />
      </Section>
    );
  }

  if (style.renderer === 'graduatedSize') {
    const unit = def.geometry === 'point' ? s.diameter : s.width;
    return (
      <Section title={s.sizeBy}>
        <Field label={s.field}>
          <Select value={style.field} onChange={set('field')} options={fieldOptions(numeric)} label={s.field} />
        </Field>
        <Field label={s.normalizeBy} hint={s.normalizeHint}>
          <Select value={style.normalizeBy ?? ''} onChange={(v) => update(id, 'normalizeBy', v || null)} options={fieldOptions(numeric.filter((f) => f.key !== style.field), true)} label={s.normalizeBy} />
        </Field>
        <RangeFields id={id} style={style} />
        <Field label={`${unit} ${s.min}`}>
          <NumberField value={style.sizeMin} min={0} max={64} step={0.5} label={s.sizeMin} onChange={set('sizeMin')} />
          <span className="text-xs text-muted">px</span>
        </Field>
        <Field label={`${unit} ${s.max}`}>
          <NumberField value={style.sizeMax} min={0} max={64} step={0.5} label={s.sizeMax} onChange={set('sizeMax')} />
          <span className="text-xs text-muted">px</span>
        </Field>
      </Section>
    );
  }
  return null;
}

/** Raster band rendering: ramp, interpolation, stretch (min/max), no-data colour. */
export function RasterBandSection({ def, id, style }) {
  const update = useSymbology((st) => st.update);
  const r = style.raster;
  const setR = (key) => (v) => update(id, 'raster', { ...r, [key]: v });
  const values = fieldValues(def);
  const [min, max] = rasterRange(def, style);
  const transparent = (parseInt(String(r.nodata).slice(7, 9) || 'ff', 16) || 0) === 0 && String(r.nodata).length === 9;

  if (style.renderer === 'paletted') {
    return (
      <Section title={s.paletted}>
        <RampPicker id={id} style={style} />
        <ClassList def={def} id={id} style={style} />
      </Section>
    );
  }

  return (
    <Section title={s.bandRendering}>
      {style.renderer === 'pseudocolor' ? <RampPicker id={id} style={style} /> : <Check checked={style.ramp.invert} onChange={(v) => update(id, 'ramp', { ...style.ramp, invert: v })} label={s.invertGray} />}
      <Field label={s.interpolation}>
        <Segmented value={r.interpolation} onChange={setR('interpolation')} label={s.interpolation} options={[{ value: 'linear', label: s.linear }, { value: 'discrete', label: s.discrete }]} />
      </Field>
      {r.interpolation === 'discrete' && (
        <Field label={s.classes}>
          <NumberField value={r.classCount} min={2} max={12} label={s.classes} onChange={(v) => setR('classCount')(Math.max(2, Math.min(12, Math.round(v))))} />
        </Field>
      )}
      <Field label={s.minMaxFrom}>
        <Select
          value={r.statsMode}
          onChange={(v) => update(id, 'raster', { ...r, statsMode: v, ...(v === 'manual' ? { min: +min.toFixed(2), max: +max.toFixed(2) } : {}) })}
          options={[{ value: 'data', label: s.statsData }, { value: 'cut', label: s.statsCut }, { value: 'manual', label: s.manual }]}
          label={s.minMaxFrom}
        />
      </Field>
      <Field label={s.minMax}>
        {r.statsMode === 'manual' ? (
          <>
            <NumberField value={r.min} step="any" label={s.min} className="w-20" onChange={setR('min')} />
            <NumberField value={r.max} step="any" label={s.max} className="w-20" onChange={setR('max')} />
          </>
        ) : (
          <span className="text-xs tabular-nums text-text">
            {fmtNum(min, 2)} – {fmtNum(max, 2)} {def.raster.unit}
          </span>
        )}
      </Field>
      <Histogram values={values} marks={[min, max]} />
      <Field label={s.nodata}>
        <Check checked={transparent} onChange={(v) => setR('nodata')(v ? '#00000000' : '#000000')} label={s.transparent} />
        {!transparent && <ColorField value={r.nodata} onChange={setR('nodata')} label={s.nodata} />}
      </Field>
    </Section>
  );
}
