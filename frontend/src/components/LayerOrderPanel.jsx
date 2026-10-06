import { useEffect, useState } from 'react';
import { HiSortAscending } from 'react-icons/hi';
import { LuGripVertical, LuX } from 'react-icons/lu';
import { t } from '../i18n';
import { resolveColor } from '../lib/color';
import { legendFor } from '../lib/legend';
import { layerById } from '../lib/layers';
import { SNAPSHOT_EXCLUDE } from '../lib/mapSnapshot';
import { useLayout } from '../state/layout';
import { useSymbology } from '../state/symbology';
import { useWorkspace } from '../state/workspace';
import { OverflowText } from './OverflowText';
import { SearchBar, SearchEmpty } from './SearchBar';

const o = t.layers.order;
const labelOf = (id) => layerById(id)?.label ?? t.layers[id] ?? id;
const PRIORITY = [2, 4, 5, 7, 9].map((k) => `var(--vuln-${k})`); // scenario priority overlay classes

/**
 * Fill of a layer's dot, from its symbology (the legend): one colour → solid; a ramp →
 * diagonal gradient; several classes → equal slices around the dot. Outline-only areas use
 * their outline colour.
 */
function dotFill(def, style) {
  if (!def) return `conic-gradient(${PRIORITY.join(', ')}, ${PRIORITY[0]})`;
  if (def.geometry === 'polygon' && style.polygon.noFill && style.renderer === 'single') return resolveColor(style.polygon.outline);
  const legend = legendFor(def, style);
  if (legend.ramp) return `linear-gradient(135deg, ${legend.ramp.colors.join(', ')})`;
  const colors = (legend.items ?? []).map((x) => x.swatch?.color).filter(Boolean);
  if (colors.length <= 1) return colors[0] ?? 'var(--text-muted)';
  const step = 100 / colors.length;
  return `conic-gradient(${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}

/*
  Layer order (map overlay under the address search, opened from the Layers panel header):
  the layers shown on the map in drawing order, top of the list = drawn on top; each row is
  a drag handle, a dot coloured from the layer's symbology and the name. Drag a row (or Alt+↑/↓ on a
  focused row) to restack; the map follows at once (symbology order, saved). The search only
  narrows the list; a drop lands relative to the visible row it is dropped on. Expands and
  collapses with a height, fade and rise transition.
*/
export function LayerOrderPanel() {
  const open = useLayout((s) => s.layerOrderOpen);
  const toggle = useLayout((s) => s.toggleLayerOrder);
  const { order, setOrder, move, styles } = useSymbology();
  const layers = useWorkspace((s) => s.layers);
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState(null); // { id, before: id | null (end) | undefined (no target) }

  // Esc closes the panel (its button is an open overlay, so Esc does not clear the map first).
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === 'Escape' && toggle();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, toggle]);

  const display = [...order].reverse(); // top first
  const q = query.trim().toLowerCase();
  // Only layers shown on the map.
  const shown = display.filter((id) => layers[id] && (!q || labelOf(id).toLowerCase().includes(q)));

  // Puts id right above `before` in the list (null: at the bottom), then back to bottom→top.
  const drop = (id, before) => {
    const list = display.filter((x) => x !== id);
    const at = before == null ? list.length : list.indexOf(before);
    list.splice(at < 0 ? list.length : at, 0, id);
    setOrder(list.reverse());
  };
  const onDrop = () => {
    if (drag && drag.before !== undefined && drag.before !== drag.id) drop(drag.id, drag.before);
    setDrag(null);
  };

  return (
    <div
      className="absolute left-3 top-[3.25rem] z-[19] grid w-56 transition-[grid-template-rows,opacity,translate] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0, translate: open ? '0 0' : '0 -0.5rem', pointerEvents: open ? 'auto' : 'none' }}
      aria-hidden={!open}
      inert={!open}
      {...SNAPSHOT_EXCLUDE}
    >
      <div className="min-h-0 overflow-hidden">
        <section aria-label={o.title} className="flex max-h-[min(30rem,calc(100vh-14rem))] flex-col border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)]">
          <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border pl-3 pr-1.5">
            <HiSortAscending size={15} className="shrink-0 text-accent" aria-hidden />
            <h2 className="label-caps min-w-0 flex-1 truncate">{o.title}</h2>
            <button type="button" onClick={toggle} aria-label={o.close} title={o.close} className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text">
              <LuX size={14} />
            </button>
          </header>
          <div className="shrink-0 px-2.5 pt-2.5">
            <SearchBar value={query} onChange={setQuery} placeholder={o.search} className="w-full" />
          </div>
          {shown.length === 0 ? (
            <SearchEmpty>{o.empty}</SearchEmpty>
          ) : (
            <ol className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5 pt-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
              {shown.map((id, i) => {
                const target = drag && drag.id !== id && drag.before === id;
                return (
                  <li
                    key={id}
                    tabIndex={0}
                    draggable
                    aria-label={`${labelOf(id)}, ${o.position(i + 1, shown.length)}`}
                    title={o.drag}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', id);
                      setDrag({ id, before: undefined });
                    }}
                    onDragOver={(e) => {
                      if (!drag) return;
                      e.preventDefault();
                      // Upper half: drop above this row; lower half: above the next one.
                      const r = e.currentTarget.getBoundingClientRect();
                      const before = e.clientY < r.top + r.height / 2 ? id : (shown[i + 1] ?? null);
                      if (drag.before !== before) setDrag({ ...drag, before });
                    }}
                    onDragEnd={() => setDrag(null)}
                    onKeyDown={(e) => {
                      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                      e.preventDefault();
                      move(id, e.key === 'ArrowUp' ? 1 : -1);
                    }}
                    className={`group relative mt-1 flex h-8 cursor-grab items-center gap-2 border bg-field pl-1 pr-2 transition-[opacity,background-color,border-color] duration-150 active:cursor-grabbing ${
                      drag?.id === id ? 'border-accent-line opacity-40' : 'border-border hover:border-border-strong hover:bg-hover'
                    }`}
                  >
                    {/* Drop line above the row it will land on. */}
                    <span className={`pointer-events-none absolute -top-[0.1875rem] left-0 right-0 h-0.5 bg-accent transition-opacity duration-100 ${target ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
                    <LuGripVertical size={14} className="shrink-0 text-faint group-hover:text-muted" aria-hidden />
                    {/* Round by clip-path (the square rule zeroes radii); inner ring keeps light fills visible. */}
                    <span
                      className="size-2.5 shrink-0 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--text)_25%,transparent)]"
                      style={{ background: dotFill(layerById(id), styles[id]), clipPath: 'circle(50%)' }}
                      aria-hidden
                    />
                    <OverflowText className="flex-1 text-xs text-text">{labelOf(id)}</OverflowText>
                  </li>
                );
              })}
              {/* Drop zone under the last row: to the bottom of the stack. */}
              <li
                aria-hidden
                className={`mt-1 h-3 border-t-2 ${drag && drag.before === null ? 'border-accent' : 'border-transparent'}`}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  if (drag.before !== null) setDrag({ ...drag, before: null });
                }}
              />
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

/** Layers panel header button that opens and closes the layer order overlay. */
export function LayerOrderButton() {
  const open = useLayout((s) => s.layerOrderOpen);
  const toggle = useLayout((s) => s.toggleLayerOrder);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-label={open ? o.close : o.open}
      title={open ? o.close : o.open}
      className={`grid size-7 place-items-center hover:bg-hover ${open ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text'}`}
    >
      <HiSortAscending size={15} />
    </button>
  );
}
