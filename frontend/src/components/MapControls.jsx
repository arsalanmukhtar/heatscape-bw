import { useEffect, useRef, useState } from 'react';
import { LuCamera, LuChevronUp, LuColumns2, LuEarth, LuGrid2X2, LuMagnet, LuMapPinned, LuMinus, LuMousePointerClick, LuPlus, LuRuler } from 'react-icons/lu';
import { useMap } from 'react-map-gl/mapbox';
import { t } from '../i18n';
import { BW_BOUNDS, WORLD_VIEW } from '../lib/geo';
import { SNAPSHOT_EXCLUDE, captureMap, useSnapshot } from '../lib/mapSnapshot';
import { useLayout } from '../state/layout';
import { useScenarios } from '../state/scenarios';
import { useWorkspace } from '../state/workspace';
import { BasemapButton, BasemapList } from './BasemapControl';
import { ControlPopover } from './ControlPopover';

const FLY = { duration: 1200, essential: true };
const STAGGER_MS = 40;

export function MapControls({ disabled, canCompare }) {
  const { main } = useMap();
  const { tools, toggleTool, snap, toggleSnap } = useWorkspace();
  const { compare, toggleCompare } = useScenarios();
  const { mapControlsOpen: open, toggleMapControls } = useLayout();
  const capturing = useSnapshot((s) => s.capturing);
  // One panel at a time; panels open from the top of the column (see ControlPopover).
  const [panel, setPanel] = useState(null);
  const columnRef = useRef(null);
  const togglePanel = (id) => setPanel((p) => (p === id ? null : id));

  useEffect(() => {
    if (!panel) return;
    const close = (e) => !columnRef.current?.contains(e.target) && setPanel(null);
    const esc = (e) => e.key === 'Escape' && setPanel(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [panel]);

  // Folding the column closes any open panel.
  useEffect(() => {
    if (!open) setPanel(null);
  }, [open]);

  const groups = [
    <Group key="zoom">
      <ControlButton label={t.map.zoomIn} disabled={disabled} onClick={() => main?.zoomIn()}>
        <LuPlus size={14} />
      </ControlButton>
      <ControlButton label={t.map.zoomOut} disabled={disabled} onClick={() => main?.zoomOut()}>
        <LuMinus size={14} />
      </ControlButton>
    </Group>,
    <Group key="extent">
      <ControlButton label={t.map.zoomWorld} disabled={disabled} onClick={() => main?.flyTo({ ...WORLD_VIEW, ...FLY })}>
        <LuEarth size={13} />
      </ControlButton>
      <ControlButton label={t.map.zoomBW} disabled={disabled} onClick={() => main?.fitBounds(BW_BOUNDS, { padding: 40, ...FLY })}>
        <LuMapPinned size={13} />
      </ControlButton>
    </Group>,
    <Group key="tools">
      {/* The magnet slides out beside the ruler while it is on and toggles vertex snapping. */}
      <div className="relative">
        <ControlButton label={t.map.measure} active={tools.measure} disabled={disabled} onClick={() => toggleTool('measure')}>
          <LuRuler size={13} />
        </ControlButton>
        <div
          inert={!tools.measure}
          className="absolute right-full top-[-1px] mr-1.5 border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)] backdrop-blur-md transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ opacity: tools.measure ? 1 : 0, transform: tools.measure ? 'none' : 'translateX(10px) scale(0.85)', pointerEvents: tools.measure ? 'auto' : 'none' }}
        >
          <ControlButton label={t.map.snap} active={snap} onClick={toggleSnap}>
            <LuMagnet size={13} />
          </ControlButton>
        </div>
      </div>
      <ControlButton label={t.map.select} active={tools.select} disabled={disabled} onClick={() => toggleTool('select')}>
        <LuMousePointerClick size={13} />
      </ControlButton>
      <ControlButton label={t.map.grid} active={tools.grid} disabled={disabled} onClick={() => toggleTool('grid')}>
        <LuGrid2X2 size={13} />
      </ControlButton>
    </Group>,
    <BasemapButton key="basemap" open={panel === 'basemap'} disabled={disabled} onToggle={() => togglePanel('basemap')} />,
    canCompare && (
      <Group key="compare">
        <ControlButton label={t.map.compare} active={compare} disabled={disabled} onClick={toggleCompare}>
          <LuColumns2 size={13} />
        </ControlButton>
      </Group>
    ),
    <Group key="snapshot">
      <ControlButton label={t.map.snapshot} disabled={disabled || capturing} onClick={captureMap}>
        <LuCamera size={13} className={capturing ? 'animate-pulse' : undefined} />
      </ControlButton>
    </Group>,
  ].filter(Boolean);
  const n = groups.length;

  return (
    // Spans the map height (pointer-events off) so panels can use it all; controls opt back in.
    <div ref={columnRef} className="pointer-events-none absolute bottom-3 right-3 top-3 z-10 flex flex-col gap-2" {...SNAPSHOT_EXCLUDE}>
      <div className="pointer-events-auto">
        <Group>
          <button
            type="button"
            onClick={toggleMapControls}
            aria-expanded={open}
            aria-label={open ? t.map.controlsHide : t.map.controlsShow}
            title={open ? t.map.controlsHide : t.map.controlsShow}
            className="grid h-5 w-7 place-items-center text-muted hover:bg-hover hover:text-text"
          >
            <LuChevronUp size={13} className="transition-transform duration-300 ease-out" style={{ transform: open ? 'none' : 'rotate(180deg)' }} />
          </button>
        </Group>
      </div>

      {/* Fold into the chevron: groups slide up and fade in sequence, bottom group first
          on collapse and top group first on expand. */}
      <div className="flex flex-col gap-2" inert={!open}>
        {groups.map((g, i) => (
          <div
            key={g.key}
            className="transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{
              opacity: open ? 1 : 0,
              transform: open ? 'none' : `translateY(${-(i + 1) * 10}px) scale(0.92)`,
              transitionDelay: `${(open ? i : n - 1 - i) * STAGGER_MS}ms`,
              pointerEvents: open ? 'auto' : 'none',
            }}
          >
            {g}
          </div>
        ))}
      </div>

      <ControlPopover open={panel === 'basemap'} label={t.map.basemap}>
        {(shown) => <BasemapList shown={shown} />}
      </ControlPopover>
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
