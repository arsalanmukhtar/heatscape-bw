import { create } from 'zustand';
import { getLive } from '../lib/api';

/*
  Live layers from the backend (imported by the worker): map layer id → API path. data holds
  each layer's GeoJSON (or, for RASTERS, its grid: bounds, cols, rows, values) once loaded;
  status is idle | loading | ok | empty | error. empty = the API answered with no data (the worker
  has not imported it yet): it is fetched again every RETRY_MS until data arrive. Small layers load at start; LAZY (large) layers load the first
  time they are shown, tabled, zoomed to or styled (ensure). Weather stations reload every
  RELOAD interval (latest temperature).
  TILED layers (admin units) draw from vector tiles: data holds their attributes (a point
  inside each unit and its bbox, no boundary) and the tile version; shapes holds the whole
  geometry of single units fetched for the highlight (loadShape).
*/
export const LIVE_LAYERS = {
  hospitals: '/layers/hospitals',
  water: '/layers/water',
  dwdStations: '/layers/dwd-stations',
  population: '/layers/zensus',
  adminLand: '/layers/admin-land/attributes',
  adminRbz: '/layers/admin-rbz/attributes',
  adminKrs: '/layers/admin-krs/attributes',
  adminVwg: '/layers/admin-vwg/attributes',
  adminGem: '/layers/admin-gem/attributes',
  adminOsm9: '/layers/admin-osm9/attributes',
  adminOsm10: '/layers/admin-osm10/attributes',
  surfaceTemp: '/heat/surface-temp',
  airTemp: '/heat/air-temp',
  airIsotherms: '/heat/air-temp/isotherms',
  lstRaster: '/heat/lst',
  hazardRaster: '/heat/hazard',
};
const RASTERS = new Set(['lstRaster', 'hazardRaster']);
/** Map layer id → API layer name of the layers drawn from vector tiles. */
export const TILED = { adminLand: 'admin-land', adminRbz: 'admin-rbz', adminKrs: 'admin-krs', adminVwg: 'admin-vwg', adminGem: 'admin-gem', adminOsm9: 'admin-osm9', adminOsm10: 'admin-osm10' };
const LAZY = new Set(['population', 'adminVwg', 'adminGem', 'lstRaster', 'hazardRaster']);
export const EMPTY_FC = { type: 'FeatureCollection', features: [] };
// A raster before its data arrive: no cells (drawn as nothing).
const EMPTY_RASTER = { bounds: [8.41, 49.4, 8.59, 49.59], cols: 0, rows: 0, values: [], unit: '' };
const RELOAD = { dwdStations: 10 * 60 * 1000 };
const RETRY_MS = 60 * 1000;
const retrying = new Set();

const shapeKey = (id, featureId) => `${id}|${featureId}`;
const shapesLoading = new Set();

export const useLive = create()((set, get) => ({
  data: {},
  status: {},
  error: {},
  shapes: {},
  /** Fetches the whole geometry of one unit of a tiled layer (once; failures are retried on the next call). */
  loadShape: async (id, featureId) => {
    const key = shapeKey(id, featureId);
    if (!TILED[id] || featureId == null || get().shapes[key] || shapesLoading.has(key)) return;
    shapesLoading.add(key);
    try {
      const f = await getLive(`/layers/${TILED[id]}/features/${encodeURIComponent(featureId)}`);
      set({ shapes: { ...get().shapes, [key]: f.geometry } });
    } catch {
      // Not found or offline: no highlight; the next call tries again.
    } finally {
      shapesLoading.delete(key);
    }
  },
  load: async (id) => {
    if (get().status[id] === 'loading') return;
    set({ status: { ...get().status, [id]: 'loading' } });
    try {
      const fc = await getLive(LIVE_LAYERS[id]);
      const empty = RASTERS.has(id) ? !fc.values?.length : !fc.features?.length;
      set({ data: { ...get().data, [id]: fc }, status: { ...get().status, [id]: empty ? 'empty' : 'ok' }, error: { ...get().error, [id]: null } });
      if (empty) get().retry(id);
    } catch (e) {
      set({ status: { ...get().status, [id]: 'error' }, error: { ...get().error, [id]: e.message } });
      get().retry(id);
    }
  },
  /** Fetches an empty or failed layer again after RETRY_MS (one pending retry per layer). */
  retry: (id) => {
    if (retrying.has(id)) return;
    retrying.add(id);
    setTimeout(() => {
      retrying.delete(id);
      if (get().status[id] !== 'ok') get().load(id);
    }, RETRY_MS);
  },
  /** Loads a live layer unless it is loaded or loading; resolves when it is there (or failed). */
  ensure: async (id) => {
    if (!LIVE_LAYERS[id] || get().status[id] === 'ok') return;
    if (get().status[id] === 'loading') {
      await new Promise((resolve) => {
        const stop = useLive.subscribe((s) => {
          if (s.status[id] !== 'loading') {
            stop();
            resolve();
          }
        });
      });
      return;
    }
    await get().load(id);
  },
  /** Loads the eager live layers and keeps the frequently changing ones fresh; returns a stop function. */
  start: () => {
    Object.keys(LIVE_LAYERS)
      .filter((id) => !LAZY.has(id))
      .forEach((id) => get().load(id));
    const timers = Object.entries(RELOAD).map(([id, ms]) => setInterval(() => get().load(id), ms));
    return () => timers.forEach(clearInterval);
  },
}));

/** Whole geometry of a unit of a tiled layer once loadShape fetched it, else null. */
export const liveShape = (id, featureId) => useLive.getState().shapes[shapeKey(id, featureId)] ?? null;

/** Tile URL template of a tiled layer, versioned by its import (absolute: Mapbox needs it). */
export const tileUrl = (id) => `${window.location.origin}/api/layers/${TILED[id]}/tiles/{z}/{x}/{y}.mvt?v=${useLive.getState().data[id]?.version ?? ''}`;

/** GeoJSON of a live layer (empty until loaded), for lib/layers.js getData. */
export const liveData = (id) => useLive.getState().data[id] ?? EMPTY_FC;
// Classes of the heat hazard raster (backend /heat/hazard: quintiles of the summer LST), known
// before the data arrive so its default style has them.
const EMPTY_HAZARD = {
  ...EMPTY_RASTER,
  classes: ['Very low', 'Low', 'Moderate', 'High', 'Very high'].map((label, i) => ({ value: i + 1, label })),
};
/** Grid of a live raster layer (no cells until loaded), for lib/layers.js raster. */
export const liveRaster = (id) => useLive.getState().data[id] ?? (id === 'hazardRaster' ? EMPTY_HAZARD : EMPTY_RASTER);
