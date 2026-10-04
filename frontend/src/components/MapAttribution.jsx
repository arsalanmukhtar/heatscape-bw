import { LuInfo } from 'react-icons/lu';
import { t } from '../i18n';

const LINKS = [
  ['© Mapbox', 'https://www.mapbox.com/about/maps/'],
  ['© OpenStreetMap', 'https://www.openstreetmap.org/copyright'],
  [t.map.improveMap, 'https://apps.mapbox.com/feedback/'],
];

/** Collapsed info tile; on hover or focus the attribution row unrolls to the left. */
export function MapAttribution() {
  return (
    // Clicks do not take focus, so the row only stays open for hover or keyboard focus.
    <div className="group pointer-events-none absolute bottom-2 right-2 z-10 flex h-6 items-stretch" onMouseDown={(e) => e.preventDefault()}>
      {/* Same border and fill as the tile; its right edge is the tile's left border. */}
      <div className="pointer-events-auto flex items-center gap-2 border border-r-0 border-border-strong bg-surface-strong px-2 text-2xs whitespace-nowrap text-muted transition-[clip-path] duration-300 ease-out [clip-path:inset(0_0_0_100%)] group-hover:[clip-path:inset(0)] group-has-[:focus-visible]:[clip-path:inset(0)]">
        {LINKS.map(([label, href]) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="hover:text-text">
            {label}
          </a>
        ))}
      </div>
      <button
        type="button"
        aria-label={t.map.attribution}
        title={t.map.attribution}
        className="pointer-events-auto grid w-6 place-items-center border border-border-strong bg-surface-strong text-muted hover:text-text"
      >
        <LuInfo size={12} />
      </button>
    </div>
  );
}
