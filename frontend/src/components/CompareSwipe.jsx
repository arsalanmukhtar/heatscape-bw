import { useEffect, useMemo, useRef } from 'react';
import MapGL, { Layer, Source, useMap } from 'react-map-gl/mapbox';
import { LuChevronsLeftRight } from 'react-icons/lu';
import { SURFACE_GRID } from '../data/mock';
import { t } from '../i18n';
import { MAP_PROJECTION, MAPBOX_TOKEN, heatStops } from '../lib/mapStyle';
import { scenarioGrid } from '../lib/scenario';
import { useMapResize } from '../lib/useMapResize';
import { useMapStyleUrl } from '../state/basemap';
import { useScenarios } from '../state/scenarios';
import { useTheme } from '../state/theme';

/*
  Swipe compare: a second, non-interactive map with the scenario LST sits over the main
  map, clipped to the right of the handle and following the main map's camera. Left of the
  handle is the current state on the main map.
*/
export function CompareSwipe({ ranking }) {
  const { main, compare } = useMap();
  const resolved = useTheme((s) => s.resolved);
  const styleUrl = useMapStyleUrl();
  const { swipe, setSwipe } = useScenarios();
  const wrapRef = useRef(null);
  const grid = useMemo(() => scenarioGrid(SURFACE_GRID, ranking.rows), [ranking]);
  const stops = useMemo(() => heatStops(), [resolved]);
  useMapResize(wrapRef, compare);

  // Follow the main map's camera.
  useEffect(() => {
    if (!main || !compare) return;
    const sync = () => compare.jumpTo({ center: main.getCenter(), zoom: main.getZoom(), bearing: main.getBearing(), pitch: main.getPitch() });
    sync();
    main.on('move', sync);
    return () => main.off('move', sync);
  }, [main, compare]);

  const dragTo = (clientX) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (box) setSwipe(((clientX - box.left) / box.width) * 100);
  };

  const view = main ? { longitude: main.getCenter().lng, latitude: main.getCenter().lat, zoom: main.getZoom() } : undefined;

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 z-[5]">
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${swipe}%)` }}>
        <MapGL id="compare" mapboxAccessToken={MAPBOX_TOKEN} initialViewState={view} mapStyle={styleUrl} projection={MAP_PROJECTION} interactive={false} attributionControl={false} style={{ width: '100%', height: '100%' }}>
          <Source id="lst-scenario" type="geojson" data={grid}>
            <Layer id="lst-scenario-fill" type="fill" paint={{ 'fill-color': ['interpolate', ['linear'], ['get', 't'], ...stops], 'fill-opacity': 0.72 }} />
          </Source>
        </MapGL>
      </div>

      <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-text" style={{ left: `${swipe}%` }}>
        <button
          type="button"
          role="slider"
          aria-label={t.map.swipeHandle}
          aria-valuemin={5}
          aria-valuemax={95}
          aria-valuenow={Math.round(swipe)}
          title={t.map.swipeHandle}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragTo(e.clientX);
          }}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && dragTo(e.clientX)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setSwipe(swipe - 2);
            if (e.key === 'ArrowRight') setSwipe(swipe + 2);
          }}
          className="pointer-events-auto absolute left-1/2 top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center border border-border-strong bg-surface-strong text-text shadow-[var(--shadow-glass)]"
        >
          <LuChevronsLeftRight size={14} />
        </button>
        <span className="absolute bottom-10 right-2 flex h-6 items-center whitespace-nowrap border border-border-strong bg-surface-strong px-2 text-2xs font-medium text-text">
          <span>{t.map.compareCurrent}</span>
        </span>
        <span className="absolute bottom-10 left-2 flex h-6 items-center gap-1.5 whitespace-nowrap border border-border-strong bg-surface-strong px-2 text-2xs font-medium text-text">
          <span>{t.map.compareScenario}</span>
          <span className="level-chip uppercase" style={{ '--chip': 'var(--level-screening)' }}>
            {t.ranking.indicative}
          </span>
        </span>
      </div>
    </div>
  );
}
