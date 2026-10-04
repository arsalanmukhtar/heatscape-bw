import { LuCircleHelp, LuFileText, LuFilter, LuLayers, LuSettings } from 'react-icons/lu';
import { t } from '../i18n';
import { useLayout } from '../state/layout';

export function LeftRail() {
  const { leftOpen, leftSection, openSection } = useLayout();
  const item = (id, label, icon) => (
    <RailButton key={id} label={label} active={leftOpen && leftSection === id} onClick={() => openSection(id)}>
      {icon}
    </RailButton>
  );

  return (
    <aside className="flex shrink-0 flex-col items-center border-r border-border bg-bg-deep py-2" style={{ width: 'var(--rail-w)' }} aria-label="Data and tools">
      <div role="toolbar" aria-orientation="vertical" className="flex flex-col items-center gap-1">
        {item('layers', t.rail.layers, <LuLayers size={16} />)}
        {item('filters', t.rail.filters, <LuFilter size={16} />)}
        {item('reports', t.rail.reports, <LuFileText size={16} />)}
        <span className="my-2 h-px w-6 bg-border" aria-hidden />
        {item('settings', t.rail.settings, <LuSettings size={16} />)}
      </div>
      <div className="mt-auto">
        <RailButton label={t.rail.help} onClick={() => undefined}>
          <LuCircleHelp size={16} />
        </RailButton>
      </div>
    </aside>
  );
}

function RailButton({ label, active, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`grid size-9 place-items-center border transition-colors ${
        active ? 'border-accent-line bg-rail-active text-rail-active-text' : 'border-transparent text-muted hover:bg-hover hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
