import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const PANEL_MIN = 200;
export const PANEL_MAX = 520;
export const DOCK_MIN = 120;

/* Right view wired to each left section. Opening a section opens its view; a section
   with no entry has no right panel, so opening it collapses the right panel. */
export const SECTION_VIEW = { layers: 'inspector', scenarios: 'ranking' };

/* Sizes stay null until a handle is dragged; null means "use the token default"
   (--panel-w, --dock-open-h), so tokens.css remains the single source. The left and right
   panels share one width (panelW): dragging either edge resizes both. */
export const useLayout = create()(
  persist(
    (set, get) => ({
      leftOpen: true,
      leftSection: 'layers', // layers | geoprocessing | scenarios | filters | reports | settings
      rightOpen: true,
      rightView: 'inspector', // inspector | copilot | ranking | symbology
      dockOpen: true,
      dockTab: 'table', // table | jobs | charts
      dockMax: false, // dock fills the map area (not persisted)
      mapControlsOpen: true,
      expanded: null, // id of the element shown in the map overlay (not persisted)
      panelW: null,
      dockH: null,
      dragging: false,
      toggleLeft: () => set({ leftOpen: !get().leftOpen }),
      // Clicking the active rail icon collapses the panel; any other icon opens its section
      // together with its wired right view (or collapses the right panel if it has none).
      openSection: (section) => {
        const { leftOpen, leftSection } = get();
        if (leftOpen && leftSection === section) return set({ leftOpen: false });
        const view = SECTION_VIEW[section];
        set({ leftOpen: true, leftSection: section, ...(view ? { rightOpen: true, rightView: view } : { rightOpen: false }) });
      },
      toggleRight: () => set({ rightOpen: !get().rightOpen }),
      // Same rule for the right panel views opened from the rail.
      openRightView: (view) => {
        const { rightOpen, rightView } = get();
        if (rightOpen && rightView === view) set({ rightOpen: false });
        else set({ rightOpen: true, rightView: view });
      },
      // Open a right view without toggling (e.g. Symbology from a layer row).
      showRightView: (view) => set({ rightOpen: true, rightView: view }),
      toggleDock: () => set({ dockOpen: !get().dockOpen, dockMax: false }),
      // Universal expand: one element at a time; it also restores a maximised dock so the map shows.
      toggleExpanded: (id) => set({ expanded: get().expanded === id ? null : id, dockMax: false }),
      closeExpanded: () => set({ expanded: null }),
      toggleMapControls: () => set({ mapControlsOpen: !get().mapControlsOpen }),
      toggleDockMax: () => set({ dockMax: !get().dockMax, dockOpen: true }),
      // Picking a tab also opens a collapsed dock.
      setDockTab: (dockTab) => set({ dockTab, dockOpen: true }),
      setPanelW: (panelW) => set({ panelW }),
      setDockH: (dockH) => set({ dockH }),
      setDragging: (dragging) => set({ dragging }),
    }),
    {
      name: 'hs-layout',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ leftOpen, leftSection, rightOpen, rightView, dockOpen, dockTab, mapControlsOpen, panelW, dockH }) => ({
        leftOpen,
        leftSection,
        rightOpen,
        rightView,
        dockOpen,
        dockTab,
        mapControlsOpen,
        panelW,
        dockH,
      }),
    },
  ),
);
