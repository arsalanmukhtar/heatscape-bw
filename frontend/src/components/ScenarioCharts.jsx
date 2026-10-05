import { t } from '../i18n';
import { CRITERIA } from '../lib/scenario';
import { useActiveRanking } from '../state/scenarios';
import { useWorkspace } from '../state/workspace';
import { SearchEmpty } from './SearchBar';

// Criteria take series colours in fixed order (never cycled).
const CRITERION_COLOR = Object.fromEntries(CRITERIA.map((c, i) => [c, `var(--series-${i + 1})`]));
const SHIFT_COLOR = { minus: 'var(--series-1)', plus: 'var(--series-2)' };

export function ScenarioCharts() {
  const ranking = useActiveRanking();
  if (!ranking) return <SearchEmpty>{t.charts.empty}</SearchEmpty>;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-2">
      <Sensitivity data={ranking.sensitivity} />
      <Contributions rows={ranking.rows.slice(0, 10)} />
    </div>
  );
}

function ChartHead({ title, hint, legend }) {
  return (
    <div className="mb-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div>
        <h3 className="text-xs font-semibold text-text">{title}</h3>
        <p className="text-2xs text-muted">{hint}</p>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {legend.map(([label, color]) => (
          <li key={label} className="flex items-center gap-1.5 text-2xs text-muted">
            <span className="size-2" style={{ background: color }} aria-hidden />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Grouped horizontal bars: for each criterion, top-10 members lost at −10 and +10 points. */
function Sensitivity({ data }) {
  return (
    <section className="border-b border-border px-4 py-3 lg:border-b-0 lg:border-r">
      <ChartHead
        title={t.charts.sensitivity}
        hint={t.charts.sensitivityHint}
        legend={[
          [t.charts.minus, SHIFT_COLOR.minus],
          [t.charts.plus, SHIFT_COLOR.plus],
        ]}
      />
      <ul className="flex flex-col gap-1.5">
        {data.map((d) => (
          <li key={d.criterion} className="grid grid-cols-[132px_1fr] items-center gap-2">
            <span className="truncate text-2xs text-muted">{t.scenarios.criteria[d.criterion]}</span>
            <span className="flex flex-col gap-0.5">
              {['minus', 'plus'].map((k) => (
                <span key={k} className="flex items-center gap-1.5" title={`${t.scenarios.criteria[d.criterion]}, ${t.charts[k]}: ${t.charts.blocks(d[k])}`}>
                  <span className="relative h-2 flex-1 bg-[var(--chart-grid)]">
                    <span className="absolute inset-y-0 left-0" style={{ width: `${d[k] * 10}%`, background: SHIFT_COLOR[k] }} />
                  </span>
                  <span className="w-5 text-right text-2xs tabular-nums text-text">{d[k]}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Stacked horizontal bars: score points per criterion for the top 10 blocks. */
function Contributions({ rows }) {
  const { selectedId, select } = useWorkspace();
  const max = Math.max(...rows.map((r) => r.score), 1);

  return (
    <section className="px-4 py-3">
      <ChartHead title={t.charts.contributions} hint={t.charts.contributionsHint} legend={CRITERIA.map((c) => [t.scenarios.criteria[c], CRITERION_COLOR[c]])} />
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => select(r.id)}
              className={`grid w-full grid-cols-[72px_1fr_36px] items-center gap-2 px-1 py-0.5 text-left ${r.id === selectedId ? 'bg-accent-soft' : 'hover:bg-hover'}`}
            >
              <span className="truncate text-2xs tabular-nums text-text">
                {r.rank}. {r.id}
              </span>
              {/* 2px surface gaps between segments keep adjacent colours apart. */}
              <span className="flex h-2.5 gap-0.5" style={{ width: `${(r.score / max) * 100}%` }}>
                {CRITERIA.map((c) =>
                  r.contributions[c] > 0 ? (
                    <span
                      key={c}
                      title={`${r.id} · ${t.scenarios.criteria[c]}: ${r.contributions[c].toFixed(1)}`}
                      style={{ flexGrow: r.contributions[c], background: CRITERION_COLOR[c] }}
                    />
                  ) : null,
                )}
              </span>
              <span className="text-right text-2xs tabular-nums text-muted">{r.score.toFixed(1)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
