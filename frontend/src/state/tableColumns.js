import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/*
  Attribute table columns per layer, saved in this browser (hs-table-columns):
  widths { layerId: { fieldKey: px at the 16 px base } } (unset = automatic width) and
  hidden { layerId: [fieldKey] }.
*/
export const MIN_COL = 48;

export const useTableColumns = create()(
  persist(
    (set, get) => ({
      widths: {},
      hidden: {},
      setWidth: (layer, key, px) => set({ widths: { ...get().widths, [layer]: { ...get().widths[layer], [key]: Math.max(MIN_COL, Math.round(px)) } } }),
      resetWidths: (layer) => {
        const { [layer]: _, ...rest } = get().widths;
        set({ widths: rest });
      },
      setHidden: (layer, key, hide) => {
        const now = new Set(get().hidden[layer] ?? []);
        if (hide) now.add(key);
        else now.delete(key);
        set({ hidden: { ...get().hidden, [layer]: [...now] } });
      },
      showAll: (layer) => set({ hidden: { ...get().hidden, [layer]: [] } }),
    }),
    { name: 'hs-table-columns', version: 1, storage: createJSONStorage(() => localStorage), partialize: ({ widths, hidden }) => ({ widths, hidden }) },
  ),
);
