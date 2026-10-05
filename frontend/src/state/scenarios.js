import { create } from 'zustand';
import { REGION, SCENARIOS } from '../data/mock';
import { computeRanking } from '../lib/scenario';

const DEFAULT_PARAMS = SCENARIOS[0].params;
let seq = SCENARIOS.length + 1;

/* Scenario workspace (MOCK persistence: lives in memory until the scenarios API exists).
   results[id]: last computed ranking; stale[id]: parameters edited since that ranking. */
export const useScenarios = create()((set, get) => ({
  scenarios: SCENARIOS,
  activeId: SCENARIOS[0].id,
  results: {},
  stale: {},
  saved: {},
  notes: {}, // `${scenarioId}:${blockId}` → text
  compare: false,
  swipe: 50, // % from the left where the scenario side starts
  rankQuery: '', // ranking table search; survives the expanded view
  rankSort: null, // ranking table sort { key, dir }; kept here so it survives the expanded view
  setRankSort: (rankSort) => set({ rankSort }),
  setRankQuery: (rankQuery) => set({ rankQuery }),

  active: () => get().scenarios.find((s) => s.id === get().activeId),
  select: (activeId) => set({ activeId }),
  create: (name, createdBy) => {
    const id = `sc-${seq++}`;
    const scenario = { id, name, region: REGION.name, createdBy, status: 'Draft', params: structuredClone(DEFAULT_PARAMS) };
    set({ scenarios: [scenario, ...get().scenarios], activeId: id });
  },
  // Edits to name or params mark the result stale and the scenario unsaved.
  update: (patch) => {
    const { activeId, scenarios } = get();
    set({
      scenarios: scenarios.map((s) => (s.id === activeId ? { ...s, name: patch.name ?? s.name, params: { ...s.params, ...patch.params } } : s)),
      stale: { ...get().stale, [activeId]: get().stale[activeId] || (get().results[activeId] != null && patch.params != null) },
      saved: { ...get().saved, [activeId]: false },
    });
  },
  setWeight: (criterion, v) => {
    const p = get().active().params;
    get().update({ params: { weights: { ...p.weights, [criterion]: v } } });
  },
  compute: () => {
    const { activeId } = get();
    const result = computeRanking(get().active().params);
    set({ results: { ...get().results, [activeId]: result }, stale: { ...get().stale, [activeId]: false } });
    return result;
  },
  save: () => set({ saved: { ...get().saved, [get().activeId]: true } }),
  share: () => {
    const { activeId, scenarios } = get();
    set({ scenarios: scenarios.map((s) => (s.id === activeId ? { ...s, status: 'Shared' } : s)), saved: { ...get().saved, [activeId]: true } });
  },
  setNote: (blockId, text) => set({ notes: { ...get().notes, [`${get().activeId}:${blockId}`]: text } }),
  toggleCompare: () => set({ compare: !get().compare }),
  setSwipe: (swipe) => set({ swipe: Math.max(5, Math.min(95, swipe)) }),
}));

/** The ranking of the active scenario, or null before "Compute ranking". */
export const useActiveRanking = () => useScenarios((s) => s.results[s.activeId] ?? null);
