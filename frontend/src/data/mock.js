/*
  MOCK DATA. Illustrative values for UI development only: none of these numbers are
  measurements or model output. Replace with API data once the backend exists.

  Block: { id, district, avgTemp, peakTemp (season °C), lstDay (heat-day °C), sealing %,
           greenCover %, popDensity (per km²), risk, vulnerability (0–100),
           center [lon, lat], weekly: { block[4], city[4] } (July, weeks 1–4) }
*/
import { distanceKm } from '../lib/css';

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

// capacity: hospital beds, or pumped water in m³/h.
export const FACILITIES = [
  { id: 'H-01', name: 'St. Vincent Hospital', kind: 'hospital', capacity: 420, position: [8.4895, 49.4985] },
  { id: 'H-02', name: 'Klinikum Süd', kind: 'hospital', capacity: 860, position: [8.4705, 49.4555] },
  { id: 'H-03', name: 'Klinik Käfertal', kind: 'hospital', capacity: 240, position: [8.5205, 49.5155] },
  { id: 'W-04', name: 'Pump Station 4', kind: 'water', capacity: 1800, position: [8.4605, 49.5057] },
  { id: 'W-02', name: 'Pump Station 2', kind: 'water', capacity: 1250, position: [8.5505, 49.4705] },
  { id: 'W-07', name: 'Pump Station 7', kind: 'water', capacity: 950, position: [8.4405, 49.5355] },
];

/** Nearest hospital and nearest water facility to a block. */
export function atRiskFacilities(b) {
  return ['hospital', 'water'].map(
    (kind) =>
      FACILITIES.filter((f) => f.kind === kind)
        .map((f) => ({ ...f, km: distanceKm(b.center, f.position) }))
        .sort((x, y) => x.km - y.km)[0],
  );
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

/* MOCK geoprocessing tools until the backend process registry exists. icon: key into
   the icon map in GeoprocessingPanel. */
export const GP_TOOLS = [
  { id: 'zonal', name: 'Zonal Statistics', category: 'Analysis', icon: 'zonal', short: 'Zonal' },
  { id: 'hvi', name: 'Heat Vulnerability Index', category: 'Vulnerability', icon: 'hvi', short: 'HVI' },
  { id: 'lst', name: 'Land Surface Temp Calc', category: 'Climate', icon: 'lst', short: 'LST' },
  { id: 'sealing', name: 'Urban Sealing Ratio', category: 'Infrastructure', icon: 'sealing', short: 'Sealing' },
  { id: 'coldair', name: 'Cold Air Corridor Analysis', category: 'Climate', icon: 'coldair', short: 'ColdAir' },
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
