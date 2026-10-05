import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_ORDER, LAYERS, layerById, numericFields } from '../lib/layers';
import { buildClasses, DEFAULT_STYLES, normalizeStyle, RECLASSIFY_KEYS, renderersFor } from '../lib/styleModel';

/*
  Layer symbology: one style per layer plus the draw order, saved in localStorage
  (hs-symbology), so a style survives refreshes, hard refreshes and browser restarts until
  it is reset. Undo keeps the last HISTORY changes per layer for this session; rapid
  changes to the same setting (slider drags) count as one step.
*/
const HISTORY = 20;
const COALESCE_MS = 600;
const clone = (o) => JSON.parse(JSON.stringify(o));
const isStyleable = (id) => !!layerById(id);

// Path helpers: 'point.fill' → style.point.fill.
function setIn(obj, path, value) {
  const keys = path.split('.');
  const out = { ...obj };
  let cur = out;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = { ...cur[k] };
    cur = cur[k];
  });
  cur[keys[keys.length - 1]] = value;
  return out;
}

/** Applies a settings change and keeps the class list consistent with it. */
function applyChange(def, style, path, value) {
  let next = setIn(style, path, value);
  const key = path.split('.')[0];
  if (key === 'renderer') {
    // Graduated renderers need a number field; categorized can use any field.
    const numeric = numericFields(def).map((f) => f.key);
    if (['graduated', 'graduatedSize'].includes(value) && numeric.length && !numeric.includes(next.field)) next.field = numeric[0];
  }
  if (path === 'field' && next.renderer !== 'categorized') next.normalizeBy = next.normalizeBy === value ? null : next.normalizeBy;
  if (RECLASSIFY_KEYS.includes(key)) next.classes = buildClasses(def, next);
  // A new ramp recolours every class.
  if (key === 'ramp') next.classes = next.classes.map((c) => ({ ...c, color: null }));
  return next;
}

export const useSymbology = create()(
  persist(
    (set, get) => ({
      styles: clone(DEFAULT_STYLES),
      order: [...DEFAULT_ORDER],
      editing: LAYERS[0].id, // layer open in the Symbology panel
      tab: 'style', // style | label | query
      history: {}, // { layerId: [{ style, path, at }] } (not saved)

      edit: (editing) => set({ editing }),
      setTab: (tab) => set({ tab }),

      /** Replace a layer's style, recording the previous one for undo. */
      commit: (id, style, path = '*') => {
        const prev = get().styles[id];
        const stack = get().history[id] ?? [];
        const top = stack[stack.length - 1];
        const now = Date.now();
        const coalesce = top && top.path === path && path !== '*' && now - top.at < COALESCE_MS;
        const nextStack = coalesce ? [...stack.slice(0, -1), { ...top, at: now }] : [...stack, { style: prev, path, at: now }].slice(-HISTORY);
        set({ styles: { ...get().styles, [id]: style }, history: { ...get().history, [id]: nextStack } });
      },

      /** Change one setting by path, e.g. update('hospitals', 'point.fill', '#ff0000'). */
      update: (id, path, value) => {
        const def = layerById(id);
        get().commit(id, applyChange(def, get().styles[id], path, value), path);
      },

      /** Patch one class of the class list. */
      updateClass: (id, index, patch) => {
        const style = get().styles[id];
        const classes = style.classes.map((c, i) => {
          if (i === index) return { ...c, ...patch };
          // Neighbouring classes stay contiguous: a new lower bound is the previous class's upper bound.
          if ('from' in patch && i === index - 1) return { ...c, to: patch.from };
          if ('to' in patch && i === index + 1) return { ...c, from: patch.to };
          return c;
        });
        // Editing a class range by hand turns the method into manual so the breaks stick.
        const method = 'from' in patch || 'to' in patch ? 'manual' : style.method;
        get().commit(id, { ...style, classes, method }, `classes.${index}.${Object.keys(patch).join(',')}`);
      },

      /** Rebuild the class list from the data (keeps the renderer settings). */
      reclassify: (id) => {
        const def = layerById(id);
        const style = get().styles[id];
        get().commit(id, { ...style, classes: buildClasses(def, { ...style, method: style.method === 'manual' ? 'equal' : style.method }) });
      },

      undo: (id) => {
        const stack = get().history[id] ?? [];
        if (!stack.length) return;
        set({ styles: { ...get().styles, [id]: stack[stack.length - 1].style }, history: { ...get().history, [id]: stack.slice(0, -1) } });
      },

      reset: (id) => get().commit(id, clone(DEFAULT_STYLES[id])),

      /** Copy a style onto another layer of the same geometry; fields it lacks fall back. */
      copyStyle: (from, to) => {
        const def = layerById(to);
        const style = normalizeStyle(def, clone(get().styles[from]));
        if (!renderersFor(def).includes(style.renderer)) style.renderer = DEFAULT_STYLES[to].renderer;
        style.classes = def.fields && !def.fields.some((f) => f.key === get().styles[from].field) ? buildClasses(def, style) : style.classes;
        get().commit(to, style);
      },

      importStyle: (id, style) => get().commit(id, normalizeStyle(layerById(id), style)),

      /** Move a layer one step up (+1) or down (-1) in the draw order. */
      move: (id, dir) => {
        const order = [...get().order];
        const i = order.indexOf(id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= order.length) return;
        [order[i], order[j]] = [order[j], order[i]];
        set({ order });
      },
    }),
    {
      name: 'hs-symbology',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ styles, order, editing }) => ({ styles, order, editing }),
      // Saved styles are completed from today's defaults, so new settings and layers appear
      // without losing what was saved; unknown layers are dropped.
      merge: (saved, current) => {
        const styles = Object.fromEntries(LAYERS.map((def) => [def.id, normalizeStyle(def, saved?.styles?.[def.id])]));
        const kept = (saved?.order ?? []).filter((id) => DEFAULT_ORDER.includes(id));
        const order = [...kept, ...DEFAULT_ORDER.filter((id) => !kept.includes(id))];
        const editing = isStyleable(saved?.editing) ? saved.editing : current.editing;
        return { ...current, styles, order, editing };
      },
    },
  ),
);
