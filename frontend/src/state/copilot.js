import { create } from 'zustand';
import { COPILOT } from '../data/mock';

const STEP_MS = 1400;

/* MOCK copilot session: the plan "runs" by advancing one tool call per STEP_MS.
   status: planned | running | done; step: index of the running tool call. */
const initial = () => ({
  messages: [
    { id: 'q', role: 'user', text: COPILOT.question },
    { id: 'plan', role: 'assistant', kind: 'plan' },
  ],
  status: 'planned',
  step: -1,
  draft: '',
  useExtent: true,
  useSelection: false,
});

let timer = 0;

export const useCopilot = create()((set, get) => ({
  ...initial(),
  setDraft: (draft) => set({ draft }),
  toggleExtent: () => set({ useExtent: !get().useExtent }),
  toggleSelection: () => set({ useSelection: !get().useSelection }),
  runPlan: () => {
    if (get().status !== 'planned') return;
    set({ status: 'running', step: 0 });
    clearInterval(timer);
    timer = setInterval(() => {
      const next = get().step + 1;
      if (next >= COPILOT.tools.length) {
        clearInterval(timer);
        set({ status: 'done', step: next });
      } else set({ step: next });
    }, STEP_MS);
  },
  send: () => {
    const text = get().draft.trim();
    if (!text) return;
    const id = Date.now();
    set({
      draft: '',
      messages: [...get().messages, { id: `u${id}`, role: 'user', text }, { id: `a${id}`, role: 'assistant', kind: 'note' }],
    });
  },
  reset: () => {
    clearInterval(timer);
    set(initial());
  },
}));
