import { useState } from 'react';
import { LuInfo } from 'react-icons/lu';
import { t } from '../i18n';
import { ATTRIBUTIONS, basemapAttributions, credit, uniqueKeys } from '../lib/attribution';
import { useSnapshot } from '../lib/mapSnapshot';

/**
 * Collapsed info tile; on hover or focus the attribution row unrolls to the left (and wraps
 * when it is long). sources: provider keys (lib/attribution.js) of the data on the map, after
 * the basemap's own; lang: language of the credit lines. label / improveLabel: texts
 * (default: workspace English); className / style: position.
 */
export function MapAttribution({ sources = basemapAttributions(), lang = 'en', label = t.map.attribution, improveLabel = t.map.improveMap, className = 'bottom-2 right-2', style }) {
  const LINKS = [
    ...uniqueKeys(sources).map((k) => [credit(k, lang), ATTRIBUTIONS[k].url ?? ATTRIBUTIONS[k].licenceUrl]),
    [improveLabel, 'https://apps.mapbox.com/feedback/'],
  ];
  // Snapshots always carry the full attribution, shown expanded without the unroll animation.
  const capturing = useSnapshot((s) => s.capturing);
  // A click (or tap: touch screens have no hover) pins the row open until the next click.
  const [pinned, setPinned] = useState(false);
  return (
    // Clicks do not take focus, so the row stays open for hover, keyboard focus or a pin.
    <div className={`group pointer-events-none absolute z-10 flex items-end ${className}`} style={style} onMouseDown={(e) => e.preventDefault()}>
      {/* Same border and fill as the tile; its right edge is the tile's left border. */}
      <div className={`pointer-events-auto flex min-h-6 max-w-[min(46rem,calc(100vw-5rem))] flex-wrap items-center justify-end gap-x-2 gap-y-0.5 border border-r-0 border-border-strong bg-surface-strong px-2 py-0.5 text-2xs text-muted ${
          capturing || pinned ? '[clip-path:inset(0)]' : 'transition-[clip-path] duration-300 ease-out [clip-path:inset(0_0_0_100%)] group-hover:[clip-path:inset(0)] group-has-[:focus-visible]:[clip-path:inset(0)]'
        }`}>
        {LINKS.map(([label, href]) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap hover:text-text">
            {label}
          </a>
        ))}
      </div>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pinned}
        title={label}
        onClick={() => setPinned(!pinned)}
        className="pointer-events-auto grid size-6 shrink-0 place-items-center border border-border-strong bg-surface-strong text-muted hover:text-text"
      >
        <LuInfo size={12} />
      </button>
    </div>
  );
}
