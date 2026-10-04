import { create } from 'zustand';
import { JOBS, REGION } from '../data/mock';

/* MOCK job runner: one job runs at a time; every second its duration ticks and every
   other second it advances 4 zones and logs it. At total it finishes and the next
   queued job starts. Replaced by the worker queue API later. */
const ZONE_STEP = 4;

const clock = () => new Date().toTimeString().slice(0, 8);
const log = (level, msg) => ({ time: clock(), level, msg });

const start = (job) => ({
  ...job,
  status: 'running',
  started: clock(),
  logs: [log('INFO', `Initializing GP tool '${job.tool}'`), log('INFO', 'Validating geometries for zone data...')],
});

let seq = 8844;

export const useJobs = create()((set, get) => ({
  jobs: JOBS,
  filter: '',
  sort: null, // { key, dir } — kept here so it survives moving into the expanded view
  setSort: (sort) => set({ sort }),
  setFilter: (filter) => set({ filter }),
  selectedId: JOBS.find((j) => j.status === 'running')?.id ?? JOBS[0]?.id ?? null,
  select: (selectedId) => set({ selectedId }),
  submit: (tool) => {
    const id = `JOB-${seq++}`;
    const busy = get().jobs.some((j) => j.status === 'running');
    const job = { id, name: `${REGION.name}_${tool.short}`, tool: tool.name, region: REGION.name, status: 'queued', durationSec: 0, started: clock(), progress: 0, total: 48, logs: [] };
    set({ jobs: [busy ? job : start(job), ...get().jobs], selectedId: id });
  },
  clearFinished: () => {
    const jobs = get().jobs.filter((j) => j.status === 'running' || j.status === 'queued');
    set({ jobs, selectedId: jobs.some((j) => j.id === get().selectedId) ? get().selectedId : (jobs[0]?.id ?? null) });
  },
  tick: () => {
    let jobs = get().jobs;
    const i = jobs.findIndex((j) => j.status === 'running');
    if (i < 0) {
      // Start the oldest queued job (the list is newest first).
      const q = jobs.findLastIndex((j) => j.status === 'queued');
      if (q >= 0) set({ jobs: jobs.map((j, k) => (k === q ? start(j) : j)) });
      return;
    }
    const job = { ...jobs[i], durationSec: jobs[i].durationSec + 1 };
    if (job.durationSec % 2 === 0) {
      job.progress = Math.min(job.total, job.progress + ZONE_STEP);
      job.logs = [...job.logs, log('EXEC', `Processing zone ${job.progress}/${job.total}...`)];
      if (job.progress >= job.total) {
        job.status = 'done';
        job.logs = [...job.logs, log('DONE', `Job ${job.id} finished`)];
      }
    }
    jobs = jobs.map((j, k) => (k === i ? job : j));
    set({ jobs });
  },
}));

const timer = setInterval(() => useJobs.getState().tick(), 1000);
// Hot reload re-runs this module; drop the old timer so ticks do not stack.
import.meta.hot?.dispose(() => clearInterval(timer));
