import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ADMIN_ALERTS, ADMIN_NOW, AUDIT_LOG, USER } from '../data/mock';
import { t } from '../i18n';
import { getPipelineRuns, getPipelines, pausePipeline, runPipeline } from '../lib/api';

/*
  Admin console state. Section, panel and dock layout are remembered (hs-admin). Pipelines
  are live: the worker's import jobs and their run log (/api/pipelines, reloaded every
  POLL_MS while the console is open); Run now and Pause go to the backend and the worker
  acts on its next pass (≤ 1 min). Failed jobs raise alerts; the log dock shows runs and
  console actions. Other alerts and the audit entries are MOCK and live for the session.
*/
const LOG_MAX = 500;
const POLL_MS = 15 * 1000;
const LOADED = Date.now();
export const adminNow = () => new Date(new Date(ADMIN_NOW).getTime() + (Date.now() - LOADED));
const nowIso = () => adminNow().toISOString();
/** Hours between an ISO time and the console clock (positive = in the past). */
export const hoursAgo = (iso) => (adminNow() - new Date(iso)) / 3600e3;

const p = t.admin.pipelines;
/** "Every 10 min" / "Every 6 h" / "Every 7 d" / "Once, then on request". */
export const scheduleLabel = (s) =>
  s == null ? p.once : s < 3600 ? p.every(`${Math.round(s / 60)} min`) : s < 86400 ? p.every(`${Math.round(s / 3600)} h`) : p.every(`${Math.round(s / 86400)} d`);

/** API run → { id, start, duration (s; elapsed while running), records, status, message, trigger }. */
const toRun = (r) => ({
  id: r.id,
  job: r.job,
  start: r.started_at,
  duration: Math.max(1, Math.round(r.duration_s ?? (Date.now() - new Date(r.started_at)) / 1000)),
  records: r.rows ?? 0,
  status: r.status,
  message: r.message,
  trigger: r.trigger,
});

/** API pipeline → table row. Status: running | queued (Run now pending) | paused | ok | failed | never. */
const toPipeline = (x) => ({
  id: x.job,
  dataset: x.dataset,
  attribution: x.attribution,
  name: x.title,
  source: x.source,
  licence: x.licence,
  schedule: scheduleLabel(x.interval_s),
  lastRun: x.last_run?.started_at ?? x.fetched_at, // before the run log existed: the last import
  nextRun: x.next_run_at,
  status: x.status === 'running' ? 'running' : x.run_requested ? 'queued' : x.paused ? 'paused' : x.status,
  paused: x.paused,
  records: x.last_run?.rows ?? 0,
  duration: x.last_run ? toRun(x.last_run).duration : 0,
  message: x.last_run?.status === 'failed' ? x.last_run.message : null,
});

/** Log dock lines from runs: start, then end (info) or failure (error). */
const runLines = (runs) =>
  runs.flatMap((r) => [
    { time: r.start, level: 'info', source: r.job, message: p.logStarted(r.trigger), run: r.id },
    ...(r.status === 'running'
      ? []
      : [
          {
            time: new Date(new Date(r.start).getTime() + r.duration * 1000).toISOString(),
            level: r.status === 'failed' ? 'error' : 'info',
            source: r.job,
            message: r.status === 'failed' ? p.logFailed(r.message) : p.logFinished(r.records, r.duration),
            run: r.id,
          },
        ]),
  ]);

export const useAdmin = create()(
  persist(
    (set, get) => ({
      section: 'overview',
      navOpen: true,
      navW: null,
      dockOpen: true,
      dockH: null,
      pipelines: [],
      pipelinesStatus: 'loading', // loading | ok | error
      pipelinesError: null,
      runs: {}, // job → recent runs (last 500 of all jobs), oldest first
      selectedPipeline: null,
      logs: [], // pipeline run lines (live) and console actions
      logFilter: { source: '', level: '', query: '' },
      follow: true,
      audit: AUDIT_LOG,
      dismissed: [],
      mockAlerts: ADMIN_ALERTS,
      alerts: ADMIN_ALERTS,

      setSection: (section) => set({ section }),
      toggleNav: () => set({ navOpen: !get().navOpen }),
      setNavW: (navW) => set({ navW }),
      toggleDock: () => set({ dockOpen: !get().dockOpen }),
      setDockH: (dockH) => set({ dockH }),
      selectPipeline: (selectedPipeline) => set({ selectedPipeline }),
      setLogFilter: (patch) => set({ logFilter: { ...get().logFilter, ...patch } }),
      setFollow: (follow) => set({ follow }),
      dismissAlert: (id) => set({ dismissed: [...get().dismissed, id] }),
      // The stream keeps the newest LOG_MAX lines.
      log: (source, level, message) => set({ logs: [...get().logs, { time: nowIso(), level, source, message }].slice(-LOG_MAX) }),
      addAudit: (action, target, result = 'ok') =>
        set({ audit: [{ id: `a-${Date.now()}`, time: nowIso(), user: USER.name, action, target, result }, ...get().audit] }),
      /** Shows one pipeline's lines in the dock and opens it. */
      showLogs: (source) => set({ logFilter: { ...get().logFilter, source }, dockOpen: true }),

      /** Loads pipelines and runs; failed jobs become alerts, runs become log lines. */
      loadPipelines: async () => {
        try {
          const [list, runList] = await Promise.all([getPipelines(), getPipelineRuns()]);
          const pipelines = list.map(toPipeline);
          const all = runList.map(toRun).reverse(); // oldest first
          const runs = Object.fromEntries(pipelines.map((x) => [x.id, all.filter((r) => r.job === x.id)]));
          const failedAlerts = pipelines
            .filter((x) => x.status === 'failed' || (x.paused && x.message))
            .map((x) => ({ id: `run-${x.id}-${x.lastRun}`, severity: 'critical', time: x.lastRun, source: x.name, message: p.alert(x.message) }));
          const logs = [...get().logs.filter((l) => !l.run), ...runLines(all)].sort((m, n) => new Date(m.time) - new Date(n.time)).slice(-LOG_MAX);
          set({
            pipelines,
            runs,
            logs,
            alerts: [...failedAlerts, ...get().mockAlerts],
            pipelinesStatus: 'ok',
            pipelinesError: null,
            selectedPipeline: pipelines.some((x) => x.id === get().selectedPipeline) ? get().selectedPipeline : (pipelines[0]?.id ?? null),
          });
        } catch (e) {
          set({ pipelinesStatus: 'error', pipelinesError: e.message });
        }
      },
      /** Loads now and every POLL_MS; returns a stop function. */
      startPolling: () => {
        get().loadPipelines();
        const timer = setInterval(() => get().loadPipelines(), POLL_MS);
        return () => clearInterval(timer);
      },
      runNow: async (id) => {
        const x = get().pipelines.find((q) => q.id === id);
        if (!x || x.status === 'running' || x.status === 'queued') return;
        try {
          await runPipeline(id);
          get().log(id, 'info', p.requested(USER.name));
          get().addAudit('pipeline.run', x.name);
        } catch (e) {
          get().log(id, 'error', p.actionFailed(e.message));
          get().addAudit('pipeline.run', x.name, 'failed');
        }
        get().loadPipelines();
      },
      togglePause: async (id) => {
        const x = get().pipelines.find((q) => q.id === id);
        if (!x || x.status === 'running') return;
        try {
          await pausePipeline(id, !x.paused);
          get().log(id, 'info', x.paused ? p.resumed(USER.name) : p.paused(USER.name));
          get().addAudit(x.paused ? 'pipeline.resume' : 'pipeline.pause', x.name);
        } catch (e) {
          get().log(id, 'error', p.actionFailed(e.message));
          get().addAudit(x.paused ? 'pipeline.resume' : 'pipeline.pause', x.name, 'failed');
        }
        get().loadPipelines();
      },
    }),
    {
      name: 'hs-admin',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ section, navOpen, navW, dockOpen, dockH, follow }) => ({ section, navOpen, navW, dockOpen, dockH, follow }),
    },
  ),
);
