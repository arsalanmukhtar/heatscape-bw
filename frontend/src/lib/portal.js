import { COOL_PLACES, SURFACE_GRID, cellConfidence } from '../data/mock';
import { parseColor } from './color';
import { cssVar, distanceKm } from './css';

/*
  Public Heat Portal computations: the area result for a location (surface temperature
  around it, rank in the city, uncertainty as quantiles), value-suppressing colours for
  the heat layer, cool places with walking times, and the walking isochrone.
*/
export const RADIUS_M = 300;
const WALK_M_PER_MIN = 80; // about 4.8 km/h
const DETOUR = 1.3; // street network vs straight line
export const confLevel = (c) => (c >= 0.75 ? 'High' : c >= 0.5 ? 'Medium' : 'Low');

const center = (f) => {
  const r = f.geometry.coordinates[0];
  return [(r[0][0] + r[2][0]) / 2, (r[0][1] + r[2][1]) / 2];
};
// Cells with their centre and MOCK confidence, computed once.
export const CELLS = SURFACE_GRID.features.map((f) => {
  const c = center(f);
  return { f, center: c, t: f.properties.t, conf: cellConfidence(f.properties.id, c) };
});
const SORTED_T = CELLS.map((c) => c.t).sort((a, b) => a - b);
export const CITY_MEDIAN = SORTED_T[Math.floor(SORTED_T.length / 2)];
const median = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

/** Inverse standard normal (Acklam's approximation, |error| < 1.2e-9). */
function probit(p) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const q = Math.min(p, 1 - p);
  const r = Math.sqrt(-2 * Math.log(q));
  const tail = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  if (p < 0.02425) return tail;
  if (p > 1 - 0.02425) return -tail;
  const s = p - 0.5;
  const t = s * s;
  return ((((((a[0] * t + a[1]) * t + a[2]) * t + a[3]) * t + a[4]) * t + a[5]) * s) / (((((b[0] * t + b[1]) * t + b[2]) * t + b[3]) * t + b[4]) * t + 1);
}
// Spread (°C, one standard deviation) of the estimate per confidence level (MOCK).
const SD = { High: 0.7, Medium: 1.3, Low: 2.2 };

/**
 * Surface temperature on hot days around a point: median of the cells within RADIUS_M,
 * its rank in the city (share of cells cooler), confidence and 20 quantiles for the dot plot.
 * null outside the study area.
 */
export function areaResult(point) {
  const near = CELLS.filter((c) => distanceKm(c.center, point) * 1000 <= RADIUS_M + 150);
  if (!near.length) return null;
  const t = median(near.map((c) => c.t));
  const conf = near.reduce((a, c) => a + c.conf, 0) / near.length;
  const level = confLevel(conf);
  const cooler = SORTED_T.filter((v) => v < t).length / SORTED_T.length;
  const quantiles = Array.from({ length: 20 }, (_, i) => +(t + SD[level] * probit((i + 0.5) / 20)).toFixed(2));
  return { t, conf, level, cooler, quantiles, cells: near.length };
}

/** Plain-language rank: { kind: 'warm', pct } for the warmest pct %, or { kind: 'cool', pct }. */
export function rankPhrase(cooler) {
  const warm = Math.max(10, Math.ceil((1 - cooler) * 10) * 10);
  return warm <= 50 ? { kind: 'warm', pct: warm } : { kind: 'cool', pct: Math.max(10, Math.ceil(cooler * 10) * 10) };
}

/** Cool places by walking time from a point (minutes, rounded up), nearest first. */
export function coolPlacesNear(point) {
  return COOL_PLACES.map((p) => {
    const m = distanceKm(p.center, point) * 1000 * DETOUR;
    return { ...p, meters: Math.round(m / 10) * 10, minutes: Math.max(1, Math.ceil(m / WALK_M_PER_MIN)) };
  }).sort((a, b) => a.meters - b.meters);
}

/*
  Value-suppressing colours (VSUP) on the portal's spectral ramp: blue and green = cooler
  than the Mannheim median, yellow = typical, orange and red = hotter (--spectral-1…11).
  The more uncertain a cell, the fewer classes it can show and the more it
  fades towards the suppress grey: High 11 classes, full colour; Medium 5, 40 % grey;
  Low 3, 70 % grey. ±DIV_RANGE °C around the median spans the ramp.
*/
const VSUP = { High: { classes: 11, grey: 0 }, Medium: { classes: 5, grey: 0.4 }, Low: { classes: 3, grey: 0.7 } };
export const DIV_RANGE = 5.5;
const DIV_TOKENS = Array.from({ length: 11 }, (_, i) => `--spectral-${i + 1}`);
/** Ramp step (0–10) of a temperature at full confidence. */
const divStep = (t, classes = 11) => {
  const x = Math.max(0, Math.min(0.999, (t - CITY_MEDIAN + DIV_RANGE) / (2 * DIV_RANGE)));
  const k = Math.floor(x * classes);
  return Math.max(0, Math.min(10, Math.round(((k + 0.5) / classes) * 11 - 0.5)));
};
/** Token colour of a temperature at full confidence (quantile dots, legend). */
export const divColor = (t) => `var(${DIV_TOKENS[divStep(t)]})`;
const mix = (a, b, k) => `rgb(${Math.round(a.r + (b.r - a.r) * k)}, ${Math.round(a.g + (b.g - a.g) * k)}, ${Math.round(a.b + (b.b - a.b) * k)})`;

/** Colour function (temperature, confidence level) → rgb(); reads the tokens once. */
export function vsupColors() {
  const ramp = DIV_TOKENS.map((name) => parseColor(cssVar(name)));
  const grey = parseColor(cssVar('--unc-suppress'));
  // Fewer classes pick wider, centred steps of the 11-step ramp.
  return (t, level) => mix(ramp[divStep(t, VSUP[level].classes)], grey, VSUP[level].grey);
}

/** The heat grid with a VSUP colour per cell (property color), for the map. */
export function vsupGrid(colorOf) {
  return { type: 'FeatureCollection', features: CELLS.map((c) => ({ ...c.f, properties: { ...c.f.properties, color: colorOf(c.t, confLevel(c.conf)) } })) };
}

/** Circle polygon of radius m around a point (64 vertices). */
export function circle([lon, lat], m) {
  const dLat = m / 111320;
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * 2 * Math.PI;
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/** 10-minute walking area (Mapbox Isochrone API); null if it is unavailable. */
export async function walkIsochrone([lon, lat], signal) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;
  const url = `https://api.mapbox.com/isochrone/v1/mapbox/walking/${lon},${lat}?contours_minutes=10&polygons=true&denoise=1&access_token=${token}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const json = await res.json();
  return json.features?.[0] ?? null;
}
