import { BLOCKS, DATA_VERSION, REGION, REPORT_INDICATORS, REPORT_SOURCES, SEASON } from '../data/mock';
import { t } from '../i18n';
import { creditLine } from './attribution';
import { measureStatus, measureType } from './measures';
import { richHtml } from './richText';

/*
  Report content resolved for one language: texts (template text unless the user wrote
  their own), indicator rows, chart rows and tables. The preview (components/report) and
  the DOCX export (lib/reportDocx.js) both read this, so they always print the same.
*/
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
const done = (m) => m.status === 'completed' || m.status === 'monitored';

/** Numbers quoted by the summary texts. */
function stats(measures, lang) {
  return {
    region: REGION.name,
    season: SEASON.label,
    blocks: BLOCKS.length,
    critical: BLOCKS.filter((b) => b.risk === 'Critical').length,
    high: BLOCKS.filter((b) => b.risk === 'High').length,
    // The same figure as the indicators table, so text and table never disagree.
    residents: fmtValue(REPORT_INDICATORS.find((r) => r.id === 'residentsExposed').med, 0, lang),
    monitored: measures.filter((m) => m.effect).length,
  };
}

/** Median and 10–90 % range of block LST per district, hottest first (top 8). */
function districtRows() {
  const by = new Map();
  for (const b of BLOCKS) by.set(b.district, [...(by.get(b.district) ?? []), b.lstDay]);
  return [...by.entries()]
    .map(([label, values]) => {
      const v = [...values].sort((a, b) => a - b);
      return { label, med: quantile(v, 0.5), lo: quantile(v, 0.1), hi: quantile(v, 0.9) };
    })
    .sort((a, b) => b.med - a.med)
    .slice(0, 8);
}

export const fmtValue = (v, digits = 1, lang = 'en') => v.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fmtSignedValue = (v, digits, lang) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtValue(Math.abs(v), digits, lang)}`;
export const fmtReportDate = (date, lang) => date.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/*
  User text fields (report title, section heading, subtitle, organisation, rich text) keep
  one version per language: null (template text), a legacy string (written in English) or
  { en, de }. A language without its own version shows the other language's text until it
  is translated (lib/api.js translateText) or written.
*/
export const LANGS = ['en', 'de'];
export const byLang = (v) => (v == null ? {} : typeof v === 'string' ? { en: v } : v);
/** The field in a language, else the user's text in the other language; null = template. */
export const inLang = (v, lang) => byLang(v)[lang] ?? LANGS.map((l) => byLang(v)[l]).find((x) => x != null) ?? null;
/** The field with one language's text set (null removes it; no versions left = null). */
export function withLang(v, lang, text) {
  const m = { ...byLang(v), [lang]: text };
  if (text == null) delete m[lang];
  return Object.keys(m).length ? m : null;
}
export const TEXT_FIELDS = ['title', 'subtitle', 'organisation', 'text'];

/** Fields with the user's text only in the other language: [{ sectionId?, field, from, value, html }]. */
export function untranslated(report, lang) {
  const other = LANGS.find((l) => l !== lang);
  const missing = (v) => (byLang(v)[lang] == null ? byLang(v)[other] : null);
  const items = [];
  if (missing(report.title) != null) items.push({ field: 'title', from: other, value: missing(report.title), html: false });
  for (const s of report.sections) {
    for (const field of TEXT_FIELDS) {
      const value = missing(s[field]);
      if (value != null) items.push({ sectionId: s.id, field, from: other, value: field === 'text' ? richHtml(value) : value, html: field === 'text' });
    }
  }
  return items;
}

/** Everything the pages print, for the report state and the current measures register. */
export function reportContent(report, measures) {
  const P = t.reportPage[report.language] ?? t.reportPage.en;
  const lang = report.language;
  const s = stats(measures, lang);
  const isMeasure = report.template === 'measure';
  const monitored = measures.filter((m) => m.effect);

  const indicatorRows = isMeasure
    ? monitored.map((m) => ({ label: m.name, med: m.effect.did.med, lo: m.effect.did.lo, hi: m.effect.did.hi, unit: '°C', digits: 1, signed: true, confidence: m.effect.confidence }))
    : REPORT_INDICATORS.map((r) => ({ ...r, label: P.indicators[r.id] }));
  const chartRows = isMeasure ? monitored.map((m) => ({ label: m.name, med: m.effect.did.med, lo: m.effect.did.lo, hi: m.effect.did.hi })) : districtRows();

  return {
    P,
    lang,
    title: inLang(report.title, lang) ?? P.defaultTitle[report.template],
    dataVersion: DATA_VERSION,
    date: fmtReportDate(new Date(), lang),
    heading: (section) => inLang(section.title, lang) ?? (section.type === 'title' ? null : P.headings[section.type]),
    subtitle: (section) => inLang(section.subtitle, lang) ?? P.defaultSubtitle(REGION.name, `${SEASON.label} (${SEASON.range})`),
    organisation: (section) => inLang(section.organisation, lang) ?? P.organisation,
    // Clean HTML: the user's rich text, or the template text converted.
    text: (section) => richHtml(inLang(section.text, lang) ?? (section.type === 'summary' ? P.summary[report.template](s) : P.appendix)),
    /** Template text of a section in this language (clean HTML). */
    template: (section) => richHtml(section.type === 'summary' ? P.summary[report.template](s) : P.appendix),
    indicatorHead: isMeasure ? P.measureHead : P.indicatorHead,
    indicatorRows,
    chart: { title: isMeasure ? P.chartMeasures : P.chartDistricts, rows: chartRows, unit: '°C' },
    sources: REPORT_SOURCES,
    // Footer credit line: every listed source's required credit, plus the basemap.
    credits: creditLine([...REPORT_SOURCES.map((x) => x.attribution), 'mapbox'], lang),
    measureRows: measures.filter(done).map((m) => ({
      name: m.name,
      type: P.types[m.type],
      status: P.statuses[m.status],
      typeColor: measureType(m.type).color,
      statusColor: measureStatus(m.status).color,
      district: m.district,
      area: fmtValue(m.area, 0, lang),
      effect: m.effect ? fmtSignedValue(m.effect.did.med, 1, lang) : P.awaiting,
    })),
  };
}
