/*
  Scenario prioritisation, computed in the browser from MOCK block data until the backend
  ranking service exists. Same method the service will use:
  - criteria min–max normalised over the candidate set, score = weighted sum (0–100);
  - rank stability by Monte Carlo: weights jittered ±25 % and criteria ±6 points per draw;
    rank range = 5th–95th percentile, P(top 10 %) = share of draws inside the top 10 %;
  - cooling is an indicative model estimate with a wide interval (INDICATIVE, never a guarantee).
*/
import { BLOCKS, scenarioAttrs } from '../data/mock';

export const CRITERIA = ['heat', 'vulnerable', 'sealing', 'green', 'feasibility'];
const DRAWS = 200;
const TOP_CHART = 10;

const value = (b, a, c) =>
  c === 'heat' ? b.lstDay : c === 'vulnerable' ? b.vulnerability : c === 'sealing' ? b.sealing : c === 'green' ? 100 - b.greenCover : a.feasibility;

/** Raw slider points → shares that sum to 1 (all zero → equal shares). */
export function normaliseWeights(weights) {
  const sum = CRITERIA.reduce((s, c) => s + Math.max(0, weights[c] ?? 0), 0);
  return Object.fromEntries(CRITERIA.map((c) => [c, sum > 0 ? Math.max(0, weights[c] ?? 0) / sum : 1 / CRITERIA.length]));
}

/** Districts that can be picked as target area. */
export const AREAS = [...new Set(BLOCKS.map((b) => b.district))].sort((a, b) => a.localeCompare(b));

function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ranksOf = (scores) => {
  const order = scores.map((s, i) => [s, i]).sort((x, y) => y[0] - x[0]);
  const ranks = new Array(scores.length);
  order.forEach(([, i], r) => (ranks[i] = r + 1));
  return ranks;
};

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];

const candidates = (params) =>
  BLOCKS.map((b) => ({ b, a: scenarioAttrs(b) })).filter(
    ({ b, a }) => (params.area === 'all' || b.district === params.area) && !(params.excludeProtected && a.protected) && a.parcelArea >= params.minParcel,
  );

/** Number of blocks the area and constraints leave as candidates. */
export const candidateCount = (params) => candidates(params).length;

export function computeRanking(params) {
  const items = candidates(params);
  const n = items.length;
  if (n === 0) return { rows: [], sensitivity: [], n: 0, topN: 0 };

  // Min–max normalise each criterion to 0–1 over the candidate set.
  const range = Object.fromEntries(
    CRITERIA.map((c) => {
      const v = items.map(({ b, a }) => value(b, a, c));
      return [c, [Math.min(...v), Math.max(...v)]];
    }),
  );
  for (const it of items) {
    it.x = Object.fromEntries(CRITERIA.map((c) => [c, range[c][1] > range[c][0] ? (value(it.b, it.a, c) - range[c][0]) / (range[c][1] - range[c][0]) : 0.5]));
  }

  const scoreWith = (w, jitter) => items.map((it, i) => CRITERIA.reduce((s, c) => s + w[c] * Math.min(1, Math.max(0, it.x[c] + (jitter ? jitter[i][c] : 0))), 0));
  const w = normaliseWeights(params.weights);
  const base = scoreWith(w);
  const baseRanks = ranksOf(base);
  const topN = Math.max(1, Math.ceil(n * 0.1));

  // Monte Carlo rank stability.
  const rand = mulberry(n * 7919 + Math.round(base[0] * 1e4));
  const draws = items.map(() => []);
  for (let d = 0; d < DRAWS; d++) {
    const wd = normaliseWeights(Object.fromEntries(CRITERIA.map((c) => [c, w[c] * (1 + (rand() - 0.5) * 0.5)])));
    const jitter = items.map(() => Object.fromEntries(CRITERIA.map((c) => [c, (rand() - 0.5) * 0.12])));
    ranksOf(scoreWith(wd, jitter)).forEach((r, i) => draws[i].push(r));
  }

  const goal = params.goal;
  const deseal = goal === 'greening' ? 0 : params.deseal;
  const canopy = goal === 'desealing' ? 0 : params.canopy;

  const rows = items.map((it, i) => {
    const sorted = draws[i].sort((x, y) => x - y);
    const lo = percentile(sorted, 0.05);
    const hi = percentile(sorted, 0.95);
    const width = hi - lo;
    const cool = (deseal / 100) * (it.b.sealing / 100) * 4.2 + (canopy / 100) * 3.0 * (1 - it.b.greenCover / 100);
    const now = { med: it.b.lstDay, lo: it.b.lstDay - 1.3, hi: it.b.lstDay + 1.4 };
    return {
      id: it.b.id,
      district: it.b.district,
      center: it.b.center,
      score: Math.round(base[i] * 1000) / 10,
      rank: baseRanks[i],
      rankLo: lo,
      rankHi: hi,
      pTop: draws[i].filter((r) => r <= topN).length / DRAWS,
      confidence: width <= 3 ? 'High' : width <= 8 ? 'Medium' : 'Low',
      priorityClass: 5 - Math.min(4, Math.floor(((baseRanks[i] - 1) / n) * 5)),
      contributions: Object.fromEntries(CRITERIA.map((c) => [c, Math.round(w[c] * it.x[c] * 1000) / 10])),
      cooling: { med: cool, lo: cool * 0.5, hi: cool * 1.45 },
      lstNow: now,
      lstScenario: { med: now.med - cool, lo: now.lo - cool * 1.45, hi: now.hi - cool * 0.5 },
      residents: Math.round((it.b.popDensity * it.a.parcelArea) / 1e6),
      sealedRemoveM2: Math.round((it.a.parcelArea * it.b.sealing * deseal) / 1e4),
    };
  });
  rows.sort((x, y) => x.rank - y.rank);

  // Sensitivity: how many of the top 10 drop out when one weight moves ±10 points.
  const raw = normaliseWeights(params.weights);
  const topSet = (ww) => new Set(ranksOf(scoreWith(ww)).flatMap((r, i) => (r <= TOP_CHART ? [i] : [])));
  const baseTop = topSet(w);
  const sensitivity = CRITERIA.map((c) => {
    const shift = (delta) => {
      const ww = normaliseWeights({ ...Object.fromEntries(CRITERIA.map((k) => [k, raw[k] * 100])), [c]: Math.max(0, raw[c] * 100 + delta) });
      const next = topSet(ww);
      return [...baseTop].filter((i) => !next.has(i)).length;
    };
    return { criterion: c, minus: shift(-10), plus: shift(10) };
  });

  return { rows, sensitivity, n, topN };
}

/** Surface-temperature grid with the indicative cooling of the top-priority blocks applied. */
export function scenarioGrid(grid, rows) {
  const treated = rows.filter((r) => r.priorityClass === 5);
  return {
    ...grid,
    features: grid.features.map((f) => {
      const ring = f.geometry.coordinates[0];
      const lon = (ring[0][0] + ring[2][0]) / 2;
      const lat = (ring[0][1] + ring[2][1]) / 2;
      let cool = 0;
      for (const r of treated) {
        const dx = (lon - r.center[0]) * 72; // km per degree of longitude at 49.5° N
        const dy = (lat - r.center[1]) * 111;
        cool = Math.max(cool, r.cooling.med * Math.exp(-(dx * dx + dy * dy) / 0.18));
      }
      return { ...f, properties: { ...f.properties, t: f.properties.t - cool } };
    }),
  };
}

/** Small footprint around a block centre for the priority layer (~230 × 220 m). */
export function candidateFootprint(r) {
  const [lon, lat] = r.center;
  return {
    type: 'Feature',
    properties: { id: r.id, priority: r.priorityClass, unstable: r.confidence === 'Low' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[lon - 0.0016, lat - 0.001], [lon + 0.0016, lat - 0.001], [lon + 0.0016, lat + 0.001], [lon - 0.0016, lat + 0.001], [lon - 0.0016, lat - 0.001]]],
    },
  };
}
