import { LuInfo } from 'react-icons/lu';
import { t } from '../i18n';
import { useSnapshot } from '../lib/mapSnapshot';

/**
 * Collapsed info tile; on hover or focus the attribution row unrolls to the left.
 * label / improveLabel: texts (default: workspace English); className: position.
 */
export function MapAttribution({ label = t.map.attribution, improveLabel = t.map.improveMap, className = 'bottom-2 right-2' }) {
  const LINKS = [
    ['© Mapbox', 'https://www.mapbox.com/about/maps/'],
    ['© OpenStreetMap', 'https://www.openstreetmap.org/copyright'],
    [improveLabel, 'https://apps.mapbox.com/feedback/'],
  ];
  // Snapshots always carry the full attribution, shown expanded without the unroll animation.
  const capturing = useSnapshot((s) => s.capturing);
  return (
    // Clicks do not take focus, so the row only stays open for hover or keyboard focus.
    <div className={`group pointer-events-none absolute z-10 flex h-6 items-stretch ${className}`} onMouseDown={(e) => e.preventDefault()}>
      {/* Same border and fill as the tile; its right edge is the tile's left border. */}
      <div className={`pointer-events-auto flex items-center gap-2 border border-r-0 border-border-strong bg-surface-strong px-2 text-2xs whitespace-nowrap text-muted ${
          capturing ? '[clip-path:inset(0)]' : 'transition-[clip-path] duration-300 ease-out [clip-path:inset(0_0_0_100%)] group-hover:[clip-path:inset(0)] group-has-[:focus-visible]:[clip-path:inset(0)]'
        }`}>
        {LINKS.map(([label, href]) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="hover:text-text">
            {label}
          </a>
        ))}
      </div>
      <button
        type="button"
        aria-label={label}
        title={label}
        className="pointer-events-auto grid w-6 place-items-center border border-border-strong bg-surface-strong text-muted hover:text-text"
      >
        <LuInfo size={12} />
      </button>
    </div>
  );
}
