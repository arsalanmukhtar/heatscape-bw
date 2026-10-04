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

export const FACILITIES = [
  { name: 'St. Vincent Hospital', kind: 'hospital', position: [8.4895, 49.4985] },
  { name: 'Klinikum Süd', kind: 'hospital', position: [8.4705, 49.4555] },
  { name: 'Klinik Käfertal', kind: 'hospital', position: [8.5205, 49.5155] },
  { name: 'Pump Station 4', kind: 'water', position: [8.4605, 49.5057] },
  { name: 'Pump Station 2', kind: 'water', position: [8.5505, 49.4705] },
  { name: 'Pump Station 7', kind: 'water', position: [8.4405, 49.5355] },
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

function grid(scale, offset, seed) {
  const rand = rng(seed);
  const features = [];
  const dLon = GRID.dLon * scale;
  const dLat = GRID.dLat * scale;
  for (let lon = GRID.west; lon < GRID.east; lon += dLon) {
    for (let lat = GRID.south; lat < GRID.north; lat += dLat) {
      const t = round1(heatAt(lon + dLon / 2, lat + dLat / 2, (rand() - 0.5) * (scale > 1 ? 0.6 : 2.2)) + offset);
      features.push({
        type: 'Feature',
        properties: { t },
        geometry: {
          type: 'Polygon',
          coordinates: [[[lon, lat], [lon + dLon, lat], [lon + dLon, lat + dLat], [lon, lat + dLat], [lon, lat]]],
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

export const SURFACE_GRID = grid(1, 0, 7);
export const AIR_GRID = grid(4, -3.5, 11);

/** Sealing points on a ~500 m grid, sized by sealed share. */
export const SEALING_POINTS = (() => {
  const rand = rng(19);
  const features = [];
  for (let lon = GRID.west; lon < GRID.east; lon += GRID.dLon * 2) {
    for (let lat = GRID.south; lat < GRID.north; lat += GRID.dLat * 2) {
      const heat = (heatAt(lon, lat, 0) - 26) / 17;
      features.push({
        type: 'Feature',
        properties: { sealing: Math.round(Math.max(5, Math.min(95, heat * 95 + (rand() - 0.5) * 20))) },
        geometry: { type: 'Point', coordinates: [lon + GRID.dLon, lat + GRID.dLat] },
      });
    }
  }
  return { type: 'FeatureCollection', features };
})();
