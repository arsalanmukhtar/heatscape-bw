import { t } from '../../i18n';

const m = t.measures;

/** "27 Aug 2021" from an ISO date. */
export const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');

/** Signed number with a true minus sign: −2.1, +0.4. */
export const fmtSigned = (v, digits = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}`;

export const fmtInt = (v) => Math.round(v ?? 0).toLocaleString('en-US');

/** Effect indicator for lists: DiD median, or why there is none yet. */
export function fmtEffect(measure) {
  if (measure.effect) return { value: measure.effect.did.med, text: `${fmtSigned(measure.effect.did.med)} °C` };
  if (measure.status === 'planned' || measure.status === 'progress') return { value: null, text: m.notStarted };
  return { value: null, text: m.awaiting };
}

/** "−1.6 °C (−0.7 to −2.4)" */
export const fmtInterval = ({ med, lo, hi }) => `${fmtSigned(med)} °C (${fmtSigned(lo)} to ${fmtSigned(hi)})`;

/** [[w, s], [e, n]] of a measure footprint. */
export function measureBounds(measure) {
  // Every corner of every part (a multipolygon's parts can lie apart).
  const { type, coordinates } = measure.geometry;
  const ring = coordinates.flat(type === 'MultiPolygon' ? 2 : 1);
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}
