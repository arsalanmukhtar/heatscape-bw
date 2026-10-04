import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Layer, Marker, Source, useMap } from 'react-map-gl/mapbox';
import { LuX } from 'react-icons/lu';
import { AIR_GRID, BLOCKS, FACILITIES, REGION, SEALING_POINTS, SURFACE_GRID, blockBounds, blockById } from '../data/mock';
import { t } from '../i18n';
import { cssVar, distanceKm } from '../lib/css';
import { MAP_PROJECTION, MAPBOX_TOKEN as TOKEN, addHatchImage, heatStops } from '../lib/mapStyle';
import { candidateFootprint } from '../lib/scenario';
import { useMapResize } from '../lib/useMapResize';
import { useLayout } from '../state/layout';
import { useMapStyleUrl } from '../state/basemap';
import { useActiveRanking, useScenarios } from '../state/scenarios';
import { useTheme } from '../state/theme';
import { useWorkspace } from '../state/workspace';
import { CompareSwipe } from './CompareSwipe';
import { MAP_OVERLAY_ID } from './Expandable';
import { Geocoder } from './Geocoder';
import { MapAttribution } from './MapAttribution';
import { MapControls } from './MapControls';
import { MapScale } from './MapScale';

export function MapView() {
  const containerRef = useRef(null);
  const { main } = useMap();

  const ranking = useActiveRanking();
  const compare = useScenarios((x) => x.compare);
  useMapResize(containerRef, main);

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-map-ground">
      {TOKEN ? <LiveMap /> : <MapPlaceholder />}
      {TOKEN && compare && ranking && <CompareSwipe ranking={ranking} />}
      <Geocoder disabled={!TOKEN} />
      <MapControls disabled={!TOKEN} canCompare={!!ranking} />
      {TOKEN && <MapScale />}
      {TOKEN && <MapAttribution />}
      {/* Expanded tables and charts render here, above map and controls (see Expandable). */}
      <div id={MAP_OVERLAY_ID} className="pointer-events-none absolute inset-0 z-30" />
    </div>
  );
}

function LiveMap() {
  const { main } = useMap();
  const resolved = useTheme((s) => s.resolved);
  const styleUrl = useMapStyleUrl();
  const { layers, sealingOpacity, selectedId, select, tools } = useWorkspace();
  const [measure, setMeasure] = useState([]);
  const selected = blockById(selectedId);
  const firstSelection = useRef(true);

  // Literal colours for Mapbox paint properties, re-read when the theme changes.
  const palette = useMemo(
    () => ({
      heat: heatStops(),
      accent: cssVar('--accent'),
      hospital: cssVar('--level-high'),
      water: cssVar('--accent-2'),
      seal: cssVar('--seal-4'),
      line: cssVar('--map-line'),
      text: cssVar('--text'),
      surface: cssVar('--surface-strong'),
      // Priority classes 1–5 on the vulnerability ramp (light → dark = low → high priority).
      priority: [2, 4, 5, 7, 9].map((k) => cssVar(`--vuln-${k}`)),
    }),
    [resolved],
  );

  // Scenario priority: shown while the scenario workspace (left panel or ranking view) is in use.
  const ranking = useActiveRanking();
  const scenarioContext = useLayout((s) => s.leftSection === 'scenarios' || s.rightView === 'ranking');
  const candidates = useMemo(() => (ranking ? { type: 'FeatureCollection', features: ranking.rows.map(candidateFootprint) } : null), [ranking]);

  // The hatch image is dropped on every style change (theme switch), so re-add it on demand.
  useEffect(() => {
    const map = main?.getMap();
    if (!map) return;
    const onMissing = (e) => e.id === 'unc-hatch' && addHatchImage(map);
    const onLoad = () => addHatchImage(map);
    map.on('styleimagemissing', onMissing);
    map.on('style.load', onLoad);
    if (map.isStyleLoaded()) addHatchImage(map);
    return () => {
      map.off('styleimagemissing', onMissing);
      map.off('style.load', onLoad);
    };
  }, [main]);

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

  const facilities = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: FACILITIES.map((f) => ({ type: 'Feature', properties: { kind: f.kind, name: f.name }, geometry: { type: 'Point', coordinates: f.position } })),
    }),
    [],
  );

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
      <Source id="surface" type="geojson" data={SURFACE_GRID}>
        <Layer
          id="surface-fill"
          type="fill"
          layout={{ visibility: vis(layers.surfaceTemp) }}
          paint={{ 'fill-color': ['interpolate', ['linear'], ['get', 't'], ...palette.heat], 'fill-opacity': 0.72 }}
        />
        <Layer id="surface-grid" type="line" layout={{ visibility: vis(tools.grid) }} paint={{ 'line-color': palette.line, 'line-width': 0.5 }} />
      </Source>

      <Source id="air" type="geojson" data={AIR_GRID}>
        <Layer
          id="air-line"
          type="line"
          layout={{ visibility: vis(layers.airTemp) }}
          paint={{ 'line-color': ['interpolate', ['linear'], ['get', 't'], ...palette.heat], 'line-width': 1.2, 'line-opacity': 0.9 }}
        />
      </Source>

      <Source id="sealing" type="geojson" data={SEALING_POINTS}>
        <Layer
          id="sealing-dots"
          type="circle"
          layout={{ visibility: vis(sealingOpacity > 0) }}
          paint={{
            'circle-color': palette.seal,
            'circle-radius': ['interpolate', ['linear'], ['get', 'sealing'], 0, 0.5, 100, 4],
            'circle-opacity': sealingOpacity / 100,
          }}
        />
      </Source>

      {candidates && (
        <Source id="priority" type="geojson" data={candidates}>
          <Layer
            id="priority-fill"
            type="fill"
            beforeId="hospitals"
            layout={{ visibility: vis(scenarioContext) }}
            paint={{
              'fill-color': ['match', ['get', 'priority'], 1, palette.priority[0], 2, palette.priority[1], 3, palette.priority[2], 4, palette.priority[3], palette.priority[4]],
              'fill-opacity': 0.88,
            }}
          />
          <Layer
            id="priority-hatch"
            type="fill"
            beforeId="hospitals"
            filter={['==', ['get', 'unstable'], true]}
            layout={{ visibility: vis(scenarioContext) }}
            paint={{ 'fill-pattern': 'unc-hatch' }}
          />
          <Layer
            id="priority-line"
            type="line"
            beforeId="hospitals"
            layout={{ visibility: vis(scenarioContext) }}
            paint={{ 'line-color': palette.surface, 'line-width': 1 }}
          />
        </Source>
      )}

      <Source id="facilities" type="geojson" data={facilities}>
        <Layer
          id="hospitals"
          type="circle"
          filter={['==', ['get', 'kind'], 'hospital']}
          layout={{ visibility: vis(layers.hospitals) }}
          paint={{ 'circle-color': palette.hospital, 'circle-radius': 6, 'circle-stroke-color': palette.surface, 'circle-stroke-width': 2 }}
        />
        <Layer
          id="water"
          type="circle"
          filter={['==', ['get', 'kind'], 'water']}
          layout={{ visibility: vis(layers.water) }}
          paint={{ 'circle-color': palette.water, 'circle-radius': 6, 'circle-stroke-color': palette.surface, 'circle-stroke-width': 2 }}
        />
      </Source>

      <Source id="selection" type="geojson" data={selection}>
        <Layer id="selection-fill" type="fill" paint={{ 'fill-color': palette.accent, 'fill-opacity': 0.08 }} />
        <Layer id="selection-line" type="line" paint={{ 'line-color': palette.accent, 'line-width': 2 }} />
      </Source>

      <Marker longitude={west} latitude={north} anchor="bottom-left">
        <span className="block whitespace-nowrap bg-accent px-2 py-1 text-2xs font-semibold text-on-accent">
          Block {selected.id} · {selected.lstDay.toFixed(1)}°C
        </span>
      </Marker>

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
