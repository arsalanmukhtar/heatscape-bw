import { useRef } from 'react';
import { LuChartColumn, LuChevronDown, LuChevronUp, LuChevronsDown, LuChevronsUp, LuClipboardList, LuHistory, LuTable2 } from 'react-icons/lu';
import { t } from '../i18n';
import { DOCK_MIN, useLayout } from '../state/layout';
import { AttributeTable, AttributeTableActions, AttributeTableBadge } from './AttributeTable';
import { ExpandButton, ExpandSlot } from './Expandable';
import { JobsActions, JobsBadges, JobsView } from './JobsView';
import { MeasuresSummary, MeasuresSummaryActions, MeasuresSummaryBadge } from './measures/MeasuresSummary';
import { ResizeHandle } from './ResizeHandle';
import { ScenarioCharts } from './ScenarioCharts';

// Dock tabs: label, icon, badges beside the tab, tab-specific actions and body.
const TABS = {
  table: { label: t.table.title, Icon: LuTable2, Badges: AttributeTableBadge, Actions: AttributeTableActions, Body: AttributeTable },
  jobs: { label: t.jobs.title, Icon: LuHistory, Badges: JobsBadges, Actions: JobsActions, Body: JobsView },
  charts: { label: t.charts.title, Icon: LuChartColumn, Badges: () => null, Actions: () => null, Body: ScenarioCharts },
  summary: { label: t.summary.title, Icon: LuClipboardList, Badges: MeasuresSummaryBadge, Actions: MeasuresSummaryActions, Body: MeasuresSummary },
};

export function BottomDock() {
  const ref = useRef(null);
  const { dockOpen, dockMax, dockH, setDockH, toggleDock, toggleDockMax, dockTab, setDockTab, dragging } = useLayout();
  const tab = TABS[dockTab] ?? TABS.table;
  // The dock tab in focus view is drawn by one stable overlay slot, whichever tab is active,
  // so browsing other tabs (or swapping the focused one) never remounts the overlay.
  const expanded = useLayout((s) => s.expanded);
  const focusedId = expanded?.startsWith('dock-') ? expanded.slice(5) : null;
  const focused = focusedId ? TABS[focusedId] : null;
  // Maximised, the dock takes the whole map area (the map shrinks to nothing but stays mounted).
  const height = dockMax ? '100%' : dockOpen ? (dockH != null ? `${dockH}px` : 'var(--dock-open-h)') : 'var(--dock-bar-h)';

  return (
    <section
      ref={ref}
      aria-label={tab.label}
      className={`relative flex shrink-0 flex-col border-t border-border bg-surface ${dragging ? '' : 'layout-transition'}`}
      style={{ height }}
    >
      {dockOpen && !dockMax && (
        <ResizeHandle
          edge="top"
          label={`Resize ${tab.label}`}
          getSize={() => ref.current?.getBoundingClientRect().height ?? 0}
          onResize={(h) => {
            const max = (ref.current?.parentElement?.getBoundingClientRect().height ?? 800) - 160;
            setDockH(Math.max(DOCK_MIN, Math.min(max, h)));
          }}
          onReset={() => setDockH(null)}
        />
      )}

      <div className="flex shrink-0 items-stretch border-b border-border pr-4" style={{ height: 'var(--dock-bar-h)' }}>
        {/* Compact tabs: smaller type and chips so all four fit beside the tab actions;
            the strip scrolls sideways (no scrollbar) rather than overlapping them. */}
        <div
          role="tablist"
          aria-label="Dock"
          className="flex min-w-0 shrink items-stretch overflow-x-auto [scrollbar-width:none] [&_.level-chip]:w-[var(--dock-chip-w)] [&_.level-chip]:px-1.5 [&_.level-chip]:py-1"
        >
          {Object.entries(TABS).map(([id, { label, Icon, Badges }]) => {
            const active = id === dockTab;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setDockTab(id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-r border-border px-3 leading-none ${
                  active ? 'bg-rail-active font-semibold text-rail-active-text' : 'font-medium text-muted hover:bg-hover hover:text-text'
                }`}
              >
                <Icon size={12} className="shrink-0" aria-hidden />
                <span className="text-2xs uppercase leading-none tracking-[var(--tracking-caps)]">{label}</span>
                <Badges />
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-1 pl-2">
          {dockOpen && <tab.Actions />}
          {dockOpen && <ExpandButton id={`dock-${dockTab}`} keepSpace={false} />}
          <button
            type="button"
            onClick={toggleDockMax}
            aria-label={dockMax ? t.table.restore : t.table.maximize}
            title={dockMax ? t.table.restore : t.table.maximize}
            aria-pressed={dockMax}
            className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text"
          >
            {dockMax ? <LuChevronsDown size={15} /> : <LuChevronsUp size={15} />}
          </button>
          <button
            type="button"
            onClick={toggleDock}
            aria-label={dockOpen ? t.table.collapse : t.table.expand}
            title={dockOpen ? t.table.collapse : t.table.expand}
            className="grid size-7 place-items-center text-muted hover:bg-hover hover:text-text"
          >
            {dockOpen ? <LuChevronDown size={15} /> : <LuChevronUp size={15} />}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col" role="tabpanel" inert={!dockOpen}>
        <ExpandSlot id={`dock-${dockTab}`} title={tab.label} placeholderOnly>
          {(large) => <tab.Body large={large} />}
        </ExpandSlot>
      </div>

      {focused && (
        <ExpandSlot key="dock-focus" id={`dock-${focusedId}`} title={focused.label} actions={<focused.Actions />} overlayOnly>
          {(large) => <focused.Body large={large} />}
        </ExpandSlot>
      )}
    </section>
  );
}
