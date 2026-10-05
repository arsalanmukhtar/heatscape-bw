import { useMemo, useState } from 'react';
import { LuCamera, LuLanguages, LuLocateFixed, LuMap, LuRotateCcw } from 'react-icons/lu';
import { useMap } from 'react-map-gl/mapbox';
import { VscCollapseAll } from 'react-icons/vsc';
import { t } from '../../i18n';
import { translateText } from '../../lib/api';
import { LAYERS } from '../../lib/layers';
import { captureMapView } from '../../lib/mapSnapshot';
import { byLang, reportContent, untranslated, withLang } from '../../lib/reportContent';
import { useLayout } from '../../state/layout';
import { useAllMeasures } from '../../state/measures';
import { useReports } from '../../state/reports';
import { useWorkspace } from '../../state/workspace';
import { Check, Field, Section, Segmented, TextField } from '../controls';
import { SearchEmpty } from '../SearchBar';
import { PanelHeader } from '../SidePanel';
import { SECTION_ICON } from './ReportOutline';
import { RichTextEditor } from './RichTextEditor';

const r = t.report;
const btn = 'flex h-7 shrink-0 items-center gap-1.5 border border-border px-2.5 text-xs text-text hover:bg-hover';
const fmtStamp = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const nullIfEmpty = (v) => (v.trim() ? v : null);

/** Scrolls the preview to the first block of a section. */
export function showInPreview(id) {
  document.querySelector(`.report-sheet [data-section="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Right panel in the Reports view: report settings and the selected section's properties. */
export function ReportProps() {
  const toggleRight = useLayout((s) => s.toggleRight);
  const report = useReports();
  const measures = useAllMeasures();
  const c = useMemo(() => reportContent(report, measures), [report, measures]);
  const section = report.sections.find((s) => s.id === report.selectedId);
  const lang = report.language;
  // Own text of a field in the report language ('' = none, the placeholder shows what prints).
  const own = (v) => byLang(v)[lang] ?? '';

  return (
    <>
      <PanelHeader
        title={r.propsTitle}
        actions={
          <button type="button" onClick={toggleRight} aria-label={r.collapse} title={r.collapse} className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text">
            <VscCollapseAll size={15} />
          </button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Section title={r.reportGroup}>
          <Field label={r.reportTitle}>
            <TextField value={own(report.title)} placeholder={c.title} onChange={(v) => report.setReport({ title: withLang(report.title, lang, nullIfEmpty(v)) })} label={r.reportTitle} />
          </Field>
          <Field label={r.language}>
            <Segmented
              value={lang}
              onChange={(language) => report.setReport({ language })}
              label={r.language}
              options={[
                { value: 'en', label: 'EN', title: 'English' },
                { value: 'de', label: 'DE', title: 'Deutsch' },
              ]}
            />
          </Field>
          <Field label={r.author}>
            <TextField value={report.author} onChange={(author) => report.setReport({ author })} label={r.author} />
          </Field>
          <TranslateNotice report={report} />
        </Section>
        {section ? <SectionProps key={`${section.id}-${lang}`} section={section} c={c} lang={lang} /> : <SearchEmpty>{r.noSelection}</SearchEmpty>}
      </div>
    </>
  );
}

/**
 * Texts the user wrote only in the other language: translate them all into the report
 * language with the self-hosted LibreTranslate (POST /api/translate), keeping formatting.
 */
function TranslateNotice({ report }) {
  const lang = report.language;
  const items = untranslated(report, lang);
  const [state, setState] = useState(null); // { busy: [i, n] } | { ok, text }
  if (!items.length && !state?.text) return null;

  const run = async () => {
    try {
      for (const [i, it] of items.entries()) {
        setState({ busy: [i + 1, items.length] });
        const text = await translateText(it.value, it.from, lang, it.html);
        const st = useReports.getState();
        if (!it.sectionId) st.setReport({ title: withLang(st.title, lang, text) });
        else {
          const s = st.sections.find((x) => x.id === it.sectionId);
          if (s) st.updateSection(s.id, { [it.field]: withLang(s[it.field], lang, text) });
        }
      }
      setState({ ok: true, text: r.translated });
    } catch (e) {
      setState({ ok: false, text: r.translateFailed(e.message) });
    }
  };

  return (
    <div className="flex flex-col gap-2 border border-border bg-surface-raised px-2.5 py-2">
      {items.length > 0 && <p className="text-xs leading-relaxed text-text">{r.untranslated(items.length, r.langNames[lang])}</p>}
      {state?.text && <p className={`text-xs ${state.ok ? 'text-success' : 'text-danger'}`}>{state.text}</p>}
      {items.length > 0 && (
        <button type="button" onClick={run} disabled={!!state?.busy} className={`${btn} self-start disabled:opacity-60`}>
          <LuLanguages size={12} aria-hidden />
          <span>{state?.busy ? r.translating(...state.busy) : r.translate(r.langNames[lang])}</span>
        </button>
      )}
    </div>
  );
}

function SectionProps({ section: s, c, lang }) {
  const update = useReports((st) => st.updateSection);
  const set = (patch) => update(s.id, patch);
  const setText = (field, v) => set({ [field]: withLang(s[field], lang, v) });
  const own = (field) => byLang(s[field])[lang] ?? '';
  const Icon = SECTION_ICON[s.type];

  return (
    <Section
      title={r.types[s.type]}
      actions={
        <>
          <button type="button" onClick={() => showInPreview(s.id)} aria-label={r.showInPreview} title={r.showInPreview} className="grid size-6 place-items-center text-muted hover:text-accent">
            <LuLocateFixed size={13} />
          </button>
          <Icon size={13} className="shrink-0 text-muted" aria-hidden />
        </>
      }
    >
      {s.type !== 'title' && (
        <Field label={r.sectionTitle}>
          <TextField value={own('title')} placeholder={c.heading(s)} onChange={(v) => setText('title', nullIfEmpty(v))} label={r.sectionTitle} />
        </Field>
      )}

      {s.type === 'title' && (
        <>
          <p className="text-xs leading-relaxed text-muted">{r.titleNote}</p>
          <Field label={r.subtitle}>
            <TextField value={own('subtitle')} placeholder={c.subtitle(s)} onChange={(v) => setText('subtitle', nullIfEmpty(v))} label={r.subtitle} />
          </Field>
          <Field label={r.organisation}>
            <TextField value={own('organisation')} placeholder={c.organisation(s)} onChange={(v) => setText('organisation', nullIfEmpty(v))} label={r.organisation} />
          </Field>
        </>
      )}

      {(s.type === 'summary' || s.type === 'appendix') && <TextEditor section={s} c={c} lang={lang} setText={setText} />}
      {s.type === 'appendix' && <Check checked={s.includeMeasures} onChange={(v) => set({ includeMeasures: v })} label={r.includeMeasures} />}

      {s.type === 'map' && <MapProps section={s} set={set} />}

      {s.type === 'indicators' && (
        <>
          <Check checked={s.chart} onChange={(v) => set({ chart: v })} label={r.chart} />
          <Check checked={s.uncertainty} onChange={(v) => set({ uncertainty: v })} label={r.uncertainty} />
        </>
      )}

      {s.type === 'method' && <p className="text-xs leading-relaxed text-muted">{r.methodNote}</p>}
      {s.type === 'sources' && <p className="text-xs leading-relaxed text-muted">{r.sourcesNote}</p>}
    </Section>
  );
}

/**
 * Rich text in the report language: template text until edited ("Use template text" goes
 * back to it). Text written only in the other language is shown (and marked) until translated.
 */
function TextEditor({ section: s, c, lang, setText }) {
  const versions = byLang(s.text);
  const template = c.template(s);
  // A copy of the template (set to stop the other language showing through) is not an edit.
  const edited = versions[lang] != null && versions[lang] !== template;
  const foreign = !edited && Object.keys(versions).find((l) => l !== lang && versions[l] != null);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-5 items-center gap-2">
        <span className="text-xs text-muted">{r.text}</span>
        {edited && (
          <span className="level-chip" style={{ '--chip': 'var(--info)', width: 'auto' }}>
            {r.edited}
          </span>
        )}
        {foreign && (
          <span className="level-chip" style={{ '--chip': 'var(--warning)', width: 'auto' }}>
            {r.otherLang(r.langNames[foreign])}
          </span>
        )}
        {(edited || foreign) && (
          <button type="button" onClick={() => setText('text', Object.keys(versions).some((l) => l !== lang) ? template : null)} className="ml-auto flex h-5 items-center gap-1 text-xs text-muted hover:text-accent">
            <LuRotateCcw size={11} aria-hidden />
            <span>{r.resetText}</span>
          </button>
        )}
      </div>
      <RichTextEditor value={c.text(s)} onChange={(html) => setText('text', html)} label={r.text} />
      <p className="text-2xs text-muted">{r.textHint}</p>
    </div>
  );
}

/** Capture the map behind the report (frame it in GIS View first). */
function MapProps({ section: s, set }) {
  const { main } = useMap();
  const setView = useLayout((st) => st.setView);
  const [failed, setFailed] = useState(false);
  const snap = s.snapshot;

  const capture = () => {
    const view = captureMapView(main?.getMap());
    setFailed(!view);
    if (!view) return;
    const on = useWorkspace.getState().layers;
    set({ snapshot: { ...view, layers: LAYERS.filter((d) => on[d.id]).map((d) => d.id) } });
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {snap ? (
          <img src={snap.image} alt="" className="aspect-[4/3] w-full border border-border object-cover" />
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center border border-dashed border-border-strong text-xs text-muted">
            <span>{r.noCapture}</span>
          </div>
        )}
        {snap && <p className="text-2xs tabular-nums text-muted">{r.captured(fmtStamp(snap.at), snap.zoom.toFixed(1))}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={capture} className="flex h-7 items-center gap-1.5 bg-accent px-3 text-xs font-semibold text-on-accent hover:brightness-110">
          <LuCamera size={12} aria-hidden />
          <span>{r.useMapView}</span>
        </button>
        <button type="button" onClick={() => setView('gis')} className={btn}>
          <LuMap size={12} aria-hidden />
          <span>{r.openGis}</span>
        </button>
      </div>
      <p className="text-2xs leading-relaxed text-muted">{r.mapHint}</p>
      {failed && <p className="text-xs text-danger">{r.captureFailed}</p>}
      <Check checked={s.legend} onChange={(v) => set({ legend: v })} label={r.legend} />
      <Check checked={s.uncertainty} onChange={(v) => set({ uncertainty: v })} label={r.uncertainty} />
    </>
  );
}
