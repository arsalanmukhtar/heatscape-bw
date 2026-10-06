import { create } from 'zustand';
import { getLayer } from '../lib/api';

/*
  Live open-data layers from the backend (imported by the worker): map layer id → API layer.
  data holds each layer's GeoJSON once loaded (an empty collection until then); status is
  idle | loading | ok | empty | error. empty = the API answered with no features (the worker
  has not imported it yet): it is fetched again every RETRY_MS until data arrive. Small layers load at start; LAZY (large) layers load the first
  time they are shown, tabled, zoomed to or styled (ensure). Weather stations reload every
  RELOAD interval (latest temperature).
*/
export const LIVE_LAYERS = {
  hospitals: 'hospitals',
  water: 'water',
  dwdStations: 'dwd-stations',
  population: 'zensus',
  adminLand: 'admin-land',
  adminRbz: 'admin-rbz',
  adminKrs: 'admin-krs',
  adminVwg: 'admin-vwg',
  adminGem: 'admin-gem',
  adminOsm9: 'admin-osm9',
  adminOsm10: 'admin-osm10',
};
const LAZY = new Set(['population', 'adminVwg', 'adminGem']);
export const EMPTY_FC = { type: 'FeatureCollection', features: [] };
const RELOAD = { dwdStations: 10 * 60 * 1000 };
const RETRY_MS = 60 * 1000;
const retrying = new Set();

export const useLive = create()((set, get) => ({
  data: {},
  status: {},
  error: {},
  load: async (id) => {
    if (get().status[id] === 'loading') return;
    set({ status: { ...get().status, [id]: 'loading' } });
    try {
      const fc = await getLayer(LIVE_LAYERS[id]);
      const empty = !fc.features?.length;
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

/** GeoJSON of a live layer (empty until loaded), for lib/layers.js getData. */
export const liveData = (id) => useLive.getState().data[id] ?? EMPTY_FC;
