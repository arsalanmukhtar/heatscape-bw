import { create } from 'zustand';

export const useWorkspace = create()((set, get) => ({
  layers: { surfaceTemp: true, airTemp: true, hospitals: true, water: false },
  sealingOpacity: 65,
  selectedId: 'M-14',
  tools: { select: true, measure: false, grid: false },
  sort: null, // { key, dir: 'asc' | 'desc' } or null
  tableFilter: '',
  toggleLayer: (id) => set({ layers: { ...get().layers, [id]: !get().layers[id] } }),
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
