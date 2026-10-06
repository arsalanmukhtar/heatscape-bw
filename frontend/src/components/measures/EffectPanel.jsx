import { useState } from 'react';
import { LuCheck, LuDownload, LuHourglass, LuScanSearch, LuTrash2 } from 'react-icons/lu';
import { useMap } from 'react-map-gl/mapbox';
import { VscCollapseAll } from 'react-icons/vsc';
import { t } from '../../i18n';
import { downloadCsv } from '../../lib/csv';
import { MEASURE_STATUSES, measureStatus, measureType, MIN_SUMMERS } from '../../lib/measures';
import { useLayout } from '../../state/layout';
import { useAllMeasures, useMeasures } from '../../state/measures';
import { ConfidencePips } from '../ConfidencePips';
import { ConfirmDialog } from '../ConfirmDialog';
import { Field, Select } from '../controls';
import { DatePicker } from '../DatePicker';
import { ExpandButton, ExpandSlot } from '../Expandable';
import { SearchEmpty } from '../SearchBar';
import { PanelHeader } from '../SidePanel';
import { EffectChart } from './EffectChart';
import { fmtDate, fmtSigned, measureBounds } from './format';

const e = t.effect;
// Footer buttons: the app's standard icon button (xs text, 13 px icon), one line each with
// short labels and tight padding so the three fit the panel width. Labels are plain spans
// (no truncate): clipping breaks the optical centring trim.
const footBtn = 'flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap border px-1.5 text-xs';
const outlineBtn = `${footBtn} border-border-strong text-text hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent`;

/** Right panel "Effect": before/after and difference-in-differences for the selected measure. */
export function EffectPanel() {
  const toggleRight = useLayout((s) => s.toggleRight);
  const selectedId = useMeasures((s) => s.selectedId);
  const measure = useAllMeasures().find((x) => x.id === selectedId);

  return (
    <>
      <PanelHeader
        title={e.title}
        info={e.info}
        actions={
          <button type="button" onClick={toggleRight} aria-label={e.collapse} title={e.collapse} className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text">
            <VscCollapseAll size={15} />
          </button>
        }
      />
      {measure ? <Effect measure={measure} /> : <SearchEmpty>{e.none}</SearchEmpty>}
    </>
  );
}

function Effect({ measure: x }) {
  const { main } = useMap();
  const deprecate = useMeasures((s) => s.deprecate);
  const [confirming, setConfirming] = useState(false);
  const type = measureType(x.type);
  const status = measureStatus(x.status);
  const fx = x.effect;

  const exportCsv = () =>
    downloadCsv(
      `heatscape-effect-${x.id}.csv`,
      e.csvHeader,
      x.series.map((s) => [s.year, s.m, s.mLo, s.mHi, s.c, s.cLo, s.cHi, s.n]),
    );

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Measure */}
        <section className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center border" style={{ borderColor: type.color, color: type.color }} title={t.measures.types[x.type]}>
            <type.Icon size={17} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-md font-semibold leading-snug text-text">{x.name}</h3>
            <p className="mt-0.5 text-xs text-muted">
              {t.measures.types[x.type]} · {x.district} · {x.completed ? e.completedOn(fmtDate(x.completed)) : t.measures.target(x.target)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="level-chip" style={{ '--chip': status.color }}>
                {t.measures.statuses[x.status]}
              </span>
              <span className="text-xs tabular-nums text-muted">{e.area(x.area.toLocaleString('en-US'))}</span>
            </div>
          </div>
        </section>

        <StatusSection key={x.id} measure={x} />
        {fx ? <Results measure={x} /> : <NoResult measure={x} />}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
        <button type="button" onClick={() => main?.fitBounds(measureBounds(x), { padding: 160, maxZoom: 17, duration: 800 })} title={e.zoomLabel} aria-label={e.zoomLabel} className={outlineBtn}>
          <LuScanSearch size={13} className="shrink-0" aria-hidden />
          <span>{e.zoom}</span>
        </button>
        <button type="button" onClick={exportCsv} disabled={!x.series} title={e.exportLabel} aria-label={e.exportLabel} className={outlineBtn}>
          <LuDownload size={13} className="shrink-0" aria-hidden />
          <span>{e.export}</span>
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={e.deleteLabel(x.name)}
          title={e.deleteLabel(x.name)}
          className={`${footBtn} border-transparent bg-[var(--destructive)] font-semibold text-[var(--on-destructive)] hover:brightness-110`}
        >
          <LuTrash2 size={13} className="shrink-0" aria-hidden />
          <span>{e.delete}</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={e.deleteTitle}
        confirmLabel={e.deleteConfirm}
        cancelLabel={e.cancel}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          deprecate(x.id);
        }}
      >
        {e.deleteText(x.name)}
      </ConfirmDialog>
    </>
  );
}

const isDone = (status) => status === 'completed' || status === 'monitored';
const fmtStamp = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Change the status (finished statuses need a completion date) and show the timestamped trail. */
function StatusSection({ measure: x }) {
  const setStatus = useMeasures((s) => s.setStatus);
  const [next, setNext] = useState(x.status);
  const [date, setDate] = useState(x.completed ?? '');
  const done = isDone(next);
  const changed = next !== x.status || (done && date !== (x.completed ?? ''));
  const ready = changed && (!done || date);
  const name = (id) => t.measures.statuses[id];

  return (
    <section className="flex flex-col gap-2 border-b border-border px-4 py-3">
      <p className="label-caps">{e.statusTitle}</p>
      <Field label={e.newStatus}>
        <Select value={next} onChange={setNext} label={e.newStatus} options={MEASURE_STATUSES.map((s) => ({ value: s.id, label: name(s.id) }))} />
      </Field>
      {done && (
        <Field label={e.completionDate}>
          <DatePicker value={date} onChange={setDate} label={e.completionDate} />
        </Field>
      )}
      <button
        type="button"
        onClick={() => setStatus(x.id, next, date)}
        disabled={!ready}
        title={changed && !ready ? e.needDate : undefined}
        className="flex h-7 items-center gap-1.5 self-end bg-accent px-3 text-xs font-semibold text-on-accent hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
      >
        <LuCheck size={12} aria-hidden />
        <span>{e.updateStatus}</span>
      </button>

      <p className="label-caps mt-1">{e.historyTitle}</p>
      {x.history.length ? (
        <ol className="flex flex-col border border-border">
          {[...x.history].reverse().map((ev) => (
            <li key={ev.at} className="flex flex-col gap-1.5 border-b border-border-soft px-2.5 py-2 last:border-b-0">
              {/* Marker, text and time share one centred row (no hand-set offsets). */}
              <div className="flex items-center gap-2">
                <span className="size-2 shrink-0" style={{ background: measureStatus(ev.to).color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-xs text-text">{ev.from ? e.changed(name(ev.from), name(ev.to)) : e.registered(name(ev.to))}</span>
                <span className="shrink-0 text-2xs tabular-nums text-muted" title={ev.at}>
                  {fmtStamp(ev.at)}
                </span>
              </div>
              {ev.completed && <span className="pl-4 text-2xs text-muted">{e.completedNote(fmtDate(ev.completed))}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted">{e.noHistory}</p>
      )}
    </section>
  );
}

/** Why there is no estimate yet. */
function NoResult({ measure: x }) {
  const started = x.status !== 'planned' && x.status !== 'progress' && x.completed;
  const firstSummer = started ? Number(x.completed.slice(0, 4)) + (Number(x.completed.slice(5, 7)) > 7 ? MIN_SUMMERS : MIN_SUMMERS - 1) : null;
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <LuHourglass size={18} className="text-muted" aria-hidden />
      <p className="text-sm font-semibold text-text">{started ? e.awaitingTitle : e.notStartedTitle}</p>
      <p className="text-xs text-muted">{started ? e.awaitingBody(MIN_SUMMERS, firstSummer) : e.notStartedBody}</p>
    </div>
  );
}

function Stat({ label, before, after, delta }) {
  return (
    <div className="flex h-8 items-center gap-2 border-b border-border-soft last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-xs text-muted">{label}</span>
      <span className="text-xs tabular-nums text-text">
        {before} → {after}
      </span>
      <span className="w-16 text-right text-xs font-semibold tabular-nums text-text">{delta}</span>
    </div>
  );
}

function Results({ measure: x }) {
  const fx = x.effect;
  const lstDelta = fx.lstAfter.med - fx.lstBefore.med;
  return (
    <>
      <section className="border-b border-border px-4 py-3">
        <p className="label-caps">{e.lstTitle}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            [e.before, fx.lstBefore],
            [e.after, fx.lstAfter],
          ].map(([label, v]) => (
            <div key={label} className="border border-border bg-surface-raised px-3 py-2.5">
              <p className="text-2xs uppercase tracking-[var(--tracking-caps)] text-muted">
                {label} · {v.years}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-text">{v.med.toFixed(1)} °C</p>
              <p className="text-2xs tabular-nums text-muted">
                ({v.lo.toFixed(1)}–{v.hi.toFixed(1)})
              </p>
              <p className="mt-1 text-2xs tabular-nums text-muted">{e.scenes(v.n)}</p>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <Stat label={e.lstChange} before={`${fx.lstBefore.med.toFixed(1)} °C`} after={`${fx.lstAfter.med.toFixed(1)} °C`} delta={`${fmtSigned(lstDelta)} °C`} />
          <Stat label={e.sealing} before={`${fx.sealing[0]} %`} after={`${fx.sealing[1]} %`} delta={`${fmtSigned(fx.sealing[1] - fx.sealing[0], 0)} pp`} />
          <Stat label={e.ndvi} before={fx.ndvi[0].toFixed(2)} after={fx.ndvi[1].toFixed(2)} delta={fmtSigned(fx.ndvi[1] - fx.ndvi[0], 2)} />
        </div>
      </section>

      <section className="border-b border-border px-4 py-3">
        <p className="label-caps">{e.didTitle}</p>
        <div className="mt-2 border border-border bg-surface-raised px-3 py-2.5">
          <p className="text-xl font-semibold tabular-nums text-text">{fmtSigned(fx.did.med)} °C</p>
          <p className="text-xs tabular-nums text-muted">{e.interval(fmtSigned(fx.did.lo), fmtSigned(fx.did.hi))}</p>
          <div className="mt-2 flex items-center gap-2">
            <ConfidencePips level={fx.confidence} label={t.ranking.confidence[fx.confidence]} />
            <span className="text-2xs text-muted">{e.didHint(fx.summersAfter)}</span>
          </div>
        </div>
      </section>

      <section className="px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="label-caps">{e.chartTitle}</p>
          <ExpandButton id="effect-chart" className="-mr-1.5" />
        </div>
        <div className="mt-1.5">
          <ExpandSlot id="effect-chart" title={`${e.chartTitle} · ${x.name}`}>
            {(large) => <EffectChart series={x.series} completed={x.completed} large={large} />}
          </ExpandSlot>
        </div>
        <p className="mt-2 text-2xs text-muted">{e.sources}</p>
      </section>
    </>
  );
}
