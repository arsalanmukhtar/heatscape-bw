import { LuCalculator, LuChevronDown, LuPlus } from 'react-icons/lu';
import { REGION, USER } from '../data/mock';
import { t } from '../i18n';
import { AREAS, CRITERIA, candidateCount, normaliseWeights } from '../lib/scenario';
import { useLayout } from '../state/layout';
import { useScenarios } from '../state/scenarios';
import { useWorkspace } from '../state/workspace';
import { Checkbox } from './Checkbox';
import { PanelHeader } from './SidePanel';

const STATUS_CHIP = { Draft: 'var(--text-muted)', Shared: 'var(--info)' };
const field = 'h-8 w-full border border-border bg-field px-2 text-xs text-text outline-none focus:border-accent-line';

export function ScenariosPanel() {
  const { scenarios, activeId, select, create } = useScenarios();
  const active = scenarios.find((s) => s.id === activeId);

  return (
    <>
      <PanelHeader
        title={t.scenarios.title}
        actions={
          <button
            type="button"
            onClick={() => create(t.scenarios.newName(scenarios.length + 1), USER.name)}
            aria-label={t.scenarios.newScenario}
            title={t.scenarios.newScenario}
            className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text"
          >
            <LuPlus size={15} />
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <Section title={t.scenarios.list}>
          <ul className="flex flex-col gap-1">
            {scenarios.map((s) => {
              const on = s.id === activeId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => select(s.id)}
                    aria-current={on ? 'true' : undefined}
                    className={`flex w-full items-center gap-2 border px-2.5 py-2 text-left ${on ? 'border-accent-line bg-accent-soft' : 'border-border bg-field hover:bg-hover'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text">{s.name}</span>
                      <span className="block truncate text-2xs text-muted">
                        {s.region} · {t.scenarios.by(s.createdBy)}
                      </span>
                    </span>
                    <span className="level-chip shrink-0" style={{ '--chip': STATUS_CHIP[s.status] }}>
                      {t.scenarios.status[s.status]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
        {active && <Editor scenario={active} />}
      </div>
      {active && <ComputeBar params={active.params} />}
    </>
  );
}

function Section({ title, children }) {
  return (
    <section className="px-3 pt-4">
      <h3 className="label-caps mb-2 px-1">{title}</h3>
      {children}
    </section>
  );
}

function Editor({ scenario }) {
  const { update, setWeight } = useScenarios();
  const p = scenario.params;
  const shares = normaliseWeights(p.weights);
  const setParams = (params) => update({ params });

  return (
    <>
      <Section title={t.scenarios.editor}>
        <label className="block">
          <span className="mb-1 block text-2xs text-muted">{t.scenarios.name}</span>
          <input type="text" value={scenario.name} onChange={(e) => update({ name: e.target.value })} className={field} />
        </label>

        <div className="mt-3">
          <span className="mb-1 block text-2xs text-muted">{t.scenarios.goal}</span>
          <div role="radiogroup" aria-label={t.scenarios.goal} className="grid grid-cols-3 border border-border">
            {Object.entries(t.scenarios.goals).map(([id, label]) => {
              const on = p.goal === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setParams({ goal: id })}
                  className={`h-8 border-r border-border text-xs last:border-r-0 ${on ? 'bg-accent-soft font-semibold text-text' : 'text-muted hover:bg-hover hover:text-text'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-2xs text-muted">{t.scenarios.area}</span>
          <span className="relative block">
            <select value={p.area} onChange={(e) => setParams({ area: e.target.value })} className={`${field} appearance-none pr-7`}>
              <option value="all">{t.scenarios.wholeCity(REGION.name)}</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <LuChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          </span>
        </label>
      </Section>

      <Section title={t.scenarios.weights}>
        <div className="flex flex-col gap-3 border border-border bg-field px-2.5 py-3">
          {CRITERIA.map((c) => (
            <Slider
              key={c}
              id={`w-${c}`}
              label={t.scenarios.criteria[c]}
              value={p.weights[c]}
              display={`${Math.round(shares[c] * 100)}%`}
              onChange={(v) => setWeight(c, v)}
            />
          ))}
        </div>
      </Section>

      <Section title={t.scenarios.constraints}>
        <div className="flex flex-col gap-3 border border-border bg-field px-2.5 py-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <Checkbox checked={p.excludeProtected} onChange={() => setParams({ excludeProtected: !p.excludeProtected })} label={t.scenarios.excludeProtected} />
            <span>{t.scenarios.excludeProtected}</span>
          </label>
          <label className="flex items-center gap-2.5">
            <span className="flex-1 text-sm text-text">{t.scenarios.minParcel}</span>
            <span className="flex h-8 w-28 items-center border border-border bg-surface-strong focus-within:border-accent-line">
              <input
                type="number"
                min={0}
                step={100}
                value={p.minParcel}
                onChange={(e) => setParams({ minParcel: Math.max(0, Number(e.target.value) || 0) })}
                className="min-w-0 flex-1 bg-transparent px-2 text-right text-xs tabular-nums text-text outline-none"
              />
              <span className="pr-2 text-2xs text-muted">m²</span>
            </span>
          </label>
        </div>
      </Section>

      <Section title={t.scenarios.interventions}>
        <div className="flex flex-col gap-3 border border-border bg-field px-2.5 py-3">
          <Slider id="deseal" label={t.scenarios.deseal} value={p.deseal} display={`${p.deseal}%`} disabled={p.goal === 'greening'} onChange={(v) => setParams({ deseal: v })} />
          <Slider id="canopy" label={t.scenarios.canopy} value={p.canopy} display={`${p.canopy}%`} disabled={p.goal === 'desealing'} onChange={(v) => setParams({ canopy: v })} />
        </div>
      </Section>
    </>
  );
}

function Slider({ id, label, value, display, disabled, onChange }) {
  return (
    <div className={disabled ? 'opacity-40' : undefined}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="truncate text-sm text-text">
          {label}
        </label>
        <span className="text-xs tabular-nums text-muted">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="hs-range disabled:cursor-default"
        style={{ '--val': `${value}%` }}
      />
    </div>
  );
}

function ComputeBar({ params }) {
  const { compute, activeId, results, stale } = useScenarios();
  const select = useWorkspace((s) => s.select);
  const count = candidateCount(params);
  const hasResult = results[activeId] != null;

  const run = () => {
    const result = compute();
    if (result.rows.length) select(result.rows[0].id);
    useLayout.setState({ rightOpen: true, rightView: 'ranking' });
  };

  return (
    <div className="shrink-0 border-t border-border px-3 py-3">
      <p className={`mb-2 text-2xs ${count ? 'text-muted' : 'text-warning'}`}>{count ? t.scenarios.candidates(count) : t.scenarios.noCandidates}</p>
      <button
        type="button"
        onClick={run}
        disabled={!count}
        className="flex h-8 w-full items-center justify-center gap-2 bg-accent text-xs font-medium text-on-accent hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
      >
        <LuCalculator size={13} aria-hidden />
        <span>{hasResult && stale[activeId] ? t.scenarios.recompute : t.scenarios.compute}</span>
      </button>
    </div>
  );
}
