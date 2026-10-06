import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { t } from '../i18n';
import { allMeasures, archivedMeasures, useMeasures } from './measures';
import { useJobs } from './jobs';

/*
  Notifications (bell in the top nav), made from events the workspace already has:
    jobs     finished or failed (geoprocessing runner);
    measures registered, status changed or deprecated (measures register).
  Each item: { key (dedupe), kind, title, text, at (ms), read, target: { type: 'job' | 'measure', id } }.
  Saved in this browser (hs-notifications), newest first, the last MAX kept; seen keeps the
  keys of reported events, so a cleared item does not come back. The stores are
  watched from here, so the bell needs no wiring in the screens that cause the events.
*/
const MAX = 50;
const n = t.notifications;

export const useNotifications = create()(
  persist(
    (set, get) => ({
      items: [],
      seen: [],
      /** Adds an item unless its event was reported before. */
      push: (item) => {
        if (get().seen.includes(item.key)) return;
        set({ items: [{ at: Date.now(), read: false, ...item }, ...get().items].slice(0, MAX), seen: [item.key, ...get().seen].slice(0, MAX * 4) });
      },
      markRead: (key) => set({ items: get().items.map((x) => (x.key === key ? { ...x, read: true } : x)) }),
      markAllRead: () => set({ items: get().items.map((x) => ({ ...x, read: true })) }),
      clear: () => set({ items: [] }),
    }),
    { name: 'hs-notifications', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

const push = (item) => useNotifications.getState().push(item);

// Jobs: a status change to done or failed. Failed jobs already in the list when the app
// opens are reported once (the key keeps them from coming back).
const jobItem = (job) =>
  job.status === 'failed'
    ? { key: `job:${job.id}:${job.started}:failed`, kind: 'jobFailed', title: n.jobFailed, text: `${job.name} · ${job.tool}`, target: { type: 'job', id: job.id } }
    : { key: `job:${job.id}:${job.started}:done`, kind: 'jobDone', title: n.jobDone, text: `${job.name} · ${job.tool}`, target: { type: 'job', id: job.id } };

useJobs.getState().jobs.filter((j) => j.status === 'failed').forEach((j) => push(jobItem(j)));

const unwatchJobs = useJobs.subscribe((state, prev) => {
  const before = new Map(prev.jobs.map((j) => [j.id, j.status]));
  state.jobs.forEach((j) => {
    if (before.get(j.id) !== j.status && (j.status === 'done' || j.status === 'failed')) push(jobItem(j));
  });
});

// Measures: every new event in a status trail (the first one of a new measure is its registration).
const unwatchMeasures = useMeasures.subscribe((state, prev) => {
  if (state.statusLog === prev.statusLog) return;
  const names = new Map([...allMeasures(state.added, state.statusLog), ...archivedMeasures(state.added, state.statusLog)].map((m) => [m.id, m.name]));
  Object.entries(state.statusLog).forEach(([id, trail]) => {
    const old = prev.statusLog[id]?.length ?? 0;
    trail.slice(old).forEach((ev, i) => {
      const status = t.measures.statuses[ev.to] ?? ev.to;
      const kind = ev.from == null ? 'measureAdded' : ev.to === 'deprecated' ? 'measureDeprecated' : 'measureStatus';
      push({
        key: `measure:${id}:${old + i}`,
        kind,
        title: n[kind],
        text: kind === 'measureStatus' ? n.statusText(names.get(id) ?? id, status) : (names.get(id) ?? id),
        target: { type: 'measure', id },
      });
    });
  });
});

// Hot reload re-runs this module; drop the old watchers so events are not reported twice.
import.meta.hot?.dispose(() => {
  unwatchJobs();
  unwatchMeasures();
});
