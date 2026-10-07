import { t } from '../i18n';
import { fieldText, layerRows } from './layers';
import { measureStatus, measureType } from './measures';

/*
  Feature popups: what a clicked feature shows, per layer. popupModel returns
    { title, subtitle, chips: [{ label, color }], stats: [{ label, value, color }], rows: [{ label, value }] }
  stats are the key values (large, coloured by meaning: heat levels, sealing, status);
  rows are the remaining attributes. Layers without a template list their fields.
*/
const p = t.popup;
const f = t.layers.fields;

const LEVEL = { severe: 'var(--level-severe)', high: 'var(--level-high)', moderate: 'var(--level-moderate)', normal: 'var(--level-normal)' };
const HEAT_CLASS = { Severe: LEVEL.severe, High: LEVEL.high, Moderate: LEVEL.moderate, Low: LEVEL.normal };
const RISK = { Critical: LEVEL.severe, High: LEVEL.high, Moderate: LEVEL.moderate, Low: LEVEL.normal };
const BAND = { 'Very high': 'var(--seal-8)', High: 'var(--seal-6)', Medium: 'var(--seal-4)', Low: 'var(--seal-2)' };

/** Surface temperature (LST, hot afternoons) → level colour. */
const surfaceColor = (v) => (v >= 38 ? LEVEL.severe : v >= 35 ? LEVEL.high : v >= 32 ? LEVEL.moderate : LEVEL.normal);
/** Air temperature (2 m) → level colour; mild values stay in text colour. */
const airColor = (v) => (v >= 35 ? LEVEL.severe : v >= 30 ? LEVEL.high : v >= 25 ? LEVEL.moderate : 'var(--text)');
const sealColor = (v) => `var(--seal-${Math.max(1, Math.min(9, Math.ceil((v / 100) * 9)))})`;
const vulnColor = (v) => `var(--vuln-${Math.max(1, Math.min(9, Math.ceil((v / 100) * 9)))})`;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const fmt = (v, digits = 0) => (isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : v == null || v === '' ? '–' : String(v));
const unit = (v, u, digits = 0) => (isNum(v) ? `${fmt(v, digits)} ${u}` : '–');
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–');
const stat = (label, value, color) => ({ label, value, color });
const row = (label, value) => ({ label, value });

const TEMPLATES = {
  surfaceTemp: (r) => ({
    title: p.cell(r.id),
    subtitle: p.surfaceSub,
    chips: [{ label: r.heatClass, color: HEAT_CLASS[r.heatClass] }],
    stats: [stat(p.surfaceTemp, unit(r.t, '°C', 1), surfaceColor(r.t))],
  }),
  airTemp: (r) => ({
    title: p.cell(r.id),
    subtitle: p.airSub,
    chips: [{ label: r.heatClass, color: HEAT_CLASS[r.heatClass] }],
    stats: [stat(p.airTemp, unit(r.t, '°C', 1), airColor(r.t))],
  }),
  blocks: (r) => ({
    title: r.district,
    subtitle: p.block(r.id),
    chips: [{ label: p.risk(r.risk), color: RISK[r.risk] }],
    stats: [stat(f.peakTemp ?? t.table.columns.peakTemp, unit(r.peakTemp, '°C', 1), surfaceColor(r.peakTemp)), stat(t.table.columns.sealing, unit(r.sealing, '%'), sealColor(r.sealing)), stat(f.vulnerability, fmt(r.vulnerability), vulnColor(r.vulnerability))],
    rows: [row(t.table.columns.avgTemp, unit(r.avgTemp, '°C', 1)), row(f.lstDay, unit(r.lstDay, '°C', 1)), row(t.table.columns.greenCover, unit(r.greenCover, '%')), row(t.table.columns.popDensity, unit(r.popDensity, '/km²'))],
  }),
  sealing: (r) => ({
    title: p.point(r.id),
    subtitle: p.sealingSub,
    chips: [{ label: r.band, color: BAND[r.band] }],
    stats: [stat(t.table.columns.sealing, unit(r.sealing, '%'), sealColor(r.sealing))],
  }),
  hospitals: (r) => ({
    title: r.name,
    subtitle: [r.address, [r.postcode, r.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || p.overture,
    // Overture's confidence that the place exists (0–1): low values are flagged.
    chips: [isNum(r.confidence) && r.confidence < 0.5 && { label: p.lowConfidence, color: 'var(--warning)' }],
    stats: [stat(f.confidence, fmt(r.confidence, 2))],
    rows: [row(f.phone, r.phone ?? '–'), row(f.website, r.website ?? '–'), row(f.id, r.id)],
  }),
  water: (r) => ({
    title: r.name,
    subtitle: r.operator ?? p.osm,
    chips: [{ label: p.waterKind[r.kind] ?? r.kind, color: 'var(--accent-2)' }],
    rows: [row(f.id, r.id)],
  }),
  dwdStations: (r) => ({
    title: r.name,
    subtitle: p.station(r.id, fmt(r.elevation)),
    chips: [r.heatDays > 0 && { label: p.heatDays(r.heatDays, r.season), color: LEVEL.high }, r.tropicalNights > 0 && { label: p.tropical(r.tropicalNights), color: LEVEL.severe }],
    stats: [stat(f.latestTemp, unit(r.latestTemp, '°C', 1), airColor(r.latestTemp)), stat(f.lastDayMax, unit(r.lastDayMax, '°C', 1), airColor(r.lastDayMax)), stat(f.lastDayMin, unit(r.lastDayMin, '°C', 1))],
    rows: [row(p.observed, when(r.observedAt)), row(f.lastDay, r.lastDay ?? '–'), row(p.summerOf(r.season), `${fmt(r.summerDays)} / ${fmt(r.heatDays)} / ${fmt(r.tropicalNights)}`), row(f.summerMax, unit(r.summerMax, '°C', 1))],
  }),
  population: (r) => ({
    title: p.zensusCell,
    subtitle: r.id,
    stats: [stat(f.population, fmt(r.population), 'var(--accent)'), stat(f.meanAge, unit(r.meanAge, p.years, 1))],
  }),
  measures: (r) => {
    const type = measureType(r.type);
    const status = measureStatus(r.status);
    return {
      title: r.name,
      subtitle: `${r.district} · ${r.id}`,
      chips: [
        { label: t.measures.types[r.type], color: type.color },
        { label: t.measures.statuses[r.status], color: status.color },
      ],
      stats: [stat(f.area, unit(r.area, 'm²')), stat(f.cost, unit(r.cost, '€')), stat(f.effect, isNum(r.effect) ? unit(r.effect, '°C', 1) : p.noEffect, isNum(r.effect) ? (r.effect < 0 ? 'var(--accent-2)' : LEVEL.high) : 'var(--text-muted)')],
      rows: [row(f.completed, r.completed ?? '–'), row(f.residents, fmt(r.residents))],
    };
  },
};
TEMPLATES.measureBuffers = (r) => ({ ...TEMPLATES.measures(r), subtitle: p.buffer });

const admin = (r) => ({
  title: r.name,
  subtitle: [r.district, r.region, r.state].filter((v) => v && v !== r.name).join(' · ') || null,
  chips: [r.type && { label: r.type, color: 'var(--accent)' }],
  stats: [stat(f.population, fmt(r.population), 'var(--accent)'), stat(f.areaKm2, unit(r.area, 'km²', 1)), stat(f.density, unit(r.density, '/km²'))],
  rows: [row(f.ars, r.ars ?? '–'), row(f.nuts, r.nuts ?? '–'), row(f.id, r.id)],
});
['adminLand', 'adminRbz', 'adminKrs', 'adminVwg', 'adminGem', 'adminOsm9', 'adminOsm10'].forEach((id) => (TEMPLATES[id] = admin));

/** Generic popup: every attribute of the layer (coordinates left out). */
function generic(def, r) {
  const fields = (def.fields ?? []).filter((x) => x.kind !== 'coord');
  const name = fields.find((x) => x.kind === 'text');
  return { title: name ? r[name.key] : r.id, subtitle: null, rows: fields.filter((x) => x !== name).map((x) => row(x.label, fmt(fieldText(x, r[x.key])))) };
}

/** Attribute row of a feature: the layer's full row (same id), else the clicked properties. */
export function featureRow(def, props) {
  const id = props?.id;
  return (id != null && layerRows(def).find((r) => String(r.id) === String(id))) || props || {};
}

export function popupModel(def, props) {
  const r = featureRow(def, props);
  const m = (TEMPLATES[def.id] ?? ((x) => generic(def, x)))(r);
  return { title: m.title ?? '–', subtitle: m.subtitle ?? null, chips: (m.chips ?? []).filter(Boolean), stats: m.stats ?? [], rows: m.rows ?? [], row: r };
}
