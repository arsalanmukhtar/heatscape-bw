import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MANNHEIM_DISTRICTS, MEASURES } from '../data/mock';
import { distanceKm } from '../lib/css';
import { areaM2, centroid, effectValue } from '../lib/measures';
import { matchesSearch } from '../lib/search';

/*
  Measures register. The MOCK register plus measures added in the form (saved in this
  browser until the measures API exists; uploaded files are kept for the session only).
  New measures have no effect estimate yet ("awaiting data"). Status changes are kept as
  an append-only, timestamped trail per measure (statusLog), never by overwriting.
*/
const EMPTY_FILTERS = { type: '', status: '', district: '', year: '' };

export const emptyDraft = () => ({
  name: '',
  type: 'desealing',
  status: 'planned',
  completed: '',
  area: 0,
  cost: 0,
  funding: '',
  office: '',
  notes: '',
  geometry: null,
  vertices: [], // corners while drawing or editing (open ring)
  source: 'draw', // draw | upload
  files: [], // { name, size } (session only)
});

const isDone = (status) => status === 'completed' || status === 'monitored';

/** A measure with its status trail applied: the latest event sets status and dates. */
function withStatusLog(m, events) {
  if (!events?.length) return { ...m, history: [] };
  const last = events[events.length - 1];
  const done = isDone(last.to);
  return {
    ...m,
    history: events,
    status: last.to,
    completed: done ? (last.completed ?? m.completed) : null,
    target: done ? null : m.target,
    // Effects exist only for finished measures.
    ...(done ? {} : { effect: null, series: null }),
  };
}

let cacheKey = [null, null];
let allCache = null;
/** MOCK register + added measures, status trail applied (stable array while nothing changes). */
export function allMeasures(added, statusLog = {}) {
  if (added !== cacheKey[0] || statusLog !== cacheKey[1]) {
    cacheKey = [added, statusLog];
    allCache = [...MEASURES, ...added].map((m) => withStatusLog(m, statusLog[m.id]));
  }
  return allCache;
}

const SORTS = {
  newest: (a, b) => (b.completed ?? b.target ?? '').localeCompare(a.completed ?? a.target ?? ''),
  oldest: (a, b) => (a.completed ?? a.target ?? '9').localeCompare(b.completed ?? b.target ?? '9'),
  effect: (a, b) => (effectValue(a) ?? Infinity) - (effectValue(b) ?? Infinity),
  name: (a, b) => a.name.localeCompare(b.name),
};
export const SORT_KEYS = Object.keys(SORTS);

/** Measures after search, filters and sort. */
export function filterMeasures(measures, { query, filters, sort }) {
  const kept = measures.filter(
    (m) =>
      (!filters.type || m.type === filters.type) &&
      (!filters.status || m.status === filters.status) &&
      (!filters.district || m.district === filters.district) &&
      (!filters.year || (m.completed ?? m.target ?? '').startsWith(filters.year)) &&
      matchesSearch(query, [m.id, m.name, m.district, m.funding, m.office]),
  );
  return kept.sort(SORTS[sort] ?? SORTS.newest);
}

/** Polygon from an open ring of corners. */
const ringPolygon = (v) => ({ type: 'Polygon', coordinates: [[...v, v[0]]] });
/** Max corners edited with handles; larger uploaded shapes stay as they are. */
const EDIT_MAX = 400;
/** Corners of a single polygon without holes (open ring), or null when it can't be edited. */
export function editableCorners(geometry) {
  if (geometry?.type !== 'Polygon' || geometry.coordinates.length !== 1) return null;
  const ring = geometry.coordinates[0];
  const [a, b] = [ring[0], ring[ring.length - 1]];
  const open = a[0] === b[0] && a[1] === b[1] ? ring.slice(0, -1) : ring;
  return open.length >= 3 && open.length <= EDIT_MAX ? open.map(([x, y]) => [x, y]) : null;
}

const nearestDistrict = (geometry) => {
  const c = centroid(geometry);
  return MANNHEIM_DISTRICTS.map((d) => ({ d, km: distanceKm(d.center, c) })).sort((a, b) => a.km - b.km)[0].d.name;
};

export const useMeasures = create()(
  persist(
    (set, get) => ({
      added: [],
      statusLog: {}, // { [measureId]: [{ from, to, at (ISO date-time), completed }] }, append-only
      selectedId: MEASURES[0].id,
      filters: EMPTY_FILTERS,
      query: '',
      sort: 'newest',
      mode: 'list', // list | form
      draft: emptyDraft(),
      drawing: false,
      shaping: false, // editing the corners of the drafted footprint
      corner: null, // selected corner while editing (index)

      select: (selectedId) => set({ selectedId }),
      setFilter: (key, value) => set({ filters: { ...get().filters, [key]: value } }),
      clearFilters: () => set({ filters: EMPTY_FILTERS, query: '' }),
      setQuery: (query) => set({ query }),
      setSort: (sort) => set({ sort }),

      openForm: () => set({ mode: 'form', draft: emptyDraft(), drawing: false, shaping: false }),
      closeForm: () => set({ mode: 'list', drawing: false, shaping: false }),
      setDraft: (patch) => set({ draft: { ...get().draft, ...patch } }),

      // Drawing on the map: clicks add corners; finishing closes the ring (3+ corners) and
      // opens corner editing, so an early double-click is easy to correct.
      startDrawing: () => set({ drawing: true, shaping: false, draft: { ...get().draft, vertices: [], geometry: null, source: 'draw' } }),
      addVertex: (p) => set({ draft: { ...get().draft, vertices: [...get().draft.vertices, p] } }),
      undoVertex: () => set({ draft: { ...get().draft, vertices: get().draft.vertices.slice(0, -1) } }),
      finishDrawing: () => {
        // A double-click to finish also lands as clicks: drop repeated corners.
        const v = get().draft.vertices.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-7);
        if (v.length < 3) return set({ drawing: false });
        const geometry = ringPolygon(v);
        set({ drawing: false, shaping: true, corner: null, draft: { ...get().draft, vertices: v, geometry, area: areaM2(geometry) } });
      },
      setGeometry: (geometry) => set({ drawing: false, shaping: false, draft: { ...get().draft, geometry, vertices: [], area: geometry ? areaM2(geometry) : 0 } }),

      // Corner editing: move, insert and remove corners (a polygon keeps at least 3).
      startShaping: () => {
        const v = editableCorners(get().draft.geometry);
        if (v) set({ shaping: true, corner: null, draft: { ...get().draft, vertices: v } });
      },
      stopShaping: () => set({ shaping: false, corner: null }),
      selectCorner: (corner) => set({ corner }),
      setCorners: (v) => {
        const geometry = ringPolygon(v);
        set({ draft: { ...get().draft, vertices: v, geometry, area: areaM2(geometry) } });
      },
      moveVertex: (i, p) => get().setCorners(get().draft.vertices.map((c, j) => (j === i ? p : c))),
      // A new corner becomes the selected one.
      insertVertex: (i, p) => {
        get().setCorners([...get().draft.vertices.slice(0, i), p, ...get().draft.vertices.slice(i)]);
        set({ corner: i });
      },
      removeVertex: (i) => {
        if (i == null || get().draft.vertices.length <= 3) return;
        get().setCorners(get().draft.vertices.filter((_, j) => j !== i));
        set({ corner: null });
      },

      // Status change: appends a timestamped event (completed: the completion date, when finished).
      setStatus: (id, to, completed) => {
        const current = allMeasures(get().added, get().statusLog).find((m) => m.id === id);
        if (!current) return;
        const event = { from: current.status, to, at: new Date().toISOString(), completed: isDone(to) ? completed || null : null };
        set({ statusLog: { ...get().statusLog, [id]: [...(get().statusLog[id] ?? []), event] } });
      },

      save: () => {
        const d = get().draft;
        const n = MEASURES.length + get().added.length + 1;
        const measure = {
          id: `MS-${String(n).padStart(3, '0')}`,
          name: d.name.trim(),
          type: d.type,
          status: d.status,
          district: nearestDistrict(d.geometry),
          completed: d.status === 'planned' || d.status === 'progress' ? null : d.completed,
          target: d.status === 'planned' || d.status === 'progress' ? d.completed.slice(0, 7) || null : null,
          area: Math.round(d.area),
          cost: Math.round(d.cost),
          funding: d.funding,
          office: d.office,
          trees: 0,
          residents: 0,
          notes: d.notes,
          files: d.files.map((f) => f.name),
          geometry: d.geometry,
          control: null,
          series: null,
          effect: null,
        };
        // The trail starts with the status the measure was registered with.
        const created = { from: null, to: measure.status, at: new Date().toISOString(), completed: measure.completed };
        set({ statusLog: { ...get().statusLog, [measure.id]: [created] }, added: [...get().added, measure], selectedId: measure.id, mode: 'list', drawing: false, shaping: false, draft: emptyDraft() });
        return measure;
      },
    }),
    {
      name: 'hs-measures',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ added, statusLog, selectedId, filters, sort }) => ({ added, statusLog, selectedId, filters, sort }),
    },
  ),
);

/** Hook: the full register (MOCK + added). */
export const useAllMeasures = () => allMeasures(useMeasures((s) => s.added), useMeasures((s) => s.statusLog));
