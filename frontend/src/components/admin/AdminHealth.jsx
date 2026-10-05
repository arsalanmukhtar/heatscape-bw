import { useCallback, useEffect, useState } from 'react';
import { LuRefreshCw } from 'react-icons/lu';
import { ADMIN_SERVICES } from '../../data/mock';
import { t } from '../../i18n';
import { Chip, PageHead } from './AdminParts';

const a = t.admin;
const h = a.health;
const STATE_COLOR = { up: 'var(--success)', down: 'var(--danger)', checking: 'var(--info)', planned: 'var(--text-muted)', unchecked: 'var(--text-muted)' };

/** One live check through the gateway: state and round-trip latency (ms). */
async function check(s) {
  if (!s.check) return { state: 'unchecked' };
  const t0 = performance.now();
  try {
    const res = await fetch(s.check, s.post ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s.post), cache: 'no-store' } : { cache: 'no-store' });
    const ms = Math.round(performance.now() - t0);
    let detail = null;
    if (res.ok && s.id === 'db') {
      const json = await res.json().catch(() => null);
      detail = json?.extensions ? Object.entries(json.extensions).map(([k, v]) => `${k} ${v}`).join(' · ') : null;
    }
    return { state: res.ok ? 'up' : 'down', ms, detail, code: res.status };
  } catch {
    return { state: 'down', ms: null };
  }
}

/*
  System health: built services are checked live (GET or a tiny POST through the gateway,
  the same path the browser uses); planned services are listed as planned, never faked.
*/
export function AdminHealth() {
  const [results, setResults] = useState({});
  const [checkedAt, setCheckedAt] = useState(null);

  const run = useCallback(async () => {
    const built = ADMIN_SERVICES.filter((s) => s.built);
    setResults(Object.fromEntries(built.map((s) => [s.id, { state: 'checking' }])));
    const out = await Promise.all(built.map(async (s) => [s.id, await check(s)]));
    setResults(Object.fromEntries(out));
    setCheckedAt(new Date());
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <>
      <PageHead
        title={a.sections.health}
        hint={checkedAt ? h.checked(checkedAt.toLocaleTimeString('en-GB')) : a.hints.health}
        actions={
          <button type="button" onClick={run} className="flex h-7 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:bg-hover">
            <LuRefreshCw size={12} aria-hidden />
            <span>{h.recheck}</span>
          </button>
        }
      />
      <div className="px-6 pb-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {ADMIN_SERVICES.map((s) => {
            const r = s.built ? (results[s.id] ?? { state: 'checking' }) : { state: 'planned' };
            return (
              <section key={s.id} className={`flex flex-col gap-2 border bg-surface px-4 py-3 ${r.state === 'down' ? 'border-[var(--danger)]' : 'border-border'} ${s.built ? '' : 'opacity-70'}`}>
                <div className="flex items-center gap-2">
                  <h2 className="min-w-0 flex-1 truncate font-mono text-xs text-text">{s.name}</h2>
                  <Chip color={STATE_COLOR[r.state]}>{h.states[r.state]}</Chip>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-2xs">
                  <div>
                    <dt className="uppercase tracking-[var(--tracking-caps)] text-muted">{h.columns.latency}</dt>
                    <dd className="mt-0.5 text-sm tabular-nums text-text">{r.ms != null ? `${r.ms} ms` : '–'}</dd>
                  </div>
                  <div title={h.uptimeNote}>
                    <dt className="uppercase tracking-[var(--tracking-caps)] text-muted">{h.columns.uptime}</dt>
                    <dd className="mt-0.5 text-sm text-muted">–</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[var(--tracking-caps)] text-muted">{h.columns.version}</dt>
                    <dd className="mt-0.5 truncate text-sm text-text">{s.version ?? '–'}</dd>
                  </div>
                </dl>
                {(r.detail || r.code) && <p className="truncate font-mono text-2xs text-muted">{r.detail ?? `HTTP ${r.code} ${s.check}`}</p>}
              </section>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">{h.note}</p>
      </div>
    </>
  );
}
