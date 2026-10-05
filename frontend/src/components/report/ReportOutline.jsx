import { useState } from 'react';
import { LuAlignLeft, LuCircleHelp, LuDatabase, LuFileText, LuGripVertical, LuMap, LuPaperclip, LuPlus, LuTable2, LuX } from 'react-icons/lu';
import { t } from '../../i18n';
import { inLang } from '../../lib/reportContent';
import { SECTION_TYPES, useReports } from '../../state/reports';
import { Select } from '../controls';
import { PanelHeader } from '../SidePanel';

const r = t.report;
export const SECTION_ICON = { title: LuFileText, summary: LuAlignLeft, map: LuMap, indicators: LuTable2, method: LuCircleHelp, sources: LuDatabase, appendix: LuPaperclip };

/*
  Report outline (left panel in the Reports view): sections in print order. Drag a row
  (or Alt+↑/↓ on a focused row) to move it; the title page is pinned first.
*/
export function ReportOutline() {
  const { sections, selectedId, select, removeSection, moveSection, addSection, language } = useReports();
  const [drag, setDrag] = useState(null); // { id, over: index }
  const hasTitle = sections.some((s) => s.type === 'title');
  // Each section type appears once: the menu offers only the ones not in the report yet.
  const addable = SECTION_TYPES.filter((type) => !sections.some((s) => s.type === type));

  const onDrop = () => {
    if (!drag || drag.over == null) return setDrag(null);
    const from = sections.findIndex((s) => s.id === drag.id);
    moveSection(drag.id, drag.over > from ? drag.over - 1 : drag.over);
    setDrag(null);
  };

  return (
    <>
      <PanelHeader title={r.outlineTitle} info={r.outlineInfo} />
      <ol className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        {sections.map((s, i) => {
          const Icon = SECTION_ICON[s.type];
          const pinned = s.type === 'title';
          const active = s.id === selectedId;
          const dropHere = drag && drag.over === i && drag.id !== s.id;
          return (
            <li
              key={s.id}
              draggable={!pinned}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDrag({ id: s.id, over: null });
              }}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                const half = e.currentTarget.getBoundingClientRect();
                const at = e.clientY > half.top + half.height / 2 ? i + 1 : i;
                const min = hasTitle ? 1 : 0;
                if (drag.over !== Math.max(min, at)) setDrag({ ...drag, over: Math.max(min, at) });
              }}
              onDragEnd={() => setDrag(null)}
              className={`group relative mx-2 border-t-2 ${dropHere ? 'border-accent' : 'border-transparent'} ${drag?.id === s.id ? 'opacity-40' : ''}`}
            >
              <div
                role="button"
                tabIndex={0}
                aria-current={active ? 'true' : undefined}
                onClick={() => select(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select(s.id);
                  } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !pinned) {
                    e.preventDefault();
                    moveSection(s.id, i + (e.key === 'ArrowUp' ? -1 : 1));
                  }
                }}
                className={`flex h-10 cursor-pointer items-center gap-2 border px-2 ${active ? 'border-accent-line bg-accent-soft' : 'border-transparent hover:bg-hover'}`}
              >
                <span className={`grid w-3.5 shrink-0 place-items-center ${pinned ? 'invisible' : 'cursor-grab text-faint group-hover:text-muted'}`} title={pinned ? undefined : r.dragHint} aria-hidden>
                  <LuGripVertical size={13} />
                </span>
                <span className="w-4 shrink-0 text-right text-2xs tabular-nums text-muted">{i + 1}</span>
                <Icon size={14} className={`shrink-0 ${active ? 'text-accent' : 'text-muted'}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-text">{inLang(s.title, language) ?? r.types[s.type]}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSection(s.id);
                  }}
                  aria-label={`${r.removeSection}: ${r.types[s.type]}`}
                  title={r.removeSection}
                  className="grid size-6 shrink-0 place-items-center text-muted opacity-0 hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <LuX size={13} />
                </button>
              </div>
            </li>
          );
        })}
        {/* Drop target after the last row. */}
        <li
          aria-hidden
          className={`mx-2 h-6 border-t-2 ${drag && drag.over === sections.length ? 'border-accent' : 'border-transparent'}`}
          onDragOver={(e) => {
            if (!drag) return;
            e.preventDefault();
            if (drag.over !== sections.length) setDrag({ ...drag, over: sections.length });
          }}
        />
      </ol>
      <div className="shrink-0 border-t border-border px-4 py-3">
        {addable.length === 0 ? (
          <p className="flex h-7 items-center text-xs text-muted">
            <span>{r.allAdded}</span>
          </p>
        ) : (
          <Select
            value={null}
            onChange={addSection}
            label={r.addSection}
            options={addable.map((type) => {
              const Icon = SECTION_ICON[type];
              return { value: type, label: r.types[type], icon: <Icon size={13} className="shrink-0 text-muted" /> };
            })}
            renderValue={() => (
              <>
                <LuPlus size={12} className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{r.addSection}</span>
              </>
            )}
          />
        )}
      </div>
    </>
  );
}
