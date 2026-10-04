import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Layer, Marker, Source, useMap } from 'react-map-gl/mapbox';
import { LuX } from 'react-icons/lu';
import { AIR_GRID, BLOCKS, FACILITIES, REGION, SEALING_POINTS, SURFACE_GRID, TEMP_DOMAIN, blockBounds, blockById } from '../data/mock';
import { t } from '../i18n';
import { cssVar, distanceKm } from '../lib/css';
import { useTheme } from '../state/theme';
import { useWorkspace } from '../state/workspace';
import { Geocoder } from './Geocoder';
import { MapAttribution } from './MapAttribution';
import { MapControls } from './MapControls';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const STYLES = { dark: 'mapbox://styles/mapbox/dark-v11', light: 'mapbox://styles/mapbox/light-v11' };

/** Heat ramp stops spread evenly over the legend domain (28–42 °C). */
function heatStops() {
  const [lo, hi] = TEMP_DOMAIN;
  return Array.from({ length: 9 }, (_, i) => [lo + ((hi - lo) * i) / 8, cssVar(`--heat-${i + 1}`)]).flat();
}

export function MapView() {
  const containerRef = useRef(null);
  const { main } = useMap();

  // Keep the canvas matched to its container while panels and the dock animate.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !main) return;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => main.resize());
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    document.addEventListener('transitionend', resize);
    return () => {
      ro.disconnect();
      document.removeEventListener('transitionend', resize);
      cancelAnimationFrame(frame);
    };
  }, [main]);

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-map-ground">
      {TOKEN ? <LiveMap /> : <MapPlaceholder />}
      <Geocoder disabled={!TOKEN} />
      <MapControls disabled={!TOKEN} />
      {TOKEN && <MapAttribution />}
    </div>
  );
}

function LiveMap() {
  const { main } = useMap();
  const resolved = useTheme((s) => s.resolved);
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
    }),
    [resolved],
  );

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
      mapStyle={STYLES[resolved]}
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
