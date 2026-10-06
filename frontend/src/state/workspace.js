import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const DEFAULT_LAYERS = {
  surfaceTemp: true,
  airTemp: true,
  blocks: false,
  sealing: true,
  hospitals: true,
  water: false,
  dwdStations: true,
  population: false,
  adminLand: true,
  adminRbz: false,
  adminKrs: true,
  adminVwg: false,
  adminGem: false,
  adminOsm9: false,
  adminOsm10: false,
  measures: true,
  measureBuffers: true,
  lstRaster: false,
  hazardRaster: false,
  hillshade: false,
  priority: true,
  selection: true,
};

/*
  Workspace state. Layer visibility and the grid overlay are saved in localStorage
  (hs-workspace), so what is shown survives refreshes, closed tabs and new sessions; layers
  added later start at their default.
*/
export const useWorkspace = create()(
  persist(
    (set, get) => ({
      // Visibility of the map layers (ids from lib/layers.js) and the overlays (selection,
      // priority); the analysis grid is tools.grid, shared with the map controls.
      layers: DEFAULT_LAYERS,
      selectedId: 'M-14',
      pixel: null, // raster identify: { lon, lat } of the clicked point, or null
      // Feature popup: { lngLat, item: { layer, props, geometry, color }, at } or null.
      popup: null,
      // Attribute table: row click flies to the feature and highlights it (toggle in the
      // table toolbar, saved); rowHighlight: { layer, id } of the highlighted row, or null.
      tableFly: true,
      coordOrder: 'latlon', // address search: order of typed or pasted coordinates (latlon | lonlat)
      rowHighlight: null,
      tools: { select: true, measure: false, grid: false },
      snap: true, // ruler points snap to nearby vertices (magnet beside the ruler)
      tableLayer: 'blocks', // vector layer shown in the attribute table; null = none open
      // Rows limited to a query result (Symbology → Query → Show in table): { layer, ids, sql } or null.
      tableQuery: null,
      sort: null, // { key, dir: 'asc' | 'desc' } or null
      tableFilter: '',
      toggleLayer: (id) => set({ layers: { ...get().layers, [id]: !get().layers[id] } }),
      // Hide or show every layer at once, grid included.
      setAllLayers: (on) =>
        set({ layers: Object.fromEntries(Object.keys(get().layers).map((k) => [k, on])), tools: { ...get().tools, grid: on } }),
      select: (selectedId) => set({ selectedId }),
      setPixel: (pixel) => set({ pixel }),
      setPopup: (popup) => set({ popup }),
      toggleTableFly: () => set({ tableFly: !get().tableFly, rowHighlight: null }),
      setRowHighlight: (rowHighlight) => set({ rowHighlight }),
      toggleCoordOrder: () => set({ coordOrder: get().coordOrder === 'latlon' ? 'lonlat' : 'latlon' }),
      // Select and measure are exclusive pointer modes; the grid overlay toggles on its own.
      toggleSnap: () => set({ snap: !get().snap }),
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
      setTableLayer: (tableLayer) => set(tableLayer === get().tableLayer ? {} : { tableLayer, sort: null, tableFilter: '', tableQuery: null }),
      showQueryInTable: (layer, ids, sql) => set({ tableLayer: layer, tableQuery: { layer, ids, sql }, sort: null, tableFilter: '' }),
      clearTableQuery: () => set({ tableQuery: null }),
      setSort: (sort) => set({ sort }),
      setTableFilter: (tableFilter) => set({ tableFilter }),
    }),
    {
      name: 'hs-workspace',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ layers, tools, tableFly, coordOrder }) => ({ layers, grid: tools.grid, tableFly, coordOrder }),
      merge: (saved, current) => {
        const layers = { ...DEFAULT_LAYERS };
        Object.keys(layers).forEach((k) => {
          if (typeof saved?.layers?.[k] === 'boolean') layers[k] = saved.layers[k];
        });
        return { ...current, layers, tools: { ...current.tools, grid: !!saved?.grid }, tableFly: saved?.tableFly ?? true, coordOrder: saved?.coordOrder === 'lonlat' ? 'lonlat' : 'latlon' };
      },
    },
  ),
);

