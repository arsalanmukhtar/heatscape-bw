import { useEffect, useState } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import { t } from '../i18n';
import { scaleBar } from '../lib/geo';

/** Minimal scale bar: a bracket line and its distance, no box; a halo keeps it legible on any basemap. */
export function MapScale() {
  const { main } = useMap();
  const [view, setView] = useState(null);

  useEffect(() => {
    if (!main) return;
    const sync = () => setView({ lat: main.getCenter().lat, zoom: main.getZoom() });
    sync();
    main.on('move', sync);
    return () => main.off('move', sync);
  }, [main]);

  if (!view) return null;
  const scale = scaleBar(view.lat, view.zoom, 60);

  return (
    <div
      className="pointer-events-none absolute bottom-2.5 left-2.5 z-10 flex items-end gap-1 [filter:drop-shadow(0_0_1px_var(--bg))_drop-shadow(0_0_1px_var(--bg))]"
      role="img"
      aria-label={`${t.map.scale} ${scale.label}`}
    >
      <span className="h-1 border-x-2 border-b-2 border-text" style={{ width: scale.px }} aria-hidden />
      <span className="font-mono text-[0.625rem] font-semibold leading-none text-text">{scale.label}</span>
    </div>
  );
}
