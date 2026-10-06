import { useMemo, useState } from 'react';
import { LuFilter, LuPlay, LuPlus, LuSave, LuScanSearch, LuTable2, LuTrash2, LuX } from 'react-icons/lu';
import { useMap } from 'react-map-gl/mapbox';
import { uniqueValues } from '../../lib/classify';
import { fieldText, layerData } from '../../lib/layers';
import { exprFields } from '../../lib/prepared';
import { builderToSql, BUILDER_OPS, compiled, evaluate, sqlToBuilder } from '../../lib/sqlExpr';
import { t } from '../../i18n';
import { useLayout } from '../../state/layout';
import { useSymbology } from '../../state/symbology';
import { useWorkspace } from '../../state/workspace';
import { Field, Section, Segmented, Select, TextField } from '../controls';
import { SearchEmpty } from '../SearchBar';
import { SqlField } from './SqlField';

const q = t.symbology.query;
const btn = 'flex h-7 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent';
const primary = 'flex h-7 items-center gap-1.5 bg-accent px-3 text-xs font-semibold text-on-accent hover:brightness-110 disabled:opacity-40';
const iconBtn = 'grid size-7 shrink-0 place-items-center text-muted hover:text-accent';
const MAX_PICK = 30; // fields with up to this many distinct values get a value list

function featuresMatching(def, sql) {
  const data = layerData(def);
  const ast = sql ? compiled(sql, exprFields(def).map((f) => f.key)) : null;
  if (!data || !ast) return null;
  return data.features.filter((f) => evaluate(ast, f.properties));
}

function boundsOf(features) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (c) => (typeof c[0] === 'number' ? ((w = Math.min(w, c[0])), (e = Math.max(e, c[0])), (s = Math.min(s, c[1])), (n = Math.max(n, c[1]))) : c.forEach(visit));
  features.forEach((f) => visit(f.geometry.coordinates));
  return [[w, s], [e, n]];
}

/** One builder condition: field, operator, value(s). */
function Condition({ def, fields, cond, onChange, onRemove }) {
  const field = fields.find((f) => f.key === cond.field) ?? fields[0];
  const values = useMemo(() => {
    const raw = (layerData(def)?.features ?? []).map((f) => f.properties[field.key]);
    const u = uniqueValues(raw, MAX_PICK + 1);
    return u.length <= MAX_PICK ? u.map((x) => x.value).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })) : null;
  }, [def, field.key]);
  const set = (patch) => onChange({ ...cond, ...patch });
  const pick = (value, key = 'value') =>
    values && ['eq', 'ne'].includes(cond.op) ? (
      <Select value={String(cond[key] ?? '')} onChange={(v) => set({ [key]: v })} label={q.value} options={[{ value: '', label: q.chooseValue }, ...values.map((v) => ({ value: String(v), label: String(fieldText(field, v)) }))]} className="min-w-0 flex-1" />
    ) : (
      <TextField value={value} onChange={(v) => set({ [key]: v })} label={q.value} placeholder={cond.op === 'in' ? q.listPlaceholder : q.valuePlaceholder} className="min-w-0 flex-1" />
    );

  return (
    <li className="flex flex-col gap-1.5 border border-border bg-field p-2">
      <div className="flex items-center gap-1.5">
        <Select value={field.key} onChange={(v) => set({ field: v, value: '', value2: '' })} label={q.field} options={fields.map((f) => ({ value: f.key, label: f.label }))} className="min-w-0 flex-1" />
        <Select value={cond.op} onChange={(v) => set({ op: v })} label={q.operator} options={BUILDER_OPS.map((o) => ({ value: o, label: q.ops[o] }))} className="w-44" menuWidth={208} />
        <button type="button" onClick={onRemove} aria-label={q.removeCondition} title={q.removeCondition} className={iconBtn}>
          <LuX size={13} />
        </button>
      </div>
      {cond.op === 'between' ? (
        <div className="flex items-center gap-1.5">
          {pick(cond.value)}
          <span className="text-xs text-muted">{q.and}</span>
          {pick(cond.value2 ?? '', 'value2')}
        </div>
      ) : (
        cond.op !== 'null' && cond.op !== 'notnull' && <div className="flex">{pick(cond.value ?? '')}</div>
      )}
    </li>
  );
}

export function QueryTab({ def }) {
  const { main } = useMap();
  const style = useSymbology((s) => s.styles[def.id]);
  const update = useSymbology((s) => s.update);
  const showQueryInTable = useWorkspace((s) => s.showQueryInTable);
  const setDockTab = useLayout((s) => s.setDockTab);
  const [saveName, setSaveName] = useState('');

  if (!layerData(def)) return <SearchEmpty>{q.noRaster}</SearchEmpty>;

  const query = style.query;
  const fields = exprFields(def);
  const keys = fields.map((f) => f.key);
  const numeric = fields.filter((f) => f.type === 'number').map((f) => f.key);
  const set = (patch) => update(def.id, 'query', { ...query, ...patch });
  const total = layerData(def).features.length;
  const draftOk = !query.sql.trim() || !!compiled(query.sql, keys);
  const draftHits = featuresMatching(def, query.sql);
  const appliedHits = featuresMatching(def, query.applied);
  const builder = query.builder;

  const setBuilder = (b) => set({ builder: b, sql: builderToSql(b, numeric) });
  const setSql = (sql) => set({ sql, builder: sqlToBuilder(sql, keys) });

  return (
    <>
      <Section title={q.modeTitle}>
        <Segmented
          value={query.mode}
          onChange={(v) => set({ mode: v })}
          label={q.modeTitle}
          options={[
            { value: 'definition', label: q.modes.definition },
            { value: 'selection', label: q.modes.selection },
          ]}
        />
        <p className="text-2xs text-muted">{q.modeHint[query.mode]}</p>
      </Section>

      <Section title={q.builderTitle}>
        {builder ? (
          <>
            {builder.conditions.length > 1 && (
              <Field label={q.match}>
                <Segmented value={builder.combinator} onChange={(v) => setBuilder({ ...builder, combinator: v })} label={q.match} options={[{ value: 'AND', label: q.all }, { value: 'OR', label: q.any }]} />
              </Field>
            )}
            {builder.conditions.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {builder.conditions.map((c, i) => (
                  <Condition
                    key={i}
                    def={def}
                    fields={fields}
                    cond={c}
                    onChange={(next) => setBuilder({ ...builder, conditions: builder.conditions.map((x, j) => (j === i ? next : x)) })}
                    onRemove={() => setBuilder({ ...builder, conditions: builder.conditions.filter((_, j) => j !== i) })}
                  />
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setBuilder({ ...builder, conditions: [...builder.conditions, { field: fields[0].key, op: 'eq', value: '' }] })} className={`${btn} self-start`}>
              <LuPlus size={12} aria-hidden />
              <span>{q.addCondition}</span>
            </button>
          </>
        ) : (
          <div className="flex items-start gap-2 border border-border bg-field px-2.5 py-2">
            <p className="min-w-0 flex-1 text-2xs text-muted">{q.sqlOnly}</p>
            <button type="button" onClick={() => setBuilder({ combinator: 'AND', conditions: [] })} className={btn}>
              <span>{q.resetBuilder}</span>
            </button>
          </div>
        )}
      </Section>

      <Section title={q.sqlTitle}>
        <SqlField value={query.sql} onChange={setSql} fields={fields} label={q.sqlTitle} placeholder={q.sqlPlaceholder} />
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-2xs tabular-nums text-muted">{draftHits ? q.draftMatches(draftHits.length, total) : q.noDraft}</span>
          <button type="button" onClick={() => set({ applied: '' })} disabled={!query.applied} className={btn}>
            <span>{q.clear}</span>
          </button>
          <button type="button" onClick={() => set({ applied: query.sql.trim() })} disabled={!draftOk || !query.sql.trim() || query.applied === query.sql.trim()} className={primary}>
            <LuPlay size={12} aria-hidden />
            <span>{q.apply}</span>
          </button>
        </div>
      </Section>

      <Section title={q.resultTitle}>
        {query.applied ? (
          <>
            <div className="flex items-start gap-2 border border-accent-line bg-accent-soft px-2.5 py-2">
              <span className="icon-cap text-xs text-accent">
                <LuFilter size={13} aria-hidden />
              </span>
              <div className="text-cap-start min-w-0 flex-1">
                <p className="text-xs font-semibold text-text">{q.active[query.mode](appliedHits?.length ?? 0, total)}</p>
                <p className="mt-0.5 break-words font-mono text-2xs text-muted">{query.applied}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" disabled={!appliedHits?.length} onClick={() => main?.fitBounds(boundsOf(appliedHits), { padding: 80, maxZoom: 16, duration: 800 })} className={btn}>
                <LuScanSearch size={12} aria-hidden />
                <span>{q.zoom}</span>
              </button>
              <button
                type="button"
                disabled={!appliedHits?.length}
                onClick={() => {
                  showQueryInTable(def.id, appliedHits.map((f) => f.properties.id), query.applied);
                  setDockTab('table');
                }}
                className={btn}
              >
                <LuTable2 size={12} aria-hidden />
                <span>{q.showInTable}</span>
              </button>
            </div>
          </>
        ) : (
          <p className="text-2xs text-muted">{q.noneApplied}</p>
        )}
      </Section>

      <Section title={q.savedTitle} defaultOpen={query.saved.length > 0}>
        <div className="flex items-center gap-1.5">
          <TextField value={saveName} onChange={setSaveName} label={q.saveName} placeholder={q.saveName} className="min-w-0 flex-1" />
          <button
            type="button"
            disabled={!saveName.trim() || !query.sql.trim() || !draftOk}
            onClick={() => {
              set({ saved: [...query.saved.filter((x) => x.name !== saveName.trim()), { name: saveName.trim(), sql: query.sql.trim() }] });
              setSaveName('');
            }}
            className={btn}
          >
            <LuSave size={12} aria-hidden />
            <span>{q.save}</span>
          </button>
        </div>
        {query.saved.length > 0 ? (
          <ul className="flex flex-col border border-border">
            {query.saved.map((x) => (
              <li key={x.name} className="flex items-center gap-2 border-b border-border-soft px-2 py-1.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-text">{x.name}</p>
                  <p className="truncate font-mono text-2xs text-muted" title={x.sql}>
                    {x.sql}
                  </p>
                </div>
                <button type="button" onClick={() => set({ sql: x.sql, builder: sqlToBuilder(x.sql, keys), applied: x.sql })} aria-label={q.applySaved} title={q.applySaved} className={iconBtn}>
                  <LuPlay size={13} />
                </button>
                <button type="button" onClick={() => set({ saved: query.saved.filter((y) => y.name !== x.name) })} aria-label={q.deleteSaved} title={q.deleteSaved} className={iconBtn}>
                  <LuTrash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-2xs text-muted">{q.noSaved}</p>
        )}
      </Section>
    </>
  );
}
