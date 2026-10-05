import { LuArrowDown, LuArrowUp, LuEye, LuEyeOff, LuPlus, LuTrash2 } from 'react-icons/lu';
import { t } from '../../i18n';
import { layerData } from '../../lib/layers';
import { exprFields, preparedData } from '../../lib/prepared';
import { useSymbology } from '../../state/symbology';
import { ColorField, Section, TextField } from '../controls';
import { SqlField } from './SqlField';

const r = t.symbology.rules;
const iconBtn = 'grid size-7 shrink-0 place-items-center text-muted hover:text-accent disabled:opacity-30 disabled:hover:text-muted';
// New rules take the chart series colours in their fixed order (editable afterwards).
const PALETTE = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `var(--series-${i})`);

/** Rule-based renderer: an ordered list of SQL filters; the first rule a feature matches styles it. */
export function RulesSection({ def, style }) {
  const update = useSymbology((s) => s.update);
  const id = def.id;
  const fields = exprFields(def);
  const rules = style.rules;
  const setRules = (next) => update(id, 'rules', next);
  const setRule = (i, patch) => setRules(rules.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, d) => {
    const next = [...rules];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setRules(next);
  };

  // Features per rule (first match wins), from the prepared data.
  const prepared = preparedData(def, { ...style, query: { ...style.query, applied: '' } }).data;
  const counts = rules.map((_, i) => prepared?.features.filter((f) => f.properties.__rule === i).length ?? 0);
  const elseCount = prepared?.features.filter((f) => f.properties.__rule === -1).length ?? 0;
  const total = layerData(def)?.features.length ?? 0;

  return (
    <Section title={r.title}>
      <p className="text-2xs text-muted">{r.hint}</p>
      {rules.map((rule, i) => (
        <div key={i} className={`flex flex-col gap-1.5 border border-border bg-field p-2 ${rule.visible ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setRule(i, { visible: !rule.visible })} aria-pressed={rule.visible} aria-label={r.show} title={rule.visible ? r.hide : r.show} className="grid size-7 shrink-0 place-items-center border border-border text-text hover:text-accent">
              {rule.visible ? <LuEye size={13} /> : <LuEyeOff size={13} />}
            </button>
            <ColorField value={rule.color} onChange={(v) => setRule(i, { color: v })} label={r.color} compact />
            <TextField value={rule.label} onChange={(v) => setRule(i, { label: v })} label={r.label} placeholder={r.labelPlaceholder} className="min-w-0 flex-1" />
            <span className="w-8 shrink-0 text-right text-2xs tabular-nums text-muted" title={r.countHint}>
              {counts[i]}
            </span>
          </div>
          <SqlField value={rule.filter} onChange={(v) => setRule(i, { filter: v })} fields={fields} rows={1} label={r.filter} placeholder={r.filterPlaceholder} compact />
          <div className="flex items-center justify-end gap-0.5">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={r.up} title={r.up} className={iconBtn}>
              <LuArrowUp size={13} />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rules.length - 1} aria-label={r.down} title={r.down} className={iconBtn}>
              <LuArrowDown size={13} />
            </button>
            <button type="button" onClick={() => setRules(rules.filter((_, j) => j !== i))} aria-label={r.remove} title={r.remove} className={iconBtn}>
              <LuTrash2 size={13} />
            </button>
          </div>
        </div>
      ))}
      <div className={`flex items-center gap-1.5 border border-dashed border-border-strong px-2 py-1.5 ${style.elseRule.visible ? '' : 'opacity-60'}`}>
        <button type="button" onClick={() => update(id, 'elseRule', { ...style.elseRule, visible: !style.elseRule.visible })} aria-pressed={style.elseRule.visible} aria-label={r.show} title={style.elseRule.visible ? r.hide : r.show} className="grid size-7 shrink-0 place-items-center border border-border text-text hover:text-accent">
          {style.elseRule.visible ? <LuEye size={13} /> : <LuEyeOff size={13} />}
        </button>
        <ColorField value={style.elseRule.color} onChange={(v) => update(id, 'elseRule', { ...style.elseRule, color: v })} label={r.color} compact />
        <span className="min-w-0 flex-1 truncate text-xs text-text">{r.else}</span>
        <span className="w-8 shrink-0 text-right text-2xs tabular-nums text-muted">{elseCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRules([...rules, { label: r.newLabel(rules.length + 1), filter: '', color: PALETTE[rules.length % PALETTE.length], visible: true }])}
          className="flex h-7 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:bg-hover"
        >
          <LuPlus size={12} aria-hidden />
          <span>{r.add}</span>
        </button>
        <span className="ml-auto text-2xs tabular-nums text-muted">{r.total(total)}</span>
      </div>
    </Section>
  );
}
