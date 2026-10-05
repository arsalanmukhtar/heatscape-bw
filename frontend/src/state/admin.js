import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ADMIN_ALERTS, ADMIN_LOGS, ADMIN_NOW, AUDIT_LOG, PIPELINES, USER } from '../data/mock';

/*
  Admin console state. Section, panel and dock layout are remembered (hs-admin); pipeline
  runs, log lines and audit entries live for the session (MOCK: "Run now" simulates a
  run that finishes after a few seconds and writes log and audit lines).
*/
const RUN_MS = 6000;
const LOG_MAX = 500;
// The console's clock runs from the MOCK "now", so new runs and log lines sit on the same
// timeline as the MOCK history.
const LOADED = Date.now();
export const adminNow = () => new Date(new Date(ADMIN_NOW).getTime() + (Date.now() - LOADED));
const nowIso = () => adminNow().toISOString();
/** Hours between an ISO time and the console clock (positive = in the past). */
export const hoursAgo = (iso) => (adminNow() - new Date(iso)) / 3600e3;

export const useAdmin = create()(
  persist(
    (set, get) => ({
      section: 'overview',
      navOpen: true,
      navW: null,
      dockOpen: true,
      dockH: null,
      pipelines: PIPELINES,
      selectedPipeline: PIPELINES[0].id,
      logs: ADMIN_LOGS,
      logFilter: { source: '', level: '', query: '' },
      follow: true,
      audit: AUDIT_LOG,
      dismissed: [],
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

      runNow: (id) => {
        const p = get().pipelines.find((x) => x.id === id);
        if (!p || p.status === 'running') return;
        const patch = (fields) => set({ pipelines: get().pipelines.map((x) => (x.id === id ? { ...x, ...fields } : x)) });
        patch({ status: 'running', lastRun: nowIso() });
        get().log(id, 'info', `Manual run started by ${USER.name}`);
        get().addAudit('pipeline.run', p.name);
        setTimeout(() => {
          const records = Math.max(1, Math.round((p.records || 20) * (0.6 + Math.random() * 0.8)));
          patch({ status: 'ok', records, duration: Math.round(RUN_MS / 1000) });
          get().log(id, 'info', `Run finished: ${records} records added`);
        }, RUN_MS);
      },
      togglePause: (id) => {
        const p = get().pipelines.find((x) => x.id === id);
        if (!p || p.status === 'running') return;
        const paused = p.status === 'paused';
        set({ pipelines: get().pipelines.map((x) => (x.id === id ? { ...x, status: paused ? 'ok' : 'paused' } : x)) });
        get().log(id, 'info', paused ? `Schedule resumed by ${USER.name}` : `Schedule paused by ${USER.name}`);
        get().addAudit(paused ? 'pipeline.resume' : 'pipeline.pause', p.name);
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
