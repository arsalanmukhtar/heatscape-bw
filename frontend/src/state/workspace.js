import { create } from 'zustand';

export const useWorkspace = create()((set, get) => ({
  // Visibility of the map layers (ids from lib/layers.js) and the overlays (selection,
  // priority); the analysis grid is tools.grid, shared with the map controls.
  layers: {
    surfaceTemp: true,
    airTemp: true,
    blocks: false,
    sealing: true,
    hospitals: true,
    water: false,
    lstRaster: false,
    hazardRaster: false,
    hillshade: false,
    priority: true,
    selection: true,
  },
  selectedId: 'M-14',
  tools: { select: true, measure: false, grid: false },
  tableLayer: 'blocks', // vector layer shown in the attribute table; null = none open
  sort: null, // { key, dir: 'asc' | 'desc' } or null
  tableFilter: '',
  toggleLayer: (id) => set({ layers: { ...get().layers, [id]: !get().layers[id] } }),
  // Hide or show every layer at once, grid included.
  setAllLayers: (on) =>
    set({ layers: Object.fromEntries(Object.keys(get().layers).map((k) => [k, on])), tools: { ...get().tools, grid: on } }),
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
  // A new table layer starts unsorted and unfiltered (its columns differ).
  setTableLayer: (tableLayer) => set(tableLayer === get().tableLayer ? {} : { tableLayer, sort: null, tableFilter: '' }),
  setSort: (sort) => set({ sort }),
  setTableFilter: (tableFilter) => set({ tableFilter }),
}));
