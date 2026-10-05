import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Layer, Marker, Source, useMap } from 'react-map-gl/mapbox';
import { LuX } from 'react-icons/lu';
import { BLOCKS, REGION, SURFACE_GRID, blockBounds, blockById } from '../data/mock';
import { t } from '../i18n';
import { cssVar, distanceKm } from '../lib/css';
import { LAYERS } from '../lib/layers';
import { addGeneratedImage } from '../lib/mapImages';
import { MAP_FOG, MAP_PROJECTION, MAPBOX_TOKEN as TOKEN, addHatchImage } from '../lib/mapStyle';
import { MAP_CONTAINER_ID, SNAPSHOT_EXCLUDE } from '../lib/mapSnapshot';
import { candidateFootprint } from '../lib/scenario';
import { buildLayerSpec } from '../lib/symbology';
import { useMapResize } from '../lib/useMapResize';
import { useLayout } from '../state/layout';
import { useMapStyleUrl } from '../state/basemap';
import { useActiveRanking, useScenarios } from '../state/scenarios';
import { useSymbology } from '../state/symbology';
import { useTheme } from '../state/theme';
import { useWorkspace } from '../state/workspace';
import { CompareSwipe } from './CompareSwipe';
import { MAP_OVERLAY_ID } from './Expandable';
import { Geocoder, SearchPin } from './Geocoder';
import { MapAttribution } from './MapAttribution';
import { MapControls } from './MapControls';
import { MapScale } from './MapScale';

// Overlay layers stay above every data layer; the first of them anchors the draw order.
const OVERLAY_ANCHOR = 'grid-line';
const PRIORITY_IDS = ['priority-fill', 'priority-hatch', 'priority-line'];

export function MapView() {
  const containerRef = useRef(null);
  const { main } = useMap();

  const ranking = useActiveRanking();
  const compare = useScenarios((x) => x.compare);
  useMapResize(containerRef, main);

  return (
    <div ref={containerRef} id={MAP_CONTAINER_ID} className="relative min-h-0 flex-1 overflow-hidden bg-map-ground">
      {TOKEN ? <LiveMap /> : <MapPlaceholder />}
      {TOKEN && compare && ranking && <CompareSwipe ranking={ranking} />}
      <Geocoder disabled={!TOKEN} />
      <MapControls disabled={!TOKEN} canCompare={!!ranking} />
      {TOKEN && <MapScale />}
      {TOKEN && <MapAttribution />}
      {/* Expanded tables and charts render here, above map and controls (see Expandable). */}
      <div id={MAP_OVERLAY_ID} className="pointer-events-none absolute inset-0 z-30" {...SNAPSHOT_EXCLUDE} />
    </div>
  );
}

function LiveMap() {
  const { main } = useMap();
  const resolved = useTheme((s) => s.resolved);
  const styleUrl = useMapStyleUrl();
  const { layers, selectedId, select, tools } = useWorkspace();
  const { styles, order } = useSymbology();
  const [measure, setMeasure] = useState([]);
  const selected = blockById(selectedId);
  const firstSelection = useRef(true);

  // Literal colours for the overlays' paint properties, re-read when the theme changes.
  const palette = useMemo(
    () => ({
      accent: cssVar('--accent'),
      line: cssVar('--map-line'),
      text: cssVar('--text'),
      surface: cssVar('--surface-strong'),
      // Priority classes 1–5 on the vulnerability ramp (light → dark = low → high priority).
      priority: [2, 4, 5, 7, 9].map((k) => cssVar(`--vuln-${k}`)),
    }),
    [resolved],
  );

  // Styleable layers, drawn from their symbology (lib/symbology.js). Token colours are
  // resolved at build time, so the theme is a dependency.
  const specs = useMemo(
    () => Object.fromEntries(LAYERS.map((def) => [def.id, buildLayerSpec(def, styles[def.id], !!layers[def.id])])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [styles, layers, resolved],
  );

  // Scenario priority: shown while the scenario workspace (left panel or ranking view) is in use.
  const ranking = useActiveRanking();
  const scenarioContext = useLayout((s) => s.leftSection === 'scenarios' || s.rightView === 'ranking');
  const showPriority = scenarioContext && layers.priority;
  const candidates = useMemo(() => (ranking ? { type: 'FeatureCollection', features: ranking.rows.map(candidateFootprint) } : null), [ranking]);

  // Images are dropped on every style change (theme or basemap switch), so they are drawn on
  // demand: the priority hatch and every generated marker and fill pattern (lib/mapImages.js).
  useEffect(() => {
    const map = main?.getMap();
    if (!map) return;
    const onMissing = (e) => (e.id === 'unc-hatch' ? addHatchImage(map) : addGeneratedImage(map, e.id));
    const onLoad = () => addHatchImage(map);
    map.on('styleimagemissing', onMissing);
    map.on('style.load', onLoad);
    if (map.isStyleLoaded()) addHatchImage(map);
    return () => {
      map.off('styleimagemissing', onMissing);
      map.off('style.load', onLoad);
    };
  }, [main]);

  // Draw order: the data layers stack in the user's order (symbology store), all below the
  // overlays (grid, selection, measure). Layers are added on top when created, so the order
  // is re-applied after every style change; it only moves layers that are out of place.
  const stack = useMemo(() => order.flatMap((id) => (id === 'priority' ? PRIORITY_IDS : (specs[id]?.layers.map((l) => l.id) ?? []))), [order, specs]);
  useEffect(() => {
    const map = main?.getMap();
    if (!map) return;
    const apply = () => {
      let ids;
      try {
        ids = map.getStyle()?.layers?.map((l) => l.id);
      } catch {
        return;
      }
      if (!ids) return;
      const pos = new Map(ids.map((id, i) => [id, i]));
      const present = stack.filter((id) => pos.has(id));
      const anchor = pos.has(OVERLAY_ANCHOR) ? OVERLAY_ANCHOR : undefined;
      const limit = anchor ? pos.get(anchor) : Infinity;
      const inPlace = present.every((id, i) => pos.get(id) < limit && (i === 0 || pos.get(present[i - 1]) < pos.get(id)));
      if (!inPlace) present.forEach((id) => map.moveLayer(id, anchor));
    };
    apply();
    map.on('styledata', apply);
    return () => map.off('styledata', apply);
  }, [main, stack]);

  // Fly to a block when it is picked from the table (not on first load).
  useEffect(() => {
    if (firstSelection.current) {
      firstSelection.current = false;
      return;
    }
    main?.fitBounds(blockBounds(selected), { padding: 140, maxZoom: 14, duration: 800 });
  }, [selected, main]);

  useEffect(() => {
    if (!tools.measure) setMeasure([]);
  }, [tools.measure]);

  const selection = useMemo(() => {
    const [[w, s], [e, n]] = blockBounds(selected);
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } };
  }, [selected]);

  const measureKm = measure.slice(1).reduce((sum, p, i) => sum + distanceKm(measure[i], p), 0);
  const measureLine = useMemo(() => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: measure } }), [measure]);

  const vis = (on) => (on ? 'visible' : 'none');
  const [[west], [, north]] = blockBounds(selected);
  const lastPoint = measure[measure.length - 1];

  return (
    <MapGL
      id="main"
      mapboxAccessToken={TOKEN}
      initialViewState={{ longitude: REGION.center[0], latitude: REGION.center[1], zoom: 12.2 }}
      mapStyle={styleUrl}
      projection={MAP_PROJECTION}
      fog={MAP_FOG}
      preserveDrawingBuffer // keeps the last frame readable for map snapshots
      attributionControl={false}
      style={{ width: '100%', height: '100%' }}
      cursor={tools.measure ? 'crosshair' : tools.select ? 'pointer' : 'grab'}
      onClick={(e) => {
        const p = [e.lngLat.lng, e.lngLat.lat];
        if (tools.measure) {
          setMeasure((m) => [...m, p]);
          return;
        }
        if (!tools.select) return;
        // Pick the nearest block within 1.5 km of the click.
        const nearest = BLOCKS.map((b) => ({ b, km: distanceKm(b.center, p) })).sort((x, y) => x.km - y.km)[0];
        if (nearest && nearest.km < 1.5) select(nearest.b.id);
      }}
    >
      {LAYERS.map((def) => {
        const spec = specs[def.id];
        return (
          <Source key={spec.sourceKey} id={spec.sourceId} {...spec.source}>
            {spec.layers.map((l) => (
              <Layer key={l.id} {...l} />
            ))}
          </Source>
        );
      })}

      {candidates && (
        <Source id="priority" type="geojson" data={candidates}>
          <Layer
            id="priority-fill"
            type="fill"
            layout={{ visibility: vis(showPriority) }}
            paint={{
              'fill-color': ['match', ['get', 'priority'], 1, palette.priority[0], 2, palette.priority[1], 3, palette.priority[2], 4, palette.priority[3], palette.priority[4]],
              'fill-opacity': 0.88,
            }}
          />
          <Layer id="priority-hatch" type="fill" filter={['==', ['get', 'unstable'], true]} layout={{ visibility: vis(showPriority) }} paint={{ 'fill-pattern': 'unc-hatch' }} />
          <Layer id="priority-line" type="line" layout={{ visibility: vis(showPriority) }} paint={{ 'line-color': palette.surface, 'line-width': 1 }} />
        </Source>
      )}

      {/* Overlays, always above the data layers; the grid line is the anchor they stack under. */}
      <Source id="grid" type="geojson" data={SURFACE_GRID}>
        <Layer id={OVERLAY_ANCHOR} type="line" layout={{ visibility: vis(tools.grid) }} paint={{ 'line-color': palette.line, 'line-width': 0.5 }} />
      </Source>

      <Source id="selection" type="geojson" data={selection}>
        <Layer id="selection-fill" type="fill" layout={{ visibility: vis(layers.selection) }} paint={{ 'fill-color': palette.accent, 'fill-opacity': 0.08 }} />
        <Layer id="selection-line" type="line" layout={{ visibility: vis(layers.selection) }} paint={{ 'line-color': palette.accent, 'line-width': 2 }} />
      </Source>

      {layers.selection && (
        <Marker longitude={west} latitude={north} anchor="bottom-left">
          <span className="block whitespace-nowrap bg-accent px-2 py-1 text-2xs font-semibold text-on-accent">
            Block {selected.id} · {selected.lstDay.toFixed(1)}°C
          </span>
        </Marker>
      )}

      <SearchPin />

      {lastPoint && (
        <>
          <Source id="measure" type="geojson" data={measureLine}>
            <Layer id="measure-line" type="line" paint={{ 'line-color': palette.text, 'line-width': 2, 'line-dasharray': [2, 1.5] }} />
          </Source>
          <Marker longitude={lastPoint[0]} latitude={lastPoint[1]} anchor="left" offset={[8, 0]}>
            <span className="flex items-center gap-1.5 border border-border-strong bg-surface-strong px-2 py-1 text-xs tabular-nums text-text">
              {measureKm.toFixed(2)} km
              <button type="button" aria-label={t.map.clearMeasure} onClick={() => setMeasure([])} className="text-muted hover:text-text">
                <LuX size={12} />
              </button>
            </span>
          </Marker>
        </>
      )}
    </MapGL>
  );
}

function MapPlaceholder() {
  const selected = blockById(useWorkspace((s) => s.selectedId));
  return (
    <div className="map-placeholder absolute inset-0">
      <div className="absolute bottom-3 left-3 border border-border bg-surface-strong px-3 py-2">
        <p className="label-caps">{t.map.placeholder}</p>
        <p className="mt-0.5 text-xs text-muted">{t.map.placeholderHint}</p>
      </div>
      <div className="absolute border-2 border-accent bg-accent/10" style={{ left: '40%', top: '51%', width: '21%', height: '32%' }}>
        <span className="absolute -top-px left-[-2px] -translate-y-full whitespace-nowrap bg-accent px-2 py-1 text-2xs font-semibold text-on-accent">
          Block {selected.id} · {selected.lstDay.toFixed(1)}°C
        </span>
      </div>
    </div>
  );
}
