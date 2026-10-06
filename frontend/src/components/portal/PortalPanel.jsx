import { useMemo, useState } from 'react';
import { LuBuilding2, LuChevronDown, LuCircleCheck, LuDroplets, LuPhone, LuThermometerSun, LuTrees, LuTriangleAlert, LuUmbrella } from 'react-icons/lu';
import { HEAT_WARNING } from '../../data/mock';
import { portalText } from '../../i18n';
import { ATTRIBUTIONS, credit, DATA_ATTRIBUTIONS } from '../../lib/attribution';
import { areaResult, coolPlacesNear, rankPhrase, RADIUS_M } from '../../lib/portal';
import { usePortal } from '../../state/portal';
import { ConfidencePips } from '../ConfidencePips';
import { AddressSearch } from './AddressSearch';
import { QuantileDots } from './QuantileDots';

export const KIND_ICON = { park: LuTrees, shade: LuUmbrella, water: LuDroplets, coolroom: LuBuilding2 };
// Warning level → status token and icon (never colour alone: the level is written out).
const LEVEL = { none: { color: 'var(--success)', Icon: LuCircleCheck }, strong: { color: 'var(--warning)', Icon: LuTriangleAlert }, extreme: { color: 'var(--danger)', Icon: LuTriangleAlert } };
const SHOWN = 5;

const fmt = (v, lang) => v.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 0 });

function Card({ id, title, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 border-b border-border px-5 py-5">
      <h2 id={`${id}-title`} className="mb-3 text-lg font-semibold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Today: DWD heat warning for the city, forecast temperatures and what to do. */
function TodayCard({ p, lang }) {
  const w = HEAT_WARNING;
  const lv = LEVEL[w.level];
  const stamp = new Date(w.updated).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <Card id="portal-today" title={p.today.title}>
      <div className="flex items-start gap-3 border-l-4 px-3 py-3" style={{ borderColor: lv.color, background: `color-mix(in srgb, ${lv.color} 12%, transparent)` }} role="status">
        <span className="icon-cap text-base" style={{ color: lv.color }}>
          <lv.Icon size={22} aria-hidden />
        </span>
        <div className="text-cap-start min-w-0">
          <p className="text-base font-semibold text-text">{p.today.levels[w.level]}</p>
          {w.level !== 'none' && <p className="mt-0.5 text-sm text-text">{p.today.validity(w.area, w.from, w.to)}</p>}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {[
          [p.today.forecast, w.forecastMax, true],
          [p.today.tomorrow, w.tomorrowMax],
          [p.today.night, w.nightMin],
        ].map(([label, v, main]) => (
          <div key={label} className="flex flex-col justify-between border border-border bg-surface-raised px-3 py-2.5">
            <dt className="text-xs leading-snug text-muted">{label}</dt>
            <dd className={`mt-1 font-semibold tabular-nums text-text ${main ? 'text-2xl' : 'text-xl'}`}>{v} °C</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-4 text-sm font-semibold text-text">{p.today.tipsTitle}</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {p.today.tips.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-sm leading-relaxed text-text">
            <span className="icon-cap text-muted">
              <LuThermometerSun size={16} aria-hidden />
            </span>
            <span className="text-cap-start">{tip}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-text">
        <LuPhone size={15} className="shrink-0" aria-hidden />
        <span>{p.today.emergency}</span>
      </p>
      <p className="mt-2 text-xs text-muted">{p.today.source(stamp)}</p>
    </Card>
  );
}

/** Your area on hot days: rank in the city, typical value, quantile dots, confidence. */
function AreaCard({ p, lang, location }) {
  const res = useMemo(() => (location ? areaResult(location.center) : null), [location]);
  if (!location) {
    return (
      <Card id="portal-area" title={p.area.title}>
        <p className="text-sm leading-relaxed text-muted">{p.area.empty}</p>
      </Card>
    );
  }
  if (!res) {
    return (
      <Card id="portal-area" title={p.area.title}>
        <p className="text-sm leading-relaxed text-text">{p.search.outside}</p>
      </Card>
    );
  }
  const rank = rankPhrase(res.cooler);
  const sentence = rank.kind === 'warm' ? p.area.warm(rank.pct) : p.area.cool(rank.pct);
  const t = fmt(res.t, lang);
  const q = res.quantiles;
  return (
    <Card id="portal-area" title={p.area.title}>
      <p className="text-base font-semibold leading-snug text-text">{sentence}</p>
      <p className="mt-2 text-sm text-text">{p.area.typical(t)}</p>
      <h3 className="mt-4 text-sm font-semibold text-text">{p.area.dotsTitle}</h3>
      <div className="mt-2 border border-border bg-surface-raised px-2 py-2">
        <QuantileDots values={q} label={p.area.plotLabel(fmt(q[1], lang), fmt(q[18], lang))} medianLabel={p.area.cityMedian} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{p.area.dotsHint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ConfidencePips level={res.level} label={p.area.level[res.level]} />
        <span className="text-sm text-text">
          {p.area.confidence[res.level]}: {p.area.confidenceWhy[res.level]}
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {p.area.surfaceNote} ({RADIUS_M} m)
      </p>
      {/* One sentence for screen readers whenever the place changes. */}
      <p className="sr-only" aria-live="polite">{`${sentence} ${p.area.typical(t)} ${p.area.confidence[res.level]}.`}</p>
    </Card>
  );
}

/** Cool places by walking time; a row flies the map there. */
function CoolCard({ p, location, placeId, pickPlace }) {
  const [all, setAll] = useState(false);
  const places = useMemo(() => (location ? coolPlacesNear(location.center) : []), [location]);
  const near = places.filter((x) => x.minutes <= 10).length;
  return (
    <Card id="portal-cool" title={p.cool.title}>
      {!location ? (
        <p className="text-sm leading-relaxed text-muted">{p.cool.empty}</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-text">{p.cool.inWalk(near)}</p>
          <ul className="flex flex-col border border-border">
            {(all ? places : places.slice(0, SHOWN)).map((x) => {
              const Icon = KIND_ICON[x.kind];
              const on = x.id === placeId;
              const feats = ['shade', 'water', 'seats'].filter((k) => x[k]).map((k) => p.cool.features[k]);
              return (
                <li key={x.id} className="border-b border-border-soft last:border-b-0">
                  <button
                    type="button"
                    onClick={() => pickPlace(x.id)}
                    aria-label={p.cool.showOnMap(x.name)}
                    aria-pressed={on}
                    className={`grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 text-left ${on ? 'bg-accent-soft' : 'hover:bg-hover'}`}
                  >
                    {/* Aligned lines (alignment rule): name ↔ walking time, kind/hours ↔ distance,
                        each centred on its own grid row; the icon tile spans the first two. */}
                    <span className="row-span-2 grid size-9 place-items-center border border-border-strong text-[var(--series-1)]" aria-hidden>
                      <Icon size={18} />
                    </span>
                    <span className="text-sm font-semibold text-text">{x.name}</span>
                    <span className="justify-self-end whitespace-nowrap text-sm font-semibold tabular-nums text-text">{p.cool.walk(x.minutes)}</span>
                    <span className="text-xs text-muted">{`${p.cool.kinds[x.kind]} · ${x.hours ? p.cool.hours(x.hours) : p.cool.always}${x.note ? ` · ${p.cool.notes[x.note]}` : ''}`}</span>
                    <span className="justify-self-end whitespace-nowrap text-xs tabular-nums text-muted">{p.cool.distance(x.meters)}</span>
                    {feats.length > 0 && <span className="col-start-2 col-end-4 text-xs text-muted">{feats.join(' · ')}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {places.length > SHOWN && (
            <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="mt-2 flex h-11 items-center gap-1.5 px-1 text-sm font-semibold text-accent hover:underline">
              <LuChevronDown size={15} className={`transition-transform ${all ? 'rotate-180' : ''}`} aria-hidden />
              <span>{all ? p.cool.less : p.cool.more}</span>
            </button>
          )}
          <p className="mt-2 text-xs text-muted">{p.cool.mock}</p>
        </>
      )}
    </Card>
  );
}

/** About the data: square accordion, first item open; then every data source with its credit and licence. */
function AboutCard({ p, lang }) {
  const [open, setOpen] = useState(0);
  return (
    <Card id="portal-about" title={p.about.title}>
      <div className="flex flex-col border border-border">
        {p.about.items.map((it, i) => (
          <div key={it.q} className="border-b border-border-soft last:border-b-0">
            <h3>
              <button
                type="button"
                aria-expanded={open === i}
                aria-controls={`portal-about-${i}`}
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-text hover:bg-hover"
              >
                <span className="min-w-0 flex-1">{it.q}</span>
                <LuChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open === i ? 'rotate-180' : ''}`} aria-hidden />
              </button>
            </h3>
            {open === i && (
              <p id={`portal-about-${i}`} className="px-3 pb-3 text-sm leading-relaxed text-text">
                {it.a}
              </p>
            )}
          </div>
        ))}
      </div>
      <h3 className="mt-5 text-sm font-semibold text-text">{p.about.sourcesTitle}</h3>
      <ul className="mt-2 flex flex-col border border-border">
        {DATA_ATTRIBUTIONS.map((k) => {
          const x = ATTRIBUTIONS[k];
          return (
            <li key={k} className="border-b border-border-soft px-3 py-2.5 last:border-b-0">
              <a href={x.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-text underline-offset-2 hover:underline">
                {x.name}
              </a>
              <p className="mt-0.5 text-xs text-muted">{credit(k, lang)}</p>
              <p className="mt-0.5 text-xs text-muted">
                {p.about.licence}:{' '}
                <a href={x.licenceUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                  {x.licence}
                </a>
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** The information panel (desktop side panel, mobile bottom sheet). */
export function PortalPanel() {
  const { lang, location, placeId, pickPlace } = usePortal();
  const p = portalText[lang];
  return (
    <div>
      <section id="portal-neighbourhood" aria-label={p.nav.neighbourhood} className="scroll-mt-4 border-b border-border px-5 py-5">
        <AddressSearch />
      </section>
      <TodayCard p={p} lang={lang} />
      <AreaCard p={p} lang={lang} location={location} />
      <CoolCard p={p} location={location} placeId={placeId} pickPlace={pickPlace} />
      <AboutCard p={p} lang={lang} />
    </div>
  );
}
