import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { USER } from '../data/mock';

/*
  Report Builder: one report at a time, saved in this browser (hs-reports) until the
  reports API stores them. Text fields are null while they follow the template text (in
  the report language); typing makes them the user's own. map.snapshot holds the captured
  map view (JPEG data URL plus the camera, for scale bar, north arrow and legend).
*/
export const SECTION_TYPES = ['title', 'summary', 'map', 'indicators', 'method', 'sources', 'appendix'];
export const TEMPLATES = {
  planning: ['title', 'summary', 'map', 'indicators', 'method', 'sources'],
  heatplan: ['title', 'summary', 'map', 'indicators', 'method', 'sources', 'appendix'],
  measure: ['title', 'summary', 'map', 'indicators', 'method', 'sources', 'appendix'],
};
export const ZOOMS = [50, 75, 100, 125, 150];

let seq = 0;
const uid = (type) => `${type}-${Date.now().toString(36)}${(seq++).toString(36)}`;

/** A new section of a type, with its defaults (template: the report's template). */
export function newSection(type, template = 'planning') {
  const base = { id: uid(type), type, title: null };
  switch (type) {
    case 'title':
      return { ...base, subtitle: null, organisation: null };
    case 'summary':
      return { ...base, text: null };
    case 'map':
      return { ...base, legend: true, uncertainty: true, snapshot: null };
    case 'indicators':
      return { ...base, chart: true, uncertainty: true };
    case 'appendix':
      return { ...base, text: null, includeMeasures: template === 'measure' };
    default:
      return base;
  }
}

const fromTemplate = (template) => TEMPLATES[template].map((type) => newSection(type, template));
const initial = () => {
  const sections = fromTemplate('planning');
  return { template: 'planning', title: null, language: 'en', author: USER.name, sections, selectedId: sections[0].id };
};

export const useReports = create()(
  persist(
    (set, get) => ({
      ...initial(),
      zoom: 75,
      printing: false, // print dialog open (Export PDF); not persisted

      setReport: (patch) => set(patch),
      setZoom: (zoom) => set({ zoom }),
      setPrinting: (printing) => set({ printing }),
      select: (selectedId) => set({ selectedId }),
      applyTemplate: (template) => {
        const sections = fromTemplate(template);
        set({ template, title: null, sections, selectedId: sections[0].id });
      },
      updateSection: (id, patch) => set({ sections: get().sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
      addSection: (type) => {
        const s = newSection(type, get().template);
        // Each type once; it goes after the last section that comes before it in the
        // standard order (title page first).
        const list = get().sections;
        if (list.some((x) => x.type === type)) return;
        const rank = SECTION_TYPES.indexOf(type);
        const at = list.reduce((pos, x, i) => (SECTION_TYPES.indexOf(x.type) < rank ? i + 1 : pos), 0);
        set({ sections: [...list.slice(0, at), s, ...list.slice(at)], selectedId: s.id });
      },
      removeSection: (id) => {
        const list = get().sections;
        const i = list.findIndex((s) => s.id === id);
        const sections = list.filter((s) => s.id !== id);
        set({ sections, selectedId: get().selectedId === id ? (sections[Math.min(i, sections.length - 1)]?.id ?? null) : get().selectedId });
      },
      // Move a section to index `to` (the title page stays first).
      moveSection: (id, to) => {
        const list = [...get().sections];
        const from = list.findIndex((s) => s.id === id);
        const min = list[0]?.type === 'title' ? 1 : 0;
        if (from < 0 || list[from].type === 'title') return;
        const [s] = list.splice(from, 1);
        list.splice(Math.max(min, Math.min(list.length, to)), 0, s);
        set({ sections: list });
      },
      // A shared report (link) replaces the current one.
      loadShared: (report) => {
        const sections = report.sections.map((s) => ({ ...newSection(s.type, report.template), ...s }));
        set({ template: report.template, title: report.title, language: report.language, author: report.author, sections, selectedId: sections[0]?.id ?? null });
      },
    }),
    {
      name: 'hs-reports',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ template, title, language, author, sections, selectedId, zoom }) => ({ template, title, language, author, sections, selectedId, zoom }),
    },
  ),
);
