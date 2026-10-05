import { LuCircle, LuCircleCheck } from 'react-icons/lu';
import { ADMIN_REGIONS } from '../../data/mock';
import { t } from '../../i18n';
import { Chip, PageHead } from './AdminParts';

const a = t.admin;
const r = a.regions;
const STATE_COLOR = { active: 'var(--success)', transfer: 'var(--info)', planned: 'var(--text-muted)' };

/** Regions: one card per region with onboarding progress and checklist. */
export function AdminRegions() {
  return (
    <>
      <PageHead title={a.sections.regions} hint={a.hints.regions} />
      <div className="grid gap-4 px-6 pb-6 md:grid-cols-2 xl:grid-cols-3">
        {ADMIN_REGIONS.map((x) => (
          <section key={x.id} className="flex flex-col border border-border bg-surface" aria-labelledby={`region-${x.id}`}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <h2 id={`region-${x.id}`} className="min-w-0 flex-1 truncate text-md font-semibold text-text">
                {x.name}
              </h2>
              <Chip color={STATE_COLOR[x.state]}>{r.states[x.state]}</Chip>
            </div>
            <div className="flex flex-col gap-3 px-4 py-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-text">{r.onboarding(x.progress)}</span>
                  <span className="tabular-nums text-muted">
                    {r.blocks(x.blocks)} · {r.users(x.users)}
                  </span>
                </div>
                <div className="h-2 border border-border-strong" role="progressbar" aria-valuenow={x.progress} aria-valuemin={0} aria-valuemax={100} aria-label={r.onboarding(x.progress)}>
                  <div className="h-full" style={{ width: `${x.progress}%`, background: STATE_COLOR[x.state] }} />
                </div>
              </div>
              <div>
                <p className="label-caps mb-1.5">{r.checklist}</p>
                <ol className="flex flex-col gap-1">
                  {Object.keys(r.steps).map((k) => {
                    const done = x.steps[k];
                    return (
                      <li key={k} className="flex items-center gap-2 text-sm">
                        {done ? <LuCircleCheck size={15} className="shrink-0 text-success" aria-hidden /> : <LuCircle size={15} className="shrink-0 text-faint" aria-hidden />}
                        <span className={done ? 'text-text' : 'text-muted'}>{r.steps[k]}</span>
                        <span className="sr-only">{done ? a.users.yes : a.users.no}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
