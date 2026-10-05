import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Marker, Source, useMap } from 'react-map-gl/mapbox';
import { t } from '../../i18n';
import { useMeasures } from '../../state/measures';

const f = t.measures.form;
// Pointer within this many pixels of the first corner snaps to it and closes the shape.
const SNAP_PX = 12;
// A click this close to the last corner is the second click of a double-click.
const REPEAT_PX = 4;

const pt = (e) => [e.lngLat.lng, e.lngLat.lat];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/*
  The measure footprint being drafted in the Add measure form, on the main map. Until the
  measure is saved it is drawn dotted over a light fill (saved footprints are solid).
  Drawing: clicks add corners, a rubber band follows the pointer, and the pointer snaps to
  the first corner to close the shape. Editing: square handles on the corners (drag to
  move, click to select (theme orange), Delete / right-click / double-click to remove) and
  faint round handles on the edge midpoints (drag or click to add a corner).
*/
export function FootprintDraft({ color, surface }) {
  const { current: map } = useMap();
  const { mode, drawing, shaping, corner, selectCorner, draft, addVertex, finishDrawing, moveVertex, insertVertex, removeVertex } = useMeasures();
  const [pointer, setPointer] = useState(null); // { p, snap } while drawing
  const midDragged = useRef(false);
  const v = draft.vertices;

  useEffect(() => {
    if (!map || !drawing) return;
    const m = map.getMap();
    const near = (a, b, px) => {
      const [pa, pb] = [m.project(a), m.project(b)];
      return Math.hypot(pa.x - pb.x, pa.y - pb.y) <= px;
    };
    const corners = () => useMeasures.getState().draft.vertices;
    const onMove = (e) => {
      const c = corners();
      const snap = c.length >= 3 && near(pt(e), c[0], SNAP_PX);
      setPointer({ p: snap ? c[0] : pt(e), snap });
    };
    const onClick = (e) => {
      const c = corners();
      if (c.length >= 3 && near(pt(e), c[0], SNAP_PX)) return finishDrawing();
      if (c.length && near(pt(e), c[c.length - 1], REPEAT_PX)) return;
      addVertex(pt(e));
    };
    const onDblClick = (e) => {
      e.preventDefault();
      finishDrawing();
    };
    const onOut = () => setPointer(null);
    m.on('mousemove', onMove);
    m.on('click', onClick);
    m.on('dblclick', onDblClick);
    m.on('mouseout', onOut);
    return () => {
      m.off('mousemove', onMove);
      m.off('click', onClick);
      m.off('dblclick', onDblClick);
      m.off('mouseout', onOut);
      setPointer(null);
    };
  }, [map, drawing, addVertex, finishDrawing]);

  // Editing: Delete or Backspace removes the selected corner, Esc clears the selection
  // (not while typing in a form field).
  useEffect(() => {
    if (!shaping) return;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const { corner: i } = useMeasures.getState();
      if ((e.key === 'Delete' || e.key === 'Backspace') && i != null) {
        e.preventDefault();
        removeVertex(i);
      } else if (e.key === 'Escape' && i != null) selectCorner(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shaping, removeVertex, selectCorner]);

  const data = useMemo(() => {
    const features = [];
    if (drawing) {
      const ring = pointer && !pointer.snap ? [...v, pointer.p] : v;
      if (ring.length >= 3) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } });
      else if (ring.length === 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } });
      v.forEach((c, i) => features.push({ type: 'Feature', properties: { corner: true, hot: i === 0 && !!pointer?.snap }, geometry: { type: 'Point', coordinates: c } }));
    } else if (draft.geometry) {
      features.push({ type: 'Feature', properties: {}, geometry: draft.geometry });
    }
    return { type: 'FeatureCollection', features };
  }, [drawing, pointer, v, draft.geometry]);

  if (mode !== 'form' || !data.features.length) return null;
  const isShape = ['!=', ['geometry-type'], 'Point'];

  return (
    <>
      <Source id="measure-draft" type="geojson" data={data}>
        <Layer id="measure-draft-fill" type="fill" filter={['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]]} paint={{ 'fill-color': color, 'fill-opacity': 0.12 }} />
        <Layer id="measure-draft-line" type="line" filter={isShape} layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': color, 'line-width': 2.5, 'line-dasharray': [0.1, 2] }} />
        <Layer
          id="measure-draft-corner"
          type="circle"
          filter={['==', ['geometry-type'], 'Point']}
          paint={{ 'circle-radius': ['case', ['get', 'hot'], 7, 4], 'circle-color': ['case', ['get', 'hot'], color, surface], 'circle-stroke-color': color, 'circle-stroke-width': 2 }}
        />
      </Source>

      {shaping &&
        v.map((c, i) => {
          const at = mid(c, v[(i + 1) % v.length]);
          // A drag ends with a click on the same handle: only a plain click inserts at the midpoint.
          const onClick = () => {
            if (!midDragged.current) insertVertex(i + 1, at);
            midDragged.current = false;
          };
          return (
            <Marker
              key={`mid-${i}`}
              longitude={at[0]}
              latitude={at[1]}
              draggable
              onDragStart={() => {
                midDragged.current = true;
              }}
              onDragEnd={(e) => insertVertex(i + 1, pt(e))}
            >
              <span
                title={f.midpointTitle}
                onClick={onClick}
                className="block size-2 cursor-copy rounded-full border-[1.5px] bg-surface-strong opacity-30 transition-opacity hover:opacity-100"
                style={{ borderColor: color }}
              />
            </Marker>
          );
        })}
      {shaping &&
        v.map((c, i) => (
          <Marker
            key={`corner-${i}`}
            longitude={c[0]}
            latitude={c[1]}
            draggable
            onDragStart={() => selectCorner(i)}
            onDrag={(e) => moveVertex(i, pt(e))}
            style={{ zIndex: i === corner ? 1 : 0 }}
          >
            <span
              title={f.cornerTitle}
              aria-pressed={i === corner}
              onClick={() => selectCorner(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                removeVertex(i);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                removeVertex(i);
              }}
              className="block size-3 cursor-move border-2"
              style={i === corner ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : { background: surface, borderColor: color }}
            />
          </Marker>
        ))}
    </>
  );
}
