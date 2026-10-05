import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/*
  Public Heat Portal state. Language and panel/sheet layout are remembered in this
  browser (hs-portal); the searched location is not stored (privacy: no address history).
  location: { name, place, center, bbox? } or null. sheet: peek | half | full (mobile).
*/
export const usePortal = create()(
  persist(
    (set) => ({
      lang: navigator.language?.startsWith('de') ? 'de' : 'en',
      panelOpen: true,
      sheet: 'half',
      section: 'neighbourhood', // neighbourhood | cool | about
      location: null,
      placeId: null, // cool place picked in the list or on the map
      setLang: (lang) => set({ lang }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      setSheet: (sheet) => set({ sheet }),
      setSection: (section) => set({ section }),
      setLocation: (location) => set({ location, placeId: null }),
      pickPlace: (placeId) => set({ placeId }),
    }),
    {
      name: 'hs-portal',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ lang, panelOpen, sheet }) => ({ lang, panelOpen, sheet }),
    },
  ),
);
