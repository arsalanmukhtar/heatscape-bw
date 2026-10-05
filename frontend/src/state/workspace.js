import { create } from 'zustand';

export const useWorkspace = create()((set, get) => ({
  // Map overlays toggled in the Layers panel (the analysis grid is tools.grid, shared with the map controls).
  layers: { surfaceTemp: true, airTemp: true, hospitals: true, water: false, sealing: true, priority: true, selection: true },
  sealingOpacity: 65,
  selectedId: 'M-14',
  tools: { select: true, measure: false, grid: false },
  sort: null, // { key, dir: 'asc' | 'desc' } or null
  tableFilter: '',
  toggleLayer: (id) => set({ layers: { ...get().layers, [id]: !get().layers[id] } }),
  // Hide or show every overlay at once, grid included.
  setAllLayers: (on) =>
    set({ layers: Object.fromEntries(Object.keys(get().layers).map((k) => [k, on])), tools: { ...get().tools, grid: on } }),
  setSealingOpacity: (sealingOpacity) => set({ sealingOpacity }),
  select: (selectedId) => set({ selectedId }),
  // Select and measure are exclusive pointer modes; the grid overlay toggles on its own.
  toggleTool: (tool) => {
    const tools = { ...get().tools };
    if (tool === 'grid') tools.grid = !tools.grid;
    else {
      const next = !tools[tool];
      tools.select = false;
      tools.measure = false;
      tools[tool] = next;
    }
    set({ tools });
  },
  setSort: (sort) => set({ sort }),
  setTableFilter: (tableFilter) => set({ tableFilter }),
}));
