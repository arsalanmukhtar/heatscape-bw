import { LuGrid2X2, LuMinus, LuMousePointerClick, LuPlus, LuRuler } from 'react-icons/lu';
import { useMap } from 'react-map-gl/mapbox';
import { t } from '../i18n';
import { useWorkspace } from '../state/workspace';

export function MapControls({ disabled }) {
  const { main } = useMap();
  const { tools, toggleTool } = useWorkspace();

  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
      <Group>
        <ControlButton label={t.map.zoomIn} disabled={disabled} onClick={() => main?.zoomIn()}>
          <LuPlus size={14} />
        </ControlButton>
        <ControlButton label={t.map.zoomOut} disabled={disabled} onClick={() => main?.zoomOut()}>
          <LuMinus size={14} />
        </ControlButton>
      </Group>
      <Group>
        <ControlButton label={t.map.measure} active={tools.measure} disabled={disabled} onClick={() => toggleTool('measure')}>
          <LuRuler size={13} />
        </ControlButton>
        <ControlButton label={t.map.select} active={tools.select} disabled={disabled} onClick={() => toggleTool('select')}>
          <LuMousePointerClick size={13} />
        </ControlButton>
        <ControlButton label={t.map.grid} active={tools.grid} disabled={disabled} onClick={() => toggleTool('grid')}>
          <LuGrid2X2 size={13} />
        </ControlButton>
      </Group>
    </div>
  );
}

function Group({ children }) {
  return (
    <div role="toolbar" aria-orientation="vertical" className="flex flex-col divide-y divide-border-soft border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)] backdrop-blur-md">
      {children}
    </div>
  );
}

function ControlButton({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-7 place-items-center transition-colors disabled:opacity-50 ${active ? 'bg-accent-soft text-accent' : 'text-text hover:bg-hover'}`}
    >
      {children}
    </button>
  );
}
