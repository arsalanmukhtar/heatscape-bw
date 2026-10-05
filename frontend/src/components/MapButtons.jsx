import { useEffect, useState } from 'react';
import { TbMapNorth } from 'react-icons/tb';

/*
  Compact map control pieces (28 px), shared by the workspace map controls and the public
  Heat Portal: a bordered group, a square button, and the north reset.
*/

/** Resets bearing and pitch; the icon turns with the map, so it doubles as a compass. */
export function NorthButton({ map, label, disabled }) {
  const [bearing, setBearing] = useState(0);
  useEffect(() => {
    const m = map?.getMap();
    if (!m) return;
    const update = () => setBearing(m.getBearing());
    update();
    m.on('rotate', update);
    return () => m.off('rotate', update);
  }, [map]);
  return (
    <ControlButton label={label} disabled={disabled} onClick={() => map?.getMap().resetNorthPitch({ duration: 500 })}>
      <TbMapNorth size={14} style={{ transform: `rotate(${-bearing}deg)` }} aria-hidden />
    </ControlButton>
  );
}

export function Group({ children }) {
  return (
    <div role="toolbar" aria-orientation="vertical" className="flex flex-col divide-y divide-border-soft border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)] backdrop-blur-md">
      {children}
    </div>
  );
}

export function ControlButton({ label, active, disabled, onClick, children }) {
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
