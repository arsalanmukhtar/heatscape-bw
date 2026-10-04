import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { basemapUrl } from '../lib/mapStyle';
import { useTheme } from './theme';

/* Selected basemap, kept in localStorage so it survives refreshes and new sessions. */
export const useBasemap = create()(
  persist(
    (set) => ({
      basemap: 'auto',
      setBasemap: (basemap) => set({ basemap }),
    }),
    { name: 'hs-basemap', storage: createJSONStorage(() => localStorage) },
  ),
);

/** Style URL for the main and compare maps. */
export function useMapStyleUrl() {
  const basemap = useBasemap((s) => s.basemap);
  const theme = useTheme((s) => s.resolved);
  return basemapUrl(basemap, theme);
}
