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
import { setShortcutMap } from '../lib/shortcuts';
import { buildLayerSpec } from '../lib/symbology';
import { useMapResize } from '../lib/useMapResize';
import { useLayout } from '../state/layout';
import { useMapStyleUrl } from '../state/basemap';
import { useActiveRanking, useScenarios } from '../state/scenarios';
import { useSymbology } from '../state/symbology';
import { allMeasures, useMeasures } from '../state/measures';
import { useTheme } from '../state/theme';
import { useWorkspace } from '../state/workspace';
import { CompareSwipe } from './CompareSwipe';
import { MAP_OVERLAY_ID } from './Expandable';
import { Geocoder, SearchPin } from './Geocoder';
import { MapAttribution } from './MapAttribution';
import { MapControls } from './MapControls';
import { MapScale } from './MapScale';
import { FootprintDraft } from './measures/FootprintDraft';

// Ruler snapping: a point within this many pixels of a vertex jumps onto it.
const SNAP_PX = 12;
const vertices = (g) => (g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' || g.type === 'MultiPoint' ? g.coordinates : g.type === 'Polygon' || g.type === 'MultiLineString' ? g.coordinates.flat() : g.type === 'MultiPolygon' ? g.coordinates.flat(2) : []);

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
  const { layers, selectedId, select, tools, snap } = useWorkspace();
  const { styles, order } = useSymbology();
  // Measures register: live data for its layers, selection, and drafting a new footprint.
  const measuresAdded = useMeasures((s) => s.added);
  const statusLog = useMeasures((s) => s.statusLog);
  const { selectedId: measureId, select: selectMeasure, drawing, shaping } = useMeasures();
  const showRightView = useLayout((s) => s.showRightView);
  const selectedMeasure = allMeasures(measuresAdded, statusLog).find((m) => m.id === measureId);
  const [measure, setMeasure] = useState([]);
  const [snapAt, setSnapAt] = useState(null); // ruler: vertex under the pointer
  const selected = blockById(selectedId);
  const firstSelection = useRef(true);

  useEffect(() => {
    setShortcutMap(main ?? null);
    return () => setShortcutMap(null);
  }, [main]);

  // Literal colours for the overlays' paint properties, re-read when the theme changes.
  const palette = useMemo(
    () => ({
      accent: cssVar('--accent'),
      accent2: cssVar('--accent-2'),
      muted: cssVar('--text-muted'),
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
    [styles, layers, resolved, measuresAdded, statusLog],
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
  // Labels of every layer sit above all data layers (as in QGIS), in the same layer order.
  const stack = useMemo(
    () => [
      ...order.flatMap((id) => (id === 'priority' ? PRIORITY_IDS : (specs[id]?.layers.map((l) => l.id) ?? []))),
      ...order.flatMap((id) => specs[id]?.extra.flatMap((x) => x.layers.map((l) => l.id)) ?? []),
    ],
    [order, specs],
  );
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

  // Ruler keys (the ruler itself stays on; ignored while typing in a field or editing
  // footprint corners, which use Delete themselves): Esc clears the line, Delete or
  // Backspace removes the last point.
  useEffect(() => {
    if (!tools.measure) return;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]') || useMeasures.getState().shaping) return;
      if (e.key === 'Escape') setMeasure([]);
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setMeasure((m) => m.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tools.measure]);

  useEffect(() => {
    if (!tools.measure) setMeasure([]);
    if (!tools.measure || !snap) setSnapAt(null);
  }, [tools.measure, snap]);

  // Ruler snapping: the nearest vertex within SNAP_PX among the ruler's own points and
  // every app layer drawn under the pointer (basemap features and labels are left out).
  const snapTarget = (e) => {
    const m = main?.getMap();
    if (!m) return null;
    const { x, y } = e.point;
    // Data sources only (not their label sources: label anchors are not vertices).
    const own = new Set(Object.values(specs).map((s) => s.sourceId).concat(['measure-selected', 'measure-control', 'measure-draft', 'selection', 'priority', 'grid']));
    const hits = m.queryRenderedFeatures([[x - SNAP_PX, y - SNAP_PX], [x + SNAP_PX, y + SNAP_PX]]).filter((f) => own.has(f.source));
    let best = null;
    for (const c of [...measure, ...hits.flatMap((f) => vertices(f.geometry))]) {
      const p = m.project(c);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= SNAP_PX && (!best || d < best.d)) best = { c: [c[0], c[1]], d };
    }
    return best?.c ?? null;
  };

  const selection = useMemo(() => {
    const [[w, s], [e, n]] = blockBounds(selected);
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } };
  }, [selected]);

  const measureKm = measure.slice(1).reduce((sum, p, i) => sum + distanceKm(measure[i], p), 0);
  const measureLine = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: measure } },
        ...measure.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })),
      ],
    }),
    [measure],
  );

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
      cursor={drawing || tools.measure ? 'crosshair' : tools.select ? 'pointer' : 'grab'}
      doubleClickZoom={!drawing && !shaping}
      onMouseMove={(e) => tools.measure && snap && setSnapAt(snapTarget(e))}
      onMouseOut={() => setSnapAt(null)}
      onClick={(e) => {
        // Clicks on HTML markers (ruler label ×, pins, corner handles) bubble to the map: ignore them.
        if (e.originalEvent?.target?.closest?.('.mapboxgl-marker')) return;
        const p = [e.lngLat.lng, e.lngLat.lat];
        // Drafting a measure footprint takes every click (FootprintDraft handles them).
        if (drawing || shaping) return;
        // The ruler takes clicks before features do (a snapped point may sit on a footprint).
        if (tools.measure) {
          const at = snap ? snapTarget(e) : null;
          setMeasure((m) => [...m, at ?? p]);
          return;
        }
        // A click on a measure footprint selects it and opens its effect.
        const measureLayers = specs.measures.layers.map((l) => l.id).filter((id) => main?.getMap().getLayer(id));
        const hit = layers.measures && measureLayers.length ? main?.queryRenderedFeatures(e.point, { layers: measureLayers })[0] : null;
        if (hit) {
          selectMeasure(hit.properties.id);
          showRightView('effect');
          return;
        }
        if (!tools.select) return;
        // Pick the nearest block within 1.5 km of the click.
        const nearest = BLOCKS.map((b) => ({ b, km: distanceKm(b.center, p) })).sort((x, y) => x.km - y.km)[0];
        if (nearest && nearest.km < 1.5) select(nearest.b.id);
      }}
    >
      {LAYERS.flatMap((def) => {
        const spec = specs[def.id];
        return [spec, ...spec.extra].map((src) => (
          <Source key={src.sourceKey} id={src.sourceId} {...src.source}>
            {src.layers.map(({ label, ...l }) => (
              <Layer key={l.id} {...l} />
            ))}
          </Source>
        ));
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

      {/* Selected measure: its footprint outlined (map selection colour) and its control area dotted. */}
      {selectedMeasure && layers.measures && (
        <>
          <Source id="measure-selected" type="geojson" data={selectedMeasure.geometry}>
            <Layer id="measure-selected-line" type="line" paint={{ 'line-color': palette.accent2, 'line-width': 3 }} />
          </Source>
          {selectedMeasure.control && (
            <Source id="measure-control" type="geojson" data={selectedMeasure.control}>
              <Layer id="measure-control-line" type="line" layout={{ 'line-cap': 'round' }} paint={{ 'line-color': palette.muted, 'line-width': 1.5, 'line-dasharray': [0.1, 2] }} />
            </Source>
          )}
        </>
      )}

      {/* Footprint drafted in the Add measure form (drawing, corner editing). */}
      <FootprintDraft color={palette.accent2} surface={palette.surface} />

      {layers.selection && (
        <Marker longitude={west} latitude={north} anchor="bottom-left">
          <span className="block whitespace-nowrap bg-accent px-2 py-1 text-2xs font-semibold text-on-accent">
            Block {selected.id} · {selected.lstDay.toFixed(1)}°C
          </span>
        </Marker>
      )}

      <SearchPin />

      {/* Ruler snap target: a ring on the vertex the next point will jump to. */}
      {snapAt && (
        <Source id="ruler-snap" type="geojson" data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: snapAt } }}>
          <Layer id="ruler-snap-ring" type="circle" paint={{ 'circle-radius': 7, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': palette.accent, 'circle-stroke-width': 2 }} />
        </Source>
      )}

      {lastPoint && (
        <>
          <Source id="measure" type="geojson" data={measureLine}>
            <Layer id="measure-line" type="line" filter={['==', ['geometry-type'], 'LineString']} paint={{ 'line-color': palette.text, 'line-width': 2, 'line-dasharray': [2, 1.5] }} />
            <Layer
              id="measure-point"
              type="circle"
              filter={['==', ['geometry-type'], 'Point']}
              paint={{ 'circle-radius': 4, 'circle-color': palette.surface, 'circle-stroke-color': palette.text, 'circle-stroke-width': 2 }}
            />
          </Source>
          <Marker longitude={lastPoint[0]} latitude={lastPoint[1]} anchor="left" offset={[12, -14]}>
            <span className="flex h-7 items-center gap-1.5 border border-border-strong bg-surface-strong pl-2 pr-1 text-xs tabular-nums text-text">
              <span>{measureKm.toFixed(2)} km</span>
              <button type="button" aria-label={t.map.clearMeasure} title={t.map.clearMeasure} onClick={() => setMeasure([])} className="grid size-5 place-items-center text-muted hover:text-accent">
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
