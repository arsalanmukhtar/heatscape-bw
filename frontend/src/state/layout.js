import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const PANEL_MIN = 200;
export const PANEL_MAX = 520;
export const DOCK_MIN = 120;

/* Sizes stay null until a handle is dragged; null means "use the token default"
   (--panel-left-w, --panel-w, --dock-open-h), so tokens.css remains the single source. */
export const useLayout = create()(
  persist(
    (set, get) => ({
      leftOpen: true,
      leftSection: 'layers', // layers | filters | reports | settings
      rightOpen: true,
      rightView: 'inspector', // inspector | copilot
      dockOpen: true,
      leftW: null,
      rightW: null,
      dockH: null,
      dragging: false,
      toggleLeft: () => set({ leftOpen: !get().leftOpen }),
      // Clicking the active rail icon collapses the panel; any other icon opens its section.
      openSection: (section) => {
        const { leftOpen, leftSection } = get();
        if (leftOpen && leftSection === section) set({ leftOpen: false });
        else set({ leftOpen: true, leftSection: section });
      },
      toggleRight: () => set({ rightOpen: !get().rightOpen }),
      // Same rule for the right panel views opened from the rail.
      openRightView: (view) => {
        const { rightOpen, rightView } = get();
        if (rightOpen && rightView === view) set({ rightOpen: false });
        else set({ rightOpen: true, rightView: view });
      },
      toggleDock: () => set({ dockOpen: !get().dockOpen }),
      setLeftW: (leftW) => set({ leftW }),
      setRightW: (rightW) => set({ rightW }),
      setDockH: (dockH) => set({ dockH }),
      setDragging: (dragging) => set({ dragging }),
    }),
    {
      name: 'hs-layout',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ leftOpen, leftSection, rightOpen, rightView, dockOpen, leftW, rightW, dockH }) => ({
        leftOpen,
        leftSection,
        rightOpen,
        rightView,
        dockOpen,
        leftW,
        rightW,
        dockH,
      }),
    },
  ),
);
