import { create } from 'zustand';

/* Live map readout for the top nav: zoom, map centre and the pointer position (null when
   the pointer is off the map). Written by MapView (once per animation frame at most). */
export const useMapInfo = create((set) => ({
  zoom: null,
  center: null,
  pointer: null,
  update: (patch) => set(patch),
}));
