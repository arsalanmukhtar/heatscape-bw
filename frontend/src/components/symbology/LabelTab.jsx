import { LuBold, LuEye, LuEyeOff, LuPlus, LuTrash2 } from 'react-icons/lu';
import { t } from '../../i18n';
import { FONT_FAMILIES, FONTS, POSITIONS } from '../../lib/labels';
import { layerData, numericFields } from '../../lib/layers';
import { exprFields, labelText, preparedData } from '../../lib/prepared';
import { compiled, evaluate } from '../../lib/sqlExpr';
import { useSymbology } from '../../state/symbology';
import { Check, ColorField, Field, NumberField, Section, Segmented, Select, Slider } from '../controls';
import { SearchEmpty } from '../SearchBar';
import { SqlField } from './SqlField';

const l = t.symbology.labels;
const px = (v) => `${v} px`;
const em = (v) => `${v} em`;
const pct = (v) => `${Math.round(v * 100)}%`;
const deg = (v) => `${v}°`;
const btn = 'flex h-7 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:bg-hover';

/** 3 × 3 grid for a fixed label position around a point. */
function PositionPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label={l.position} className="grid w-[6rem] grid-cols-3 gap-0.5">
      {POSITIONS.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          aria-label={l.positions[p]}
          title={l.positions[p]}
          onClick={() => onChange(p)}
          className={`grid h-7 place-items-center border ${value === p ? 'border-accent-line bg-accent-soft' : 'border-border hover:bg-hover'}`}
        >
          <span className={`block ${p === 'center' ? 'size-2 bg-text' : 'h-1 w-3'} ${value === p ? 'bg-accent' : 'bg-muted'}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** Rule-based label classes: first matching class sets colour, size and weight. */
function LabelClasses({ def, label, set }) {
  const fields = exprFields(def);
  const keys = fields.map((f) => f.key);
  const data = layerData(def);
  const setClass = (i, patch) => set('classes', label.classes.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const count = (filter) => {
    const ast = compiled(filter, keys);
    return ast && data ? data.features.filter((f) => evaluate(ast, f.properties)).length : null;
  };
  return (
    <Section title={l.classesTitle} defaultOpen={label.classes.length > 0}>
      <p className="text-2xs text-muted">{l.classesHint}</p>
      {label.classes.map((c, i) => (
        <div key={i} className={`flex flex-col gap-1.5 border border-border bg-field p-2 ${c.visible ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setClass(i, { visible: !c.visible })} aria-pressed={c.visible} aria-label={l.showClass} title={c.visible ? l.hideClass : l.showClass} className="grid size-7 shrink-0 place-items-center border border-border text-text hover:text-accent">
              {c.visible ? <LuEye size={13} /> : <LuEyeOff size={13} />}
            </button>
            <ColorField value={c.color} onChange={(v) => setClass(i, { color: v })} label={l.classColor} compact />
            <NumberField value={c.size} min={6} max={40} label={l.classSize} className="w-14" onChange={(v) => setClass(i, { size: v })} />
            <button type="button" onClick={() => setClass(i, { bold: !c.bold })} aria-pressed={c.bold} aria-label={l.bold} title={l.bold} className={`grid size-7 shrink-0 place-items-center border ${c.bold ? 'border-accent-line bg-accent-soft text-accent' : 'border-border text-muted hover:text-accent'}`}>
              <LuBold size={13} />
            </button>
            <span className="ml-auto text-2xs tabular-nums text-muted">{count(c.filter) ?? '–'}</span>
            <button type="button" onClick={() => set('classes', label.classes.filter((_, j) => j !== i))} aria-label={l.removeClass} title={l.removeClass} className="grid size-7 shrink-0 place-items-center text-muted hover:text-accent">
              <LuTrash2 size={13} />
            </button>
          </div>
          <SqlField value={c.filter} onChange={(v) => setClass(i, { filter: v })} fields={fields} rows={1} label={l.classFilter} placeholder={l.classFilterPlaceholder} compact />
        </div>
      ))}
      <button type="button" onClick={() => set('classes', [...label.classes, { filter: '', color: '#fee08b', size: label.size + 2, bold: true, visible: true }])} className={`${btn} self-start`}>
        <LuPlus size={12} aria-hidden />
        <span>{l.addClass}</span>
      </button>
    </Section>
  );
}

export function LabelTab({ def }) {
  const style = useSymbology((s) => s.styles[def.id]);
  const update = useSymbology((s) => s.update);
  if (!def.fields) return <SearchEmpty>{l.noRaster}</SearchEmpty>;

  const label = style.label;
  const P = label.placement;
  const set = (key, value) => update(def.id, 'label', { ...label, [key]: value });
  const setIn = (group, key, value) => set(group, { ...label[group], [key]: value });
  const fields = exprFields(def);
  const numeric = numericFields(def);
  const sample = (preparedData(def, style).data?.features ?? []).slice(0, 1).map((f) => labelText(def, label, f.properties))[0];

  return (
    <>
      <Section title={l.textTitle}>
        <Check checked={label.enabled} onChange={(v) => set('enabled', v)} label={l.show} />
        <Field label={l.source}>
          <Segmented value={label.mode} onChange={(v) => set('mode', v)} label={l.source} options={[{ value: 'field', label: l.fromField }, { value: 'expression', label: l.fromExpression }]} />
        </Field>
        {label.mode === 'field' ? (
          <Field label={l.field}>
            <Select value={label.field} onChange={(v) => set('field', v)} options={fields.map((f) => ({ value: f.key, label: f.label }))} label={l.field} />
          </Field>
        ) : (
          <SqlField value={label.expression} onChange={(v) => set('expression', v)} fields={fields} kind="label" rows={3} label={l.expression} placeholder={l.expressionPlaceholder} />
        )}
        <Field label={l.decimals}>
          <NumberField value={label.decimals} min={0} max={4} label={l.decimals} onChange={(v) => set('decimals', Math.max(0, Math.min(4, Math.round(v))))} />
        </Field>
        {/* Preview of the first feature's label, on a halo like the map. */}
        <div className="flex min-h-12 items-center justify-center border border-border bg-[var(--map-ground)] px-3 py-2">
          <span
            className="whitespace-pre-line text-center"
            style={{
              color: label.color,
              fontSize: label.size,
              fontWeight: label.fontStyle === 'Bold' ? 700 : label.fontStyle === 'Medium' || label.fontStyle === 'Semibold' ? 600 : 400,
              fontStyle: label.fontStyle === 'Italic' ? 'italic' : 'normal',
              letterSpacing: `${label.letterSpacing}em`,
              textTransform: label.transform,
              textShadow: label.halo.enabled ? `0 0 ${label.halo.width}px ${label.halo.color}, 0 0 ${label.halo.width}px ${label.halo.color}` : 'none',
              background: label.background.enabled ? label.background.color : 'transparent',
              padding: label.background.enabled ? label.background.padding : 0,
            }}
          >
            {sample || l.noPreview}
          </span>
        </div>
      </Section>

      <Section title={l.fontTitle}>
        <Field label={l.family}>
          <Select value={label.font} onChange={(v) => update(def.id, 'label', { ...label, font: v, fontStyle: FONTS[v].includes(label.fontStyle) ? label.fontStyle : FONTS[v][0] })} options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))} label={l.family} />
        </Field>
        <Field label={l.fontStyle}>
          <Segmented value={label.fontStyle} onChange={(v) => set('fontStyle', v)} label={l.fontStyle} options={FONTS[label.font].map((s) => ({ value: s, label: l.styles[s] }))} />
        </Field>
        <Slider label={l.size} value={label.size} min={8} max={32} step={0.5} onChange={(v) => set('size', v)} format={px} />
        <Field label={l.color}>
          <ColorField value={label.color} onChange={(v) => set('color', v)} label={l.color} />
        </Field>
        <Slider label={l.opacity} value={label.opacity} min={0} max={1} step={0.05} onChange={(v) => set('opacity', v)} format={pct} />
        <Slider label={l.letterSpacing} value={label.letterSpacing} min={-0.1} max={0.5} step={0.01} onChange={(v) => set('letterSpacing', v)} format={em} />
        <Slider label={l.lineHeight} value={label.lineHeight} min={0.8} max={2} step={0.05} onChange={(v) => set('lineHeight', v)} format={em} />
        <Slider label={l.wrap} value={label.maxWidth} min={2} max={30} step={1} onChange={(v) => set('maxWidth', v)} format={em} />
        <Field label={l.case}>
          <Segmented value={label.transform} onChange={(v) => set('transform', v)} label={l.case} options={['none', 'uppercase', 'lowercase'].map((v) => ({ value: v, label: l.cases[v] }))} />
        </Field>
        <Field label={l.align}>
          <Segmented value={label.justify} onChange={(v) => set('justify', v)} label={l.align} options={['auto', 'left', 'center', 'right'].map((v) => ({ value: v, label: l.aligns[v] }))} />
        </Field>
      </Section>

      <Section title={l.haloTitle}>
        <Check checked={label.halo.enabled} onChange={(v) => setIn('halo', 'enabled', v)} label={l.haloOn} />
        {label.halo.enabled && (
          <>
            <Field label={l.haloColor}>
              <ColorField value={label.halo.color} onChange={(v) => setIn('halo', 'color', v)} label={l.haloColor} />
            </Field>
            <Slider label={l.haloWidth} value={label.halo.width} min={0} max={5} step={0.1} onChange={(v) => setIn('halo', 'width', v)} format={px} />
            <Slider label={l.haloBlur} value={label.halo.blur} min={0} max={3} step={0.1} onChange={(v) => setIn('halo', 'blur', v)} format={px} />
            <Slider label={l.haloOpacity} value={label.halo.opacity} min={0} max={1} step={0.05} onChange={(v) => setIn('halo', 'opacity', v)} format={pct} />
          </>
        )}
      </Section>

      <Section title={l.boxTitle} defaultOpen={label.background.enabled}>
        <Check checked={label.background.enabled} onChange={(v) => setIn('background', 'enabled', v)} label={l.boxOn} />
        {label.background.enabled && (
          <>
            <Field label={l.boxColor}>
              <ColorField value={label.background.color} onChange={(v) => setIn('background', 'color', v)} label={l.boxColor} />
            </Field>
            <Slider label={l.boxOpacity} value={label.background.opacity} min={0} max={1} step={0.05} onChange={(v) => setIn('background', 'opacity', v)} format={pct} />
            <Field label={l.boxOutline}>
              <ColorField value={label.background.outline} onChange={(v) => setIn('background', 'outline', v)} label={l.boxOutline} />
            </Field>
            <Slider label={l.boxOutlineOpacity} value={label.background.outlineOpacity} min={0} max={1} step={0.05} onChange={(v) => setIn('background', 'outlineOpacity', v)} format={pct} />
            <Slider label={l.boxPadding} value={label.background.padding} min={0} max={10} step={0.5} onChange={(v) => setIn('background', 'padding', v)} format={px} />
          </>
        )}
      </Section>

      <Section title={l.placementTitle}>
        {def.geometry === 'point' && (
          <>
            <Field label={l.mode}>
              <Segmented value={P.point} onChange={(v) => setIn('placement', 'point', v)} label={l.mode} options={[{ value: 'auto', label: l.auto, title: l.autoHint }, { value: 'fixed', label: l.fixed }]} />
            </Field>
            {P.point === 'fixed' && (
              <Field label={l.position}>
                <PositionPicker value={P.anchor} onChange={(v) => setIn('placement', 'anchor', v)} />
              </Field>
            )}
            <Slider label={l.distance} value={P.distance} min={0} max={3} step={0.1} onChange={(v) => setIn('placement', 'distance', v)} format={em} />
          </>
        )}
        {def.geometry === 'line' && (
          <>
            <Field label={l.mode}>
              <Select value={P.line} onChange={(v) => setIn('placement', 'line', v)} label={l.mode} options={['line', 'line-center', 'horizontal'].map((v) => ({ value: v, label: l.lineModes[v] }))} />
            </Field>
            {P.line !== 'horizontal' && (
              <>
                <Field label={l.side}>
                  <Segmented value={P.linePosition} onChange={(v) => setIn('placement', 'linePosition', v)} label={l.side} options={['above', 'on', 'below'].map((v) => ({ value: v, label: l.sides[v] }))} />
                </Field>
                {P.line === 'line' && <Slider label={l.spacing} value={P.spacing} min={50} max={1000} step={10} onChange={(v) => setIn('placement', 'spacing', v)} format={px} />}
                <Check checked={P.keepUpright} onChange={(v) => setIn('placement', 'keepUpright', v)} label={l.keepUpright} />
                <Slider label={l.maxAngle} value={P.maxAngle} min={10} max={90} onChange={(v) => setIn('placement', 'maxAngle', v)} format={deg} />
              </>
            )}
          </>
        )}
        {def.geometry === 'polygon' && (
          <>
            <Field label={l.mode}>
              <Select value={P.polygon} onChange={(v) => setIn('placement', 'polygon', v)} label={l.mode} options={['inside', 'centroid', 'perimeter'].map((v) => ({ value: v, label: l.polygonModes[v] }))} />
            </Field>
            {P.polygon === 'perimeter' && (
              <>
                <Field label={l.side}>
                  <Segmented value={P.linePosition} onChange={(v) => setIn('placement', 'linePosition', v)} label={l.side} options={['above', 'on', 'below'].map((v) => ({ value: v, label: l.sides[v] }))} />
                </Field>
                <Slider label={l.spacing} value={P.spacing} min={50} max={1000} step={10} onChange={(v) => setIn('placement', 'spacing', v)} format={px} />
              </>
            )}
          </>
        )}
        <Field label={l.rotation}>
          <Segmented value={P.rotation} onChange={(v) => setIn('placement', 'rotation', v)} label={l.rotation} options={['none', 'angle', 'field'].map((v) => ({ value: v, label: l.rotations[v] }))} />
        </Field>
        {P.rotation === 'angle' && <Slider label={l.angle} value={P.angle} min={-180} max={180} onChange={(v) => setIn('placement', 'angle', v)} format={deg} />}
        {P.rotation === 'field' && (
          <Field label={l.rotationField}>
            <Select value={P.rotationField ?? ''} onChange={(v) => setIn('placement', 'rotationField', v || null)} label={l.rotationField} options={[{ value: '', label: t.symbology.none }, ...numeric.map((f) => ({ value: f.key, label: f.label }))]} />
          </Field>
        )}
      </Section>

      <Section title={l.renderingTitle}>
        <Field label={l.zoomRange}>
          <NumberField value={label.minZoom} min={0} max={24} step={0.5} label={l.minZoom} onChange={(v) => set('minZoom', Math.max(0, Math.min(label.maxZoom, v)))} />
          <span className="text-xs text-muted">–</span>
          <NumberField value={label.maxZoom} min={0} max={24} step={0.5} label={l.maxZoom} onChange={(v) => set('maxZoom', Math.min(24, Math.max(label.minZoom, v)))} />
        </Field>
        <Check checked={label.allowOverlap} onChange={(v) => set('allowOverlap', v)} label={l.overlap} hint={l.overlapHint} />
        <Field label={l.priority} hint={l.priorityHint}>
          <Select value={label.priorityField ?? ''} onChange={(v) => set('priorityField', v || null)} label={l.priority} options={[{ value: '', label: t.symbology.none }, ...numeric.map((f) => ({ value: f.key, label: f.label }))]} />
        </Field>
        <Slider label={l.padding} value={label.padding} min={0} max={20} step={1} onChange={(v) => set('padding', v)} format={px} />
      </Section>

      <LabelClasses def={def} label={label} set={set} />
    </>
  );
}
