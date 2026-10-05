import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { BASEMAPS, DEFAULT_BASEMAP, basemapUrl } from '../lib/mapStyle';

/* Selected basemap, kept in localStorage so it survives refreshes and new sessions. */
export const useBasemap = create()(
  persist(
    (set) => ({
      basemap: DEFAULT_BASEMAP,
      setBasemap: (basemap) => set({ basemap }),
    }),
    {
      name: 'hs-basemap',
      storage: createJSONStorage(() => localStorage),
      // A saved id that is no longer offered (the old 'auto') falls back to the default.
      merge: (saved, current) => ({ ...current, basemap: BASEMAPS.some((b) => b.id === saved?.basemap) ? saved.basemap : DEFAULT_BASEMAP }),
    },
  ),
);

/** Style URL for the main and compare maps. */
export function useMapStyleUrl() {
  return basemapUrl(useBasemap((s) => s.basemap));
}
