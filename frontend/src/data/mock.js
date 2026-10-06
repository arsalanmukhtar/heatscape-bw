/*
  MOCK DATA. Illustrative values for UI development only: none of these numbers are
  measurements or model output. Replace with API data once the backend exists.

  Block: { id, district, avgTemp, peakTemp (season °C), lstDay (heat-day °C), sealing %,
           greenCover %, popDensity (per km²), risk, vulnerability (0–100),
           center [lon, lat], weekly: { block[4], city[4] } (July, weeks 1–4) }
*/
import { rectAround } from '../lib/measures';

export const REGION = { name: 'Mannheim', state: 'Baden-Württemberg', center: [8.4805, 49.4875] };
export const SEASON = { label: 'Summer 2025', range: 'Jun–Aug', chartMonth: 'Jul 2025' };
export const TEMP_DOMAIN = [28, 42];

const CITY_WEEKLY = [31.4, 33.0, 33.5, 32.6];

export const riskFor = (peak) => (peak >= 41 ? 'Critical' : peak >= 39 ? 'High' : peak >= 37 ? 'Moderate' : 'Low');

// Small deterministic generator so the mock data is the same on every load.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (v) => Math.round(v * 10) / 10;
const weeklyFor = (lstDay) => ({
  block: [lstDay - 2.6, lstDay - 0.4, lstDay, lstDay - 1.3].map(round1),
  city: CITY_WEEKLY,
});

const FEATURED = [
  { id: 'M-14', district: 'Neckarstadt-West', avgTemp: 36.8, peakTemp: 41.2, lstDay: 38.2, sealing: 88, greenCover: 4, popDensity: 12400, risk: 'Critical', vulnerability: 78, center: [8.4605, 49.4985], weekly: { block: [35.6, 37.8, 38.2, 36.9], city: CITY_WEEKLY } },
  { id: 'M-07', district: 'Friedrichsfeld', avgTemp: 35.1, peakTemp: 39.6, lstDay: 37.0, sealing: 74, greenCover: 11, popDensity: 9800, risk: 'High', vulnerability: 64, center: [8.5745, 49.4475], weekly: weeklyFor(37.0) },
  { id: 'M-22', district: 'Lindenhof', avgTemp: 33.4, peakTemp: 38.0, lstDay: 35.6, sealing: 61, greenCover: 22, popDensity: 7200, risk: 'Moderate', vulnerability: 51, center: [8.463, 49.479], weekly: weeklyFor(35.6) },
  { id: 'M-31', district: 'Waldfriedhof', avgTemp: 30.9, peakTemp: 34.5, lstDay: 32.1, sealing: 38, greenCover: 46, popDensity: 3100, risk: 'Low', vulnerability: 29, center: [8.4685, 49.5225], weekly: weeklyFor(32.1) },
];

const DISTRICTS = [
  { name: 'Innenstadt', center: [8.467, 49.488], heat: 1 },
  { name: 'Jungbusch', center: [8.458, 49.493], heat: 0.9 },
  { name: 'Neckarstadt-Ost', center: [8.478, 49.499], heat: 0.75 },
  { name: 'Oststadt', center: [8.482, 49.483], heat: 0.55 },
  { name: 'Schwetzingerstadt', center: [8.483, 49.476], heat: 0.7 },
  { name: 'Neckarau', center: [8.475, 49.455], heat: 0.6 },
  { name: 'Almenhof', center: [8.468, 49.463], heat: 0.5 },
  { name: 'Rheinau', center: [8.53, 49.432], heat: 0.55 },
  { name: 'Seckenheim', center: [8.565, 49.465], heat: 0.4 },
  { name: 'Käfertal', center: [8.515, 49.512], heat: 0.45 },
  { name: 'Vogelstang', center: [8.545, 49.506], heat: 0.4 },
  { name: 'Wallstadt', center: [8.556, 49.515], heat: 0.25 },
  { name: 'Feudenheim', center: [8.535, 49.493], heat: 0.3 },
  { name: 'Neuostheim', center: [8.505, 49.478], heat: 0.35 },
  { name: 'Sandhofen', center: [8.46, 49.55], heat: 0.35 },
  { name: 'Schönau', center: [8.47, 49.537], heat: 0.4 },
  { name: 'Waldhof', center: [8.468, 49.523], heat: 0.6 },
  { name: 'Luzenberg', center: [8.46, 49.512], heat: 0.65 },
];

function generateBlocks() {
  const rand = rng(2025);
  const used = new Set(FEATURED.map((b) => b.id));
  const blocks = [...FEATURED];
  for (let n = 1; blocks.length < 128; n++) {
    const id = `M-${String(n).padStart(2, '0')}`;
    if (used.has(id)) continue;
    const d = DISTRICTS[Math.floor(rand() * DISTRICTS.length)];
    const avgTemp = round1(28.5 + d.heat * 5.5 + rand() * 1.6);
    const peakTemp = round1(avgTemp + 3.2 + rand() * 1.6);
    const sealing = Math.round(Math.min(92, 25 + d.heat * 55 + rand() * 12));
    const lstDay = round1(avgTemp + 1.2 + rand() * 0.6);
    blocks.push({
      id,
      district: d.name,
      avgTemp,
      peakTemp,
      lstDay,
      sealing,
      greenCover: Math.max(2, Math.round(70 - sealing * 0.72 + rand() * 6)),
      popDensity: Math.round((1800 + d.heat * 9000 + rand() * 2500) / 100) * 100,
      risk: riskFor(peakTemp),
      vulnerability: Math.round(20 + d.heat * 50 + rand() * 15),
      center: [d.center[0] + (rand() - 0.5) * 0.012, d.center[1] + (rand() - 0.5) * 0.008],
      weekly: weeklyFor(lstDay),
    });
  }
  return blocks;
}

export const BLOCKS = generateBlocks();
export const blockById = (id) => BLOCKS.find((b) => b.id === id) ?? BLOCKS[0];

/** Rectangle of roughly 1.1 × 0.9 km around a block centre: [[west, south], [east, north]]. */
export function blockBounds(b) {
  const [lon, lat] = b.center;
  return [
    [lon - 0.0075, lat - 0.004],
    [lon + 0.0075, lat + 0.004],
  ];
}

/* Synthetic surface-temperature field on a ~250 m grid: warm in the dense centre and
   the industrial north, cooler along the Rhine and in the Käfertal forest. */
const GRID = { west: 8.42, east: 8.6, south: 49.43, north: 49.56, dLon: 0.0035, dLat: 0.00225 };

function heatAt(lon, lat, noise) {
  const bump = (cx, cy, amp, s) => amp * Math.exp(-(((lon - cx) / (s * 1.5)) ** 2 + ((lat - cy) / s) ** 2));
  let t = 29.5;
  t += bump(8.465, 49.492, 9, 0.016);
  t += bump(8.47, 49.53, 4.5, 0.012);
  t += bump(8.574, 49.447, 6, 0.008);
  t += bump(8.53, 49.432, 3.5, 0.01);
  t -= bump(8.535, 49.535, 4.5, 0.018);
  if (lon < 8.445) t -= 2.5;
  return Math.max(26, Math.min(43, t + noise));
}

export const heatClassFor = (t) => (t >= 38 ? 'Severe' : t >= 35 ? 'High' : t >= 32 ? 'Moderate' : 'Low');

function grid(scale, offset, seed, prefix) {
  const rand = rng(seed);
  const features = [];
  const dLon = GRID.dLon * scale;
  const dLat = GRID.dLat * scale;
  for (let lon = GRID.west; lon < GRID.east; lon += dLon) {
    for (let lat = GRID.south; lat < GRID.north; lat += dLat) {
      const t = round1(heatAt(lon + dLon / 2, lat + dLat / 2, (rand() - 0.5) * (scale > 1 ? 0.6 : 2.2)) + offset);
      features.push({
        type: 'Feature',
        properties: { id: `${prefix}-${String(features.length + 1).padStart(4, '0')}`, t, heatClass: heatClassFor(t) },
        geometry: {
          type: 'Polygon',
          coordinates: [[[lon, lat], [lon + dLon, lat], [lon + dLon, lat + dLat], [lon, lat + dLat], [lon, lat]]],
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

export const SURFACE_GRID = grid(1, 0, 7, 'S');
export const AIR_GRID = grid(4, -3.5, 11, 'A');

/** Sealing points on a ~500 m grid, sized by sealed share. */
export const SEALING_POINTS = (() => {
  const rand = rng(19);
  const features = [];
  for (let lon = GRID.west; lon < GRID.east; lon += GRID.dLon * 2) {
    for (let lat = GRID.south; lat < GRID.north; lat += GRID.dLat * 2) {
      const heat = (heatAt(lon, lat, 0) - 26) / 17;
      const sealing = Math.round(Math.max(5, Math.min(95, heat * 95 + (rand() - 0.5) * 20)));
      features.push({
        type: 'Feature',
        properties: {
          id: `P-${String(features.length + 1).padStart(4, '0')}`,
          sealing,
          band: sealing >= 75 ? 'Very high' : sealing >= 50 ? 'High' : sealing >= 25 ? 'Medium' : 'Low',
        },
        geometry: { type: 'Point', coordinates: [lon + GRID.dLon, lat + GRID.dLat] },
      });
    }
  }
  return { type: 'FeatureCollection', features };
})();

/*
  MOCK rasters on a ~125 m grid over the study area. values: row-major from the north-west
  corner, null = no data (the Rhine strip along the western edge).
  LST_RASTER: land surface temperature, °C. HAZARD_RASTER: heat hazard class 1–5.
*/
function rasterGrid(seed, valueAt) {
  const rand = rng(seed);
  const dLon = GRID.dLon / 2;
  const dLat = GRID.dLat / 2;
  const cols = Math.round((GRID.east - GRID.west) / dLon);
  const rows = Math.round((GRID.north - GRID.south) / dLat);
  const values = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lon = GRID.west + (c + 0.5) * dLon;
      const lat = GRID.north - (r + 0.5) * dLat;
      values[r * cols + c] = lon < 8.428 ? null : valueAt(heatAt(lon, lat, (rand() - 0.5) * 1.2));
    }
  }
  return { bounds: [GRID.west, GRID.south, GRID.west + cols * dLon, GRID.north], cols, rows, values };
}

export const LST_RASTER = { ...rasterGrid(31, round1), unit: '°C' };
export const HAZARD_CLASSES = [
  { value: 1, label: 'Very low' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'High' },
  { value: 5, label: 'Very high' },
];
export const HAZARD_RASTER = {
  ...rasterGrid(37, (t) => (t >= 39.5 ? 5 : t >= 37 ? 4 : t >= 34.5 ? 3 : t >= 32 ? 2 : 1)),
  unit: '',
  classes: HAZARD_CLASSES,
};

/*
  MOCK adaptation measures register (Mannheim; illustrative only, not real projects).
  effect: satellite before/after estimate for the footprint against a matched control
  area of similar sealing and heat, over summers (Jun–Aug) 2016–2025:
    lstBefore / lstAfter: median summer LST (°C) with a 90 % interval and the number of
      clear-sky Landsat 8/9 scenes; sealing (%) and NDVI from Sentinel-2;
    did: difference-in-differences (measure change − control change), °C, 90 % interval;
    series: per summer, measure and control medians with intervals.
  effect is null until MIN_SUMMERS post-completion summers exist ("awaiting data").
*/
export const MANNHEIM_DISTRICTS = DISTRICTS.map(({ name, center }) => ({ name, center }));

export const FUNDING_PROGRAMMES = [
  'KLIMOPASS (Baden-Württemberg)',
  'Natürlicher Klimaschutz in Kommunen (KfW 444)',
  'Klimaanpassung in sozialen Einrichtungen (BMUV)',
  'Städtebauförderung',
  'Municipal budget',
];

export const RESPONSIBLE_OFFICES = [
  'Grünflächen und Umwelt',
  'Tiefbau',
  'Bildung (Schulbau)',
  'Geoinformation und Stadtplanung',
  'Klimaschutzagentur Mannheim',
];

// Summer heat anomaly by year (°C), shared by measure and control series.
const SUMMER_ANOMALY = { 2016: 0, 2017: 0.4, 2018: 1.6, 2019: 1.1, 2020: 0.6, 2021: -0.4, 2022: 1.9, 2023: 1.3, 2024: 0.5, 2025: 0.9 };
const SUMMERS = Object.keys(SUMMER_ANOMALY).map(Number);
// Typical local LST effect (°C) and what the satellite sees of each type.
const TYPE_EFFECT = {
  desealing: { lst: -2.2, ramp: 1, sealing: [86, 38], ndvi: [0.09, 0.28], noise: 0 },
  greenroof: { lst: -1.1, ramp: 1, sealing: [97, 97], ndvi: [0.06, 0.33], noise: 0.2 },
  shade: { lst: -0.4, ramp: 1, sealing: [82, 82], ndvi: [0.08, 0.09], noise: 0.9 },
  trees: { lst: -1.5, ramp: 3, sealing: [64, 58], ndvi: [0.17, 0.36], noise: 0.3 },
  water: { lst: -1.7, ramp: 1, sealing: [79, 71], ndvi: [0.1, 0.14], noise: 0.4 },
};
// Last summer with data in the MOCK archive.
const LAST_SUMMER = 2025;

const MEASURE_SEEDS = [
  { id: 'MS-001', name: 'Schoolyard de-sealing, Humboldtschule', type: 'desealing', status: 'monitored', district: 'Neckarstadt-West', completed: '2021-08-27', size: [62, 48, 12], offset: [-180, 120], cost: 410000, funding: 0, office: 2, residents: 4100 },
  { id: 'MS-002', name: 'Street trees, Mittelstraße', type: 'trees', status: 'monitored', district: 'Neckarstadt-West', completed: '2020-11-15', size: [340, 18, 32], offset: [150, -60], cost: 286000, funding: 1, office: 0, trees: 48, residents: 6900 },
  { id: 'MS-003', name: 'Green roof, Collini-Center podium', type: 'greenroof', status: 'monitored', district: 'Oststadt', completed: '2022-05-20', size: [70, 55, -8], offset: [220, 260], cost: 515000, funding: 3, office: 3, residents: 2300 },
  { id: 'MS-004', name: 'Water play and misting, Marktplatz', type: 'water', status: 'monitored', district: 'Innenstadt', completed: '2021-06-30', size: [40, 40, 0], offset: [40, 160], cost: 198000, funding: 4, office: 0, residents: 5200 },
  { id: 'MS-005', name: 'Shade sails, Jungbusch playground', type: 'shade', status: 'monitored', district: 'Jungbusch', completed: '2022-06-10', size: [36, 28, 20], offset: [-60, -90], cost: 64000, funding: 4, office: 0, residents: 3800 },
  { id: 'MS-006', name: 'Courtyard de-sealing, Luzenberg', type: 'desealing', status: 'monitored', district: 'Luzenberg', completed: '2022-09-30', size: [55, 44, -15], offset: [80, 40], cost: 238000, funding: 0, office: 1, residents: 2600 },
  { id: 'MS-007', name: 'Tree avenue, Seckenheimer Straße', type: 'trees', status: 'monitored', district: 'Schwetzingerstadt', completed: '2021-03-31', size: [420, 22, 64], offset: [0, 0], cost: 352000, funding: 1, office: 0, trees: 61, residents: 7400 },
  { id: 'MS-008', name: 'Green roofs, Franklin district', type: 'greenroof', status: 'completed', district: 'Käfertal', completed: '2024-09-15', size: [120, 60, 5], offset: [600, -300], cost: 940000, funding: 3, office: 3, residents: 3100 },
  { id: 'MS-009', name: 'Car park de-sealing, Waldhof', type: 'desealing', status: 'completed', district: 'Waldhof', completed: '2024-10-01', size: [90, 50, -20], offset: [-120, 80], cost: 305000, funding: 0, office: 1, residents: 2900 },
  { id: 'MS-010', name: 'Pocket park, Neckarau', type: 'trees', status: 'progress', district: 'Neckarau', completed: null, target: '2025-11', size: [48, 40, 10], offset: [100, -40], cost: 175000, funding: 2, office: 0, trees: 14, residents: 2200 },
  { id: 'MS-011', name: 'Spray fountain, Alter Meßplatz', type: 'water', status: 'monitored', district: 'Neckarstadt-Ost', completed: '2020-07-01', size: [46, 34, 0], offset: [-150, -120], cost: 226000, funding: 4, office: 0, residents: 4800 },
  { id: 'MS-012', name: 'Shade pergolas, Friedrichsplatz', type: 'shade', status: 'planned', district: 'Oststadt', completed: null, target: '2026-06', size: [60, 20, 0], offset: [-260, 120], cost: 140000, funding: 2, office: 3, residents: 3500 },
  { id: 'MS-013', name: 'Schoolyard de-sealing, Rheinau', type: 'desealing', status: 'planned', district: 'Rheinau', completed: null, target: '2026-08', size: [58, 46, 30], offset: [60, 90], cost: 360000, funding: 2, office: 2, residents: 1900 },
  { id: 'MS-014', name: 'Tree planting, Schönau-Nord', type: 'trees', status: 'progress', district: 'Schönau', completed: null, target: '2025-12', size: [260, 26, -40], offset: [0, 120], cost: 198000, funding: 1, office: 0, trees: 36, residents: 2700 },
  { id: 'MS-015', name: 'Green roof, Diesterweg school', type: 'greenroof', status: 'monitored', district: 'Innenstadt', completed: '2021-10-12', size: [52, 38, 15], offset: [-200, -180], cost: 268000, funding: 2, office: 2, residents: 3300 },
  { id: 'MS-016', name: 'Tram stop de-sealing, Käfertal', type: 'desealing', status: 'monitored', district: 'Käfertal', completed: '2023-04-28', size: [110, 16, 70], offset: [-80, 20], cost: 121000, funding: 3, office: 1, residents: 2100 },
];

const median = (v) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

function effectFor(seed, heat, rand) {
  const fx = TYPE_EFFECT[seed.type];
  const done = Number(seed.completed.slice(0, 4)) + (Number(seed.completed.slice(5, 7)) - 0.5) / 12;
  const base = round1(32.6 + heat * 4.2 + rand() * 1.2);
  const ctrl = base - 0.2 + rand() * 0.4;
  const series = SUMMERS.map((y) => {
    const t = y + 0.6; // mid-July
    const since = t - done;
    const shift = since > 0 ? fx.lst * Math.min(1, since / fx.ramp) * (0.85 + rand() * 0.3) : 0;
    const m = SUMMER_ANOMALY[y] + base + shift + (rand() - 0.5) * (0.7 + fx.noise);
    const c = SUMMER_ANOMALY[y] + ctrl + (rand() - 0.5) * 0.7;
    const wm = 0.6 + rand() * 0.4 + fx.noise * 0.5;
    const wc = 0.6 + rand() * 0.4;
    return { year: y, after: since > 0, n: 3 + Math.floor(rand() * 5), m: round1(m), mLo: round1(m - wm), mHi: round1(m + wm), c: round1(c), cLo: round1(c - wc), cHi: round1(c + wc) };
  });
  const before = series.filter((s) => !s.after);
  const after = series.filter((s) => s.after && s.year <= LAST_SUMMER);
  if (after.length < 2) return { series, effect: null };
  const stat = (rows, key) => {
    const v = rows.map((r) => r[key]);
    const med = median(v);
    const spread = Math.max(0.5, (Math.max(...v) - Math.min(...v)) / 2);
    return { med: round1(med), lo: round1(med - spread), hi: round1(med + spread), n: rows.reduce((s, r) => s + r.n, 0), years: `${rows[0].year}–${rows[rows.length - 1].year}` };
  };
  const lstBefore = stat(before, 'm');
  const lstAfter = stat(after, 'm');
  const didMed = round1(lstAfter.med - lstBefore.med - (median(after.map((r) => r.c)) - median(before.map((r) => r.c))));
  const half = round1(0.75 / Math.sqrt(after.length / 2) + fx.noise * 0.9);
  const width = half * 2;
  return {
    series,
    effect: {
      lstBefore,
      lstAfter,
      sealing: fx.sealing.map((v) => Math.round(v + (rand() - 0.5) * 6)),
      ndvi: fx.ndvi.map((v) => Math.round((v + (rand() - 0.5) * 0.04) * 100) / 100),
      did: { med: didMed, lo: round1(didMed + half), hi: round1(didMed - half) },
      confidence: width <= 1.6 ? 'High' : width <= 2.4 ? 'Medium' : 'Low',
      summersAfter: after.length,
    },
  };
}

export const MEASURES = MEASURE_SEEDS.map((seed, i) => {
  const d = DISTRICTS.find((x) => x.name === seed.district) ?? DISTRICTS[0];
  const rand = rng(500 + i * 7);
  const lat = d.center[1] + seed.offset[1] / 111320;
  const lon = d.center[0] + seed.offset[0] / (111320 * Math.cos((lat * Math.PI) / 180));
  const [w, h, deg] = seed.size;
  const geometry = rectAround([lon, lat], w, h, deg);
  // Control area: same size, ~650 m away in comparable surroundings.
  const control = rectAround([lon + 0.0085, lat - 0.0021], w, h, deg);
  const { series, effect } = seed.completed ? effectFor(seed, d.heat, rand) : { series: null, effect: null };
  return {
    id: seed.id,
    name: seed.name,
    type: seed.type,
    status: seed.status,
    district: seed.district,
    completed: seed.completed,
    target: seed.target ?? null,
    area: Math.round(w * h),
    cost: seed.cost,
    funding: FUNDING_PROGRAMMES[seed.funding],
    office: RESPONSIBLE_OFFICES[seed.office],
    trees: seed.trees ?? 0,
    residents: seed.residents,
    notes: '',
    geometry,
    control,
    series,
    effect,
  };
});

export const USER = { initials: 'MA', name: 'M. Arsalan' };

/*
  MOCK copilot conversation: one question, the agent's plan, its tool calls and the
  answer. Answer parts: plain strings, { b } bold, { em } emphasised probability.
  Confidence: High | Medium | Low.
*/
export const COPILOT = {
  sceneDate: '19 Jul 2022',
  question: 'Which districts have more than 20% of residents aged 65+ living in blocks above 40 °C?',
  plan: ['Select blocks with P(LST > 40 °C) ≥ 0.66', 'Join Zensus 2022 100 m grid (age 65+)', 'Aggregate by district', 'Rank by exposure percentage'],
  estimate: '~20 s · 3.2k blocks',
  tools: [
    { name: 'spatial_sql', detail: 'Filter thermal anomalies > 40 °C' },
    { name: 'zonal_stats', detail: 'Overlaying population grid' },
    { name: 'aggregate', detail: 'Summing exposure per district' },
  ],
  answer: [{ b: 'Neckarstadt-West' }, ' and ', { b: 'Innenstadt' }, ' are very likely (', { em: '≥ 90%' }, ') above the threshold; ', { b: 'Jungbusch' }, ' is likely (66–90%).'],
  rows: [
    { district: 'Neckarstadt-West', share65: 24.2, confidence: 'High' },
    { district: 'Innenstadt', share65: 21.8, confidence: 'High' },
    { district: 'Jungbusch', share65: 20.4, confidence: 'Medium' },
  ],
  sources: 'Zensus 2022 · DWD · Model v2.4',
  suggestions: ['Hottest blocks near schools', 'Compare 2018 vs 2022 sealing'],
};

/*
  MOCK geoprocessing tools until the backend process registry exists (OGC API – Processes:
  each tool's description, inputs and outputs). icon: key into the icon map in
  GeoprocessingPanel. inputs: layer pickers (geometry: which layer kinds fit; optional: may
  stay empty). params: { key, label, type (select | number | text | check | date), options,
  default, unit, min, max, step }. formats: output formats, first = default; ext per format.
*/
export const GP_FORMATS = { cog: { label: 'Cloud-optimised GeoTIFF', ext: 'tif' }, gpkg: { label: 'GeoPackage', ext: 'gpkg' }, parquet: { label: 'GeoParquet', ext: 'parquet' }, geojson: { label: 'GeoJSON', ext: 'geojson' }, csv: { label: 'CSV table', ext: 'csv' } };
export const GP_EXTENTS = [
  { value: 'study', label: 'Study area (Mannheim)' },
  { value: 'view', label: 'Current map view' },
  { value: 'block', label: 'Selected block' },
];
export const GP_TOOLS = [
  {
    id: 'zonal',
    name: 'Zonal Statistics',
    category: 'Analysis',
    icon: 'zonal',
    short: 'Zonal',
    description: 'Summarises a raster inside each zone polygon (e.g. land surface temperature per block) and writes one row per zone.',
    inputs: [
      { key: 'zones', label: 'Zone layer', geometry: ['polygon'], default: 'blocks' },
      { key: 'raster', label: 'Value raster', geometry: ['raster'], default: 'lstRaster' },
    ],
    params: [
      { key: 'stat', label: 'Statistic', type: 'select', options: ['mean', 'median', 'min', 'max', 'p90', 'std'], default: 'median' },
      { key: 'allTouched', label: 'Count cells touching the zone edge', type: 'check', default: false },
      { key: 'minCoverage', label: 'Minimum valid cells', type: 'number', unit: '%', min: 0, max: 100, step: 5, default: 50 },
    ],
    formats: ['parquet', 'gpkg', 'csv'],
  },
  {
    id: 'hvi',
    name: 'Heat Vulnerability Index',
    category: 'Vulnerability',
    icon: 'hvi',
    short: 'HVI',
    description: 'Combines heat exposure, population sensitivity and adaptive capacity into a 0–100 index per zone.',
    inputs: [
      { key: 'zones', label: 'Zone layer', geometry: ['polygon'], default: 'blocks' },
      { key: 'exposure', label: 'Exposure raster', geometry: ['raster'], default: 'lstRaster' },
    ],
    params: [
      { key: 'weighting', label: 'Weighting', type: 'select', options: ['equal', 'expert', 'pca'], default: 'equal' },
      { key: 'wExposure', label: 'Exposure weight', type: 'number', min: 0, max: 1, step: 0.05, default: 0.4 },
      { key: 'wSensitivity', label: 'Sensitivity weight', type: 'number', min: 0, max: 1, step: 0.05, default: 0.35 },
      { key: 'wCapacity', label: 'Capacity weight', type: 'number', min: 0, max: 1, step: 0.05, default: 0.25 },
      { key: 'normalise', label: 'Normalisation', type: 'select', options: ['min-max', 'z-score', 'rank'], default: 'min-max' },
    ],
    formats: ['gpkg', 'parquet', 'geojson'],
  },
  {
    id: 'lst',
    name: 'Land Surface Temp Calc',
    category: 'Climate',
    icon: 'lst',
    short: 'LST',
    description: 'Builds a land surface temperature composite from Landsat 8/9 Collection 2 thermal scenes over a date range.',
    inputs: [{ key: 'mask', label: 'Mask (optional)', geometry: ['polygon'], default: null, optional: true }],
    params: [
      { key: 'from', label: 'From', type: 'date', default: '2025-06-01' },
      { key: 'to', label: 'To', type: 'date', default: '2025-08-31' },
      { key: 'cloud', label: 'Max. cloud cover', type: 'number', unit: '%', min: 0, max: 100, step: 5, default: 20 },
      { key: 'composite', label: 'Composite', type: 'select', options: ['median', 'mean', 'p90'], default: 'median' },
      { key: 'resolution', label: 'Cell size', type: 'select', options: ['30', '100'], unit: 'm', default: '30' },
    ],
    formats: ['cog'],
  },
  {
    id: 'sealing',
    name: 'Urban Sealing Ratio',
    category: 'Infrastructure',
    icon: 'sealing',
    short: 'Sealing',
    description: 'Share of sealed (impervious) surface per zone from Sentinel-2 NDVI and the built-up mask.',
    inputs: [{ key: 'zones', label: 'Zone layer', geometry: ['polygon'], default: 'blocks' }],
    params: [
      { key: 'year', label: 'Year', type: 'select', options: ['2025', '2024', '2023'], default: '2025' },
      { key: 'ndvi', label: 'NDVI threshold', type: 'number', min: 0, max: 1, step: 0.05, default: 0.3 },
      { key: 'water', label: 'Exclude water bodies', type: 'check', default: true },
    ],
    formats: ['gpkg', 'parquet', 'csv'],
  },
  {
    id: 'coldair',
    name: 'Cold Air Corridor Analysis',
    category: 'Climate',
    icon: 'coldair',
    short: 'ColdAir',
    description: 'Finds nocturnal cold-air flow paths from the terrain and surface roughness, and the green areas that feed them.',
    inputs: [
      { key: 'dem', label: 'Terrain (DEM)', geometry: ['dem'], default: 'hillshade' },
      { key: 'sources', label: 'Cold-air sources (optional)', geometry: ['polygon'], default: null, optional: true },
    ],
    params: [
      { key: 'wind', label: 'Prevailing wind', type: 'number', unit: '°', min: 0, max: 359, step: 5, default: 225 },
      { key: 'roughness', label: 'Max. roughness length', type: 'number', unit: 'm', min: 0, max: 2, step: 0.1, default: 0.5 },
      { key: 'width', label: 'Min. corridor width', type: 'number', unit: 'm', min: 10, max: 500, step: 10, default: 50 },
    ],
    formats: ['gpkg', 'geojson', 'cog'],
  },
];

/*
  MOCK jobs. status: running | done | error | queued; durationSec counts up while running;
  progress/total drive the simulated zone loop. Logs: { time, level (INFO|EXEC|ERROR|DONE), msg }.
*/
export const JOBS = [
  {
    id: 'JOB-8842', name: 'Mannheim_Innenstadt_Zonal', tool: 'Zonal Statistics', region: 'Innenstadt', status: 'running', durationSec: 165, started: '14:22:01', progress: 24, total: 48,
    logs: [
      { time: '14:22:01', level: 'INFO', msg: "Initializing GP tool 'Zonal Statistics'" },
      { time: '14:22:02', level: 'INFO', msg: 'Loading input raster LST_MA_2023_08...' },
      { time: '14:22:05', level: 'INFO', msg: 'Validating geometries for zone data...' },
      { time: '14:22:08', level: 'EXEC', msg: 'Processing zone 12/48 (Jungbusch)...' },
      { time: '14:23:45', level: 'EXEC', msg: 'Processing zone 24/48 (Neckarstadt-West)...' },
    ],
  },
  {
    id: 'JOB-8839', name: 'LST_Extraction_V01', tool: 'Land Surface Temp Calc', region: 'Mannheim', status: 'done', durationSec: 732, started: '14:05:44', progress: 1, total: 1,
    logs: [
      { time: '14:05:44', level: 'INFO', msg: "Initializing GP tool 'Land Surface Temp Calc'" },
      { time: '14:05:51', level: 'EXEC', msg: 'Reading Landsat 9 scene LC09_196026_20230812...' },
      { time: '14:17:56', level: 'DONE', msg: 'Output written: LST_MA_2023_08.tif (COG)' },
    ],
  },
  {
    id: 'JOB-8836', name: 'Sealing_Analysis_East', tool: 'Urban Sealing Ratio', region: 'Neckarstadt-Ost', status: 'error', durationSec: 310, started: '13:55:12', progress: 0, total: 1,
    logs: [
      { time: '13:55:12', level: 'INFO', msg: "Initializing GP tool 'Urban Sealing Ratio'" },
      { time: '13:55:20', level: 'EXEC', msg: 'Intersecting parcels with imperviousness grid...' },
      { time: '14:00:22', level: 'ERROR', msg: 'Invalid geometry in input layer (ring self-intersection, feature 1184)' },
    ],
  },
  {
    id: 'JOB-8843', name: 'Vulnerability_Index_City', tool: 'Heat Vulnerability Index', region: 'Baden-Württemberg', status: 'queued', durationSec: 0, started: '14:30:00', progress: 0, total: 48,
    logs: [],
  },
];

/*
  MOCK scenario inputs per block (until LGL parcels and the feasibility layer exist):
  protected = heritage or protected-area flag, parcelArea in m², feasibility 0–100
  (ownership, utilities, cost). Derived from the block id so they never change.
*/
export function scenarioAttrs(b) {
  const rand = rng([...b.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7));
  return {
    protected: rand() < 0.12,
    parcelArea: Math.round((1500 + rand() * 22000) / 100) * 100,
    feasibility: Math.round(25 + rand() * 70),
  };
}

/* MOCK saved scenarios. params: goal desealing | greening | both; area 'all' or a district;
   weights in raw slider points (normalised for display and scoring). */
export const SCENARIOS = [
  {
    id: 'sc-1', name: 'Inner-city heat relief 2030', region: REGION.name, createdBy: USER.name, status: 'Shared',
    params: { goal: 'both', area: 'all', weights: { heat: 35, vulnerable: 25, sealing: 20, green: 15, feasibility: 5 }, excludeProtected: true, minParcel: 500, deseal: 40, canopy: 25 },
  },
  {
    id: 'sc-2', name: 'Innenstadt de-sealing', region: REGION.name, createdBy: 'J. Weber', status: 'Draft',
    params: { goal: 'desealing', area: 'Innenstadt', weights: { heat: 40, vulnerable: 20, sealing: 30, green: 5, feasibility: 5 }, excludeProtected: true, minParcel: 1000, deseal: 50, canopy: 0 },
  },
  {
    id: 'sc-3', name: 'Green corridors Käfertal', region: REGION.name, createdBy: 'S. Becker', status: 'Draft',
    params: { goal: 'greening', area: 'Käfertal', weights: { heat: 25, vulnerable: 25, sealing: 10, green: 30, feasibility: 10 }, excludeProtected: false, minParcel: 500, deseal: 0, canopy: 30 },
  },
];

/*
  MOCK report content (Report Builder) until the reports API renders from the database.
  Headline indicators for the season analysis: median with 90 % interval and confidence.
  Data sources: real dataset names and licences; versions and dates are illustrative.
*/
export const DATA_VERSION = '2025.09-mock';
export const REPORT_INDICATORS = [
  { id: 'lstHot', med: 38.4, lo: 37.6, hi: 39.3, unit: '°C', digits: 1, confidence: 'High' },
  { id: 'uhi', med: 4.1, lo: 3.3, hi: 4.9, unit: 'K', digits: 1, confidence: 'Medium' },
  { id: 'sealedCritical', med: 61, lo: 58, hi: 64, unit: '%', digits: 0, confidence: 'High' },
  { id: 'greenCritical', med: 14, lo: 11, hi: 17, unit: '%', digits: 0, confidence: 'Medium' },
  { id: 'residentsExposed', med: 48200, lo: 41500, hi: 55100, unit: '', digits: 0, confidence: 'Medium' },
  { id: 'heatDays', med: 23, lo: 19, hi: 27, unit: 'd', digits: 0, confidence: 'Low' },
];
export const REPORT_SOURCES = [
  { id: 'landsat', attribution: 'usgs', name: 'Landsat 8/9 Collection 2 Level-2 Surface Temperature', provider: 'USGS', licence: 'Public domain', version: 'C2 L2, scenes Jun–Aug 2025' },
  { id: 'sentinel2', attribution: 'copernicus', name: 'Sentinel-2 L2A (sealing, NDVI)', provider: 'Copernicus / ESA', licence: 'Copernicus open licence', version: 'L2A, 2025' },
  { id: 'dwd', attribution: 'dwd', name: 'DWD station observations (air temperature, heat days)', provider: 'Deutscher Wetterdienst', licence: 'CC BY 4.0', version: 'CDC, 2025' },
  { id: 'zensus', attribution: 'destatis', name: 'Zensus 2022 100 m grid (population, age)', provider: 'Destatis', licence: 'dl-de/by-2-0', version: '2022' },
  { id: 'alkis', attribution: 'lgl', name: 'ALKIS land use and LoD2 buildings', provider: 'LGL Baden-Württemberg', licence: 'dl-de/by-2-0', version: '2025' },
  { id: 'osm', attribution: 'osm', name: 'OpenStreetMap (basemap, facilities)', provider: 'OpenStreetMap contributors', licence: 'ODbL', version: '2025-08' },
];

/*
  MOCK public Heat Portal content (until the cool-places register and per-cell confidence
  come from the API; the DWD heat warning card is live: /api/portal/warning). Place names
  are real Mannheim places; positions are approximate and opening hours illustrative.
*/
// kind: park | shade | water | coolroom. hours: null = always open. note: fee | aircon (translated).
export const COOL_PLACES = [
  { id: 'cp-01', kind: 'park', name: 'Luisenpark', center: [8.4945, 49.4835], hours: '09:00–21:00', note: 'fee', shade: true, water: true, seats: true },
  { id: 'cp-02', kind: 'park', name: 'Herzogenriedpark', center: [8.48, 49.505], hours: '09:00–20:00', note: 'fee', shade: true, water: true, seats: true },
  { id: 'cp-03', kind: 'water', name: 'Wasserspiele Friedrichsplatz', center: [8.4757, 49.4842], hours: null, shade: true, water: true, seats: true },
  { id: 'cp-04', kind: 'park', name: 'Schlosspark und Rheinufer', center: [8.459, 49.483], hours: null, shade: true, water: false, seats: true },
  { id: 'cp-05', kind: 'park', name: 'Waldpark Lindenhof', center: [8.456, 49.464], hours: null, shade: true, water: true, seats: true },
  { id: 'cp-06', kind: 'park', name: 'Neckarwiese', center: [8.4805, 49.4968], hours: null, shade: false, water: true, seats: true },
  { id: 'cp-07', kind: 'water', name: 'Brunnen Paradeplatz', center: [8.4662, 49.4872], hours: null, shade: true, water: true, seats: true },
  { id: 'cp-08', kind: 'coolroom', name: 'Stadtbibliothek Zentralbibliothek', center: [8.4674, 49.488], hours: '10:00–19:00', note: 'aircon', shade: true, water: true, seats: true },
  { id: 'cp-09', kind: 'coolroom', name: 'Jesuitenkirche', center: [8.4626, 49.4856], hours: '08:00–18:00', shade: true, water: false, seats: true },
  { id: 'cp-10', kind: 'coolroom', name: 'Reiss-Engelhorn-Museen', center: [8.4618, 49.4893], hours: '11:00–18:00', note: 'fee', shade: true, water: true, seats: true },
  { id: 'cp-11', kind: 'shade', name: 'Toulonplatz', center: [8.478, 49.4792], hours: null, shade: true, water: false, seats: true },
  { id: 'cp-12', kind: 'water', name: 'Wasserspiel Alter Meßplatz', center: [8.4718, 49.4983], hours: null, shade: false, water: true, seats: true },
  { id: 'cp-13', kind: 'park', name: 'Käfertaler Wald', center: [8.535, 49.515], hours: null, shade: true, water: false, seats: false },
  { id: 'cp-14', kind: 'water', name: 'Strandbad Neckarau', center: [8.457, 49.4535], hours: '10:00–20:00', note: 'fee', shade: true, water: true, seats: true },
  { id: 'cp-15', kind: 'coolroom', name: 'Herschelbad', center: [8.4703, 49.4902], hours: '07:00–21:00', note: 'fee', shade: true, water: true, seats: true },
];

/** MOCK confidence (0–1) of a surface-grid cell: lower towards the edges (fewer cloud-free scenes). */
export function cellConfidence(id, center) {
  const rand = rng([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 3));
  const edge = Math.min(1, Math.hypot((center[0] - 8.49) / 0.09, (center[1] - 49.49) / 0.065));
  return Math.max(0.2, Math.min(1, 1.05 - edge * 0.55 - rand() * 0.35));
}

/*
  MOCK admin & operations data (until the ops API reads the scheduler, STAC, Keycloak and
  the audit table). Times are ISO strings around the MOCK "now" ADMIN_NOW; durations in
  seconds. Pipeline status: ok | running | failed | paused. Dataset names are real.
*/
export const ADMIN_NOW = '2025-09-01T09:00:00';
// Full ISO (UTC) so the console reads every time the same way in any time zone.
const at = (h) => new Date(new Date(ADMIN_NOW).getTime() + h * 3600e3).toISOString();

export const PIPELINES = [
  { id: 'landsat', attribution: 'usgs', name: 'Landsat 8/9 ST (Collection 2 L2)', source: 'USGS M2M API', schedule: 'Daily 04:00', lastRun: at(-5), nextRun: at(19), status: 'ok', records: 18, duration: 1260 },
  { id: 'sentinel2', attribution: 'copernicus', name: 'Sentinel-2 L2A', source: 'Copernicus Data Space', schedule: 'Daily 03:00', lastRun: at(-6), nextRun: at(18), status: 'ok', records: 46, duration: 2140 },
  { id: 'sentinel3', attribution: 'copernicus', name: 'Sentinel-3 SLSTR LST', source: 'Copernicus Data Space', schedule: 'Every 6 h', lastRun: at(-0.4), nextRun: at(5.6), status: 'running', records: 0, duration: 380 },
  { id: 'dwd', attribution: 'dwd', name: 'DWD station observations', source: 'DWD Open Data (CDC)', schedule: 'Hourly', lastRun: at(-1), nextRun: at(0), status: 'failed', records: 0, duration: 41 },
  { id: 'zensus', attribution: 'destatis', name: 'Zensus 2022 100 m grid', source: 'Destatis', schedule: 'Manual', lastRun: '2025-06-12T10:15', nextRun: null, status: 'ok', records: 31842, duration: 920 },
  { id: 'lod2', attribution: 'lgl', name: 'LGL LoD2 buildings', source: 'LGL Baden-Württemberg', schedule: 'Monthly, 1st 02:00', lastRun: at(-7), nextRun: '2025-10-01T02:00', status: 'paused', records: 2194, duration: 3310 },
];

/** MOCK run history per pipeline: 14 runs, newest last. */
export const PIPELINE_RUNS = Object.fromEntries(
  PIPELINES.map((p, k) => {
    const rand = rng(101 + k);
    const runs = Array.from({ length: 14 }, (_, i) => {
      const failed = (p.id === 'dwd' && (i === 13 || i === 9)) || rand() < 0.06;
      return {
        id: `${p.id}-${i + 1}`,
        start: at(-(14 - i) * (p.id === 'dwd' ? 1 : p.id === 'sentinel3' ? 6 : 24)),
        duration: Math.round(p.duration * (0.7 + rand() * 0.6)) || 60,
        records: failed ? 0 : Math.round((p.records || 20) * (0.6 + rand() * 0.8)),
        status: failed ? 'failed' : 'ok',
      };
    });
    return [p.id, runs];
  }),
);

export const ADMIN_ALERTS = [
  { id: 'al-1', severity: 'critical', time: at(-1), source: 'DWD station observations', message: 'Ingestion failed: HTTP 503 from opendata.dwd.de (3 retries).' },
  { id: 'al-2', severity: 'warning', time: at(-3.5), source: 'Landsat 8/9 ST', message: 'Cloud cover above 60 % on 2 of 3 new scenes; LST composite unchanged.' },
  { id: 'al-3', severity: 'warning', time: at(-8), source: 'object storage', message: 'Bucket heatscape-cogs at 81 % of quota.' },
  { id: 'al-4', severity: 'info', time: at(-20), source: 'Regions', message: 'Karlsruhe: validation step started (indicator checks 4 of 6).' },
];

export const ADMIN_KPIS = { datasets: 42, latestIngestion: at(-5), latestSource: 'Landsat 8/9 ST', runningJobs: 2, failed24h: 1, activeUsers7d: 38, copilot7d: 214 };

// STAC collections: bbox [west, south, east, north]; temporal [start, end|null].
export const STAC_COLLECTIONS = [
  { id: 'landsat-c2-l2-st', attribution: 'usgs', title: 'Landsat 8/9 Surface Temperature', items: 1284, temporal: ['2013-04-11', null], bbox: [7.5, 47.5, 10.5, 49.8], licence: 'Public domain', version: 'C2 L2' },
  { id: 'sentinel-2-l2a', attribution: 'copernicus', title: 'Sentinel-2 L2A', items: 6412, temporal: ['2017-03-28', null], bbox: [7.5, 47.5, 10.5, 49.8], licence: 'Copernicus open licence', version: '05.10' },
  { id: 'sentinel-3-slstr-lst', attribution: 'copernicus', title: 'Sentinel-3 SLSTR LST', items: 3920, temporal: ['2018-10-01', null], bbox: [5.8, 47.2, 15.1, 55.1], licence: 'Copernicus open licence', version: '004' },
  { id: 'heatscape-lst-composite', attribution: 'heatscape', title: 'Heatscape summer LST composites', items: 36, temporal: ['2014-06-01', '2025-08-31'], bbox: [8.39, 49.4, 8.6, 49.59], licence: 'CC BY 4.0', version: '2025.09' },
  { id: 'heatscape-sealing', attribution: 'heatscape', title: 'Heatscape sealing degree (10 m)', items: 9, temporal: ['2017-01-01', '2025-01-01'], bbox: [8.39, 49.4, 8.6, 49.59], licence: 'CC BY 4.0', version: '2025.02' },
  { id: 'lgl-lod2', attribution: 'lgl', title: 'LGL LoD2 buildings', items: 48, temporal: ['2024-01-01', null], bbox: [8.3, 49.0, 8.75, 49.6], licence: 'dl-de/by-2-0', version: '2025-08' },
];

// Regions in onboarding order; steps: aoi, sources, indicators, validation, publish.
export const ADMIN_REGIONS = [
  { id: 'mannheim', name: 'Mannheim', state: 'active', progress: 100, steps: { aoi: true, sources: true, indicators: true, validation: true, publish: true }, blocks: 128, users: 31 },
  { id: 'karlsruhe', name: 'Karlsruhe', state: 'transfer', progress: 70, steps: { aoi: true, sources: true, indicators: true, validation: false, publish: false }, blocks: 141, users: 6 },
  { id: 'stuttgart', name: 'Stuttgart', state: 'planned', progress: 20, steps: { aoi: true, sources: false, indicators: false, validation: false, publish: false }, blocks: 0, users: 2 },
];

export const ADMIN_ROLES = ['public', 'planner', 'partner', 'expert', 'admin'];
// Permission → roles that hold it.
export const ROLE_PERMISSIONS = [
  { id: 'viewPortal', roles: ['public', 'planner', 'partner', 'expert', 'admin'] },
  { id: 'viewWorkspace', roles: ['planner', 'partner', 'expert', 'admin'] },
  { id: 'restrictedData', roles: ['partner', 'expert', 'admin'] },
  { id: 'scenarios', roles: ['planner', 'expert', 'admin'] },
  { id: 'measures', roles: ['planner', 'admin'] },
  { id: 'reports', roles: ['planner', 'expert', 'admin'] },
  { id: 'geoprocessing', roles: ['expert', 'admin'] },
  { id: 'copilot', roles: ['planner', 'expert', 'admin'] },
  { id: 'pipelines', roles: ['admin'] },
  { id: 'users', roles: ['admin'] },
];

export const ADMIN_USERS = [
  { id: 'u-01', name: 'M. Arsalan', email: 'm.arsalan@heatscape.example', role: 'admin', org: 'HEATSCAPE-BW', regions: ['Mannheim', 'Karlsruhe', 'Stuttgart'], lastActive: at(-0.1) },
  { id: 'u-02', name: 'J. Weber', email: 'j.weber@mannheim.example', role: 'planner', org: 'Stadt Mannheim, FB Klima', regions: ['Mannheim'], lastActive: at(-2) },
  { id: 'u-03', name: 'S. Becker', email: 's.becker@mannheim.example', role: 'planner', org: 'Stadt Mannheim, Stadtplanung', regions: ['Mannheim'], lastActive: at(-26) },
  { id: 'u-04', name: 'A. Yilmaz', email: 'a.yilmaz@mannheim.example', role: 'planner', org: 'Stadt Mannheim, Gesundheitsamt', regions: ['Mannheim'], lastActive: at(-5) },
  { id: 'u-05', name: 'K. Hoffmann', email: 'k.hoffmann@vrrn.example', role: 'partner', org: 'Verband Region Rhein-Neckar', regions: ['Mannheim'], lastActive: at(-50) },
  { id: 'u-06', name: 'L. Schmidt', email: 'l.schmidt@karlsruhe.example', role: 'planner', org: 'Stadt Karlsruhe, Umweltamt', regions: ['Karlsruhe'], lastActive: at(-8) },
  { id: 'u-07', name: 'P. Novak', email: 'p.novak@kit.example', role: 'expert', org: 'KIT, IMK', regions: ['Mannheim', 'Karlsruhe'], lastActive: at(-1.5) },
  { id: 'u-08', name: 'R. Klein', email: 'r.klein@dwd.example', role: 'partner', org: 'DWD, Regionales Klimabüro', regions: ['Mannheim', 'Karlsruhe'], lastActive: at(-120) },
  { id: 'u-09', name: 'T. Braun', email: 't.braun@consult.example', role: 'expert', org: 'Braun Umweltplanung', regions: ['Mannheim'], lastActive: at(-30) },
  { id: 'u-10', name: 'E. Fischer', email: 'e.fischer@stuttgart.example', role: 'planner', org: 'Stadt Stuttgart, Amt für Umweltschutz', regions: ['Stuttgart'], lastActive: at(-72) },
  { id: 'u-11', name: 'N. Wagner', email: 'n.wagner@mannheim.example', role: 'planner', org: 'Stadt Mannheim, Grünflächen', regions: ['Mannheim'], lastActive: at(-4) },
  { id: 'u-12', name: 'Public (anonymous)', email: '—', role: 'public', org: 'Heat Portal', regions: ['Mannheim'], lastActive: at(-0.05) },
];

/** MOCK copilot usage, last 14 days: queries, cost (EUR), failed tool calls per day. */
export const COPILOT_DAILY = (() => {
  const rand = rng(77);
  return Array.from({ length: 14 }, (_, i) => {
    const day = new Date(new Date(ADMIN_NOW).getTime() - (13 - i) * 864e5).toISOString().slice(0, 10);
    const weekend = [0, 6].includes(new Date(day).getDay());
    const queries = Math.round((weekend ? 6 : 28) + rand() * (weekend ? 6 : 18));
    return { day, queries, cost: +(queries * (0.018 + rand() * 0.01)).toFixed(2), failed: Math.round(rand() * 2.4) };
  });
})();
export const COPILOT_TOP_QUESTIONS = [
  { q: 'Which districts have the most residents over 65 in critical heat blocks?', n: 31 },
  { q: 'Compare summer LST 2024 vs 2025 for Neckarstadt-West', n: 22 },
  { q: 'Where would de-sealing schoolyards give the most cooling?', n: 18 },
  { q: 'Show hospitals within 500 m of a high heat block', n: 14 },
  { q: 'Summarise the effect of measures completed in 2023', n: 11 },
];
export const COPILOT_FAILED_CALLS = [
  { id: 'fc-1', time: at(-2.2), tool: 'run_sql', error: 'statement timeout (5 s) on lst_block_daily', user: 'P. Novak' },
  { id: 'fc-2', time: at(-27), tool: 'get_dwd_warnings', error: 'upstream 503 (DWD CAP feed)', user: 'J. Weber' },
  { id: 'fc-3', time: at(-49), tool: 'run_process', error: 'process "zonal_stats" input out of region bounds', user: 'T. Braun' },
];
export const COPILOT_EVAL = { passRate: 0.924, cases: 118, runs: [0.88, 0.9, 0.89, 0.91, 0.9, 0.92, 0.915, 0.924] };

// Services: built = deployed in docker-compose today (health checked live through the gateway;
// post: body for services checked with a tiny real request); others planned.
export const ADMIN_SERVICES = [
  { id: 'web', name: 'web (frontend)', built: true, check: '/', version: '0.1.0' },
  { id: 'bff', name: 'bff (middleware)', built: true, check: '/healthz', version: '0.1.0' },
  { id: 'api', name: 'api (backend)', built: true, check: '/api/health', version: '0.1.0' },
  { id: 'db', name: 'db (PostGIS)', built: true, check: '/api/health/db', version: 'PostgreSQL 17' },
  { id: 'translate', name: 'translate (LibreTranslate)', built: true, check: '/api/translate', post: { text: 'ok', source: 'en', target: 'de', format: 'text' }, version: '1.6' },
  { id: 'auth', name: 'auth (Keycloak)', built: false },
  { id: 'workers', name: 'workers (Celery)', built: false },
  { id: 'titiler', name: 'titiler (raster tiles)', built: false },
  { id: 'stac', name: 'stac (pgstac)', built: false },
  { id: 'redis', name: 'redis', built: false },
  { id: 'storage', name: 'object storage', built: false },
];

export const AUDIT_LOG = [
  { id: 'a-01', time: at(-0.2), user: 'M. Arsalan', action: 'pipeline.run', target: 'Sentinel-3 SLSTR LST', result: 'ok' },
  { id: 'a-02', time: at(-1), user: 'system', action: 'pipeline.fail', target: 'DWD station observations', result: 'error' },
  { id: 'a-03', time: at(-2), user: 'J. Weber', action: 'report.export', target: 'Heat action plan: evidence base (PDF)', result: 'ok' },
  { id: 'a-04', time: at(-3), user: 'A. Yilmaz', action: 'measure.status', target: 'MS-003 Tree planting, Schönau-Nord → In progress', result: 'ok' },
  { id: 'a-05', time: at(-5), user: 'system', action: 'pipeline.run', target: 'Landsat 8/9 ST', result: 'ok' },
  { id: 'a-06', time: at(-7), user: 'M. Arsalan', action: 'pipeline.pause', target: 'LGL LoD2 buildings', result: 'ok' },
  { id: 'a-07', time: at(-9), user: 'P. Novak', action: 'copilot.query', target: 'Compare summer LST 2024 vs 2025', result: 'ok' },
  { id: 'a-08', time: at(-11), user: 'S. Becker', action: 'scenario.share', target: 'Green corridors Käfertal', result: 'ok' },
  { id: 'a-09', time: at(-20), user: 'M. Arsalan', action: 'region.update', target: 'Karlsruhe: indicators configured', result: 'ok' },
  { id: 'a-10', time: at(-26), user: 'unknown', action: 'auth.login', target: 'admin console', result: 'denied' },
  { id: 'a-11', time: at(-30), user: 'M. Arsalan', action: 'user.role', target: 'T. Braun → Expert', result: 'ok' },
  { id: 'a-12', time: at(-48), user: 'L. Schmidt', action: 'auth.login', target: 'workspace', result: 'ok' },
  { id: 'a-13', time: at(-50), user: 'K. Hoffmann', action: 'data.download', target: 'heatscape-lst-composite 2025 (COG)', result: 'ok' },
  { id: 'a-14', time: at(-72), user: 'M. Arsalan', action: 'user.invite', target: 'e.fischer@stuttgart.example (Planner)', result: 'ok' },
];

/** MOCK log lines for the admin dock; level: info | warn | error. */
export const ADMIN_LOGS = [
  { time: at(-1.02), level: 'info', source: 'dwd', message: 'GET https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/10_minutes/air_temperature/now/' },
  { time: at(-1.01), level: 'warn', source: 'dwd', message: 'HTTP 503, retry 1/3 in 30 s' },
  { time: at(-1.0), level: 'error', source: 'dwd', message: 'HTTP 503 after 3 retries; run marked failed' },
  { time: at(-0.4), level: 'info', source: 'sentinel3', message: 'Search STAC sentinel-3-slstr-lst bbox=BW datetime=last 6 h: 4 items' },
  { time: at(-0.35), level: 'info', source: 'sentinel3', message: 'Download S3B_SL_2_LST____20250901T0812 (1 of 4)' },
  { time: at(-0.2), level: 'info', source: 'api', message: 'POST /api/translate 200 412 ms' },
  { time: at(-0.1), level: 'info', source: 'bff', message: 'GET /api/health 200 3 ms' },
];

/*
  MOCK API tokens of the signed-in user (account settings), until the account service
  issues real ones. Only a prefix is kept; the full token is shown once at creation.
*/
export const API_TOKENS = [
  { id: 'tok-1', name: 'QGIS plugin', prefix: 'hs_q7Lm', scope: 'read', createdAt: '2025-06-12T10:20:00Z', lastUsed: '2025-08-31T16:05:00Z', expiresAt: '2026-06-12T10:20:00Z' },
  { id: 'tok-2', name: 'Nightly export script', prefix: 'hs_Z2cv', scope: 'write', createdAt: '2025-07-03T08:00:00Z', lastUsed: '2025-09-01T02:00:00Z', expiresAt: '2025-10-01T08:00:00Z' },
  { id: 'tok-3', name: 'Notebook analysis', prefix: 'hs_8Rta', scope: 'read', createdAt: '2025-08-20T14:45:00Z', lastUsed: null, expiresAt: '2025-11-18T14:45:00Z' },
];
