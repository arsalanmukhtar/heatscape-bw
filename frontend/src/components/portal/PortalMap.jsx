import { useEffect, useMemo, useState } from 'react';
import MapGL, { Layer, Marker, Source, useMap } from 'react-map-gl/mapbox';
import { LuMapPin, LuMinus, LuPlus } from 'react-icons/lu';
import { COOL_PLACES, REGION } from '../../data/mock';
import { portalText } from '../../i18n';
import { cssVar } from '../../lib/css';
import { basemapUrl, MAP_FOG, MAP_PROJECTION, MAPBOX_TOKEN } from '../../lib/mapStyle';
import { circle, CITY_MEDIAN, RADIUS_M, vsupColors, vsupGrid, walkIsochrone } from '../../lib/portal';
import { usePortal } from '../../state/portal';
import { useTheme } from '../../state/theme';
import { PlacePin } from '../Geocoder';
import { ControlButton, Group, NorthButton } from '../MapButtons';
import { KIND_ICON } from './PortalPanel';

const LEVELS = ['High', 'Medium', 'Low'];
// Samples across the diverging ramp: well below, below, at, above, well above the median.
const LEGEND_D = [-4.5, -2.2, 0, 2.2, 4.5];

/** Map of the public portal; padBottom keeps fly-to targets clear of the mobile sheet. */
export function PortalMap({ padBottom = 0 }) {
  const resolved = useTheme((s) => s.resolved);
  const { lang, location, setLocation, placeId, pickPlace } = usePortal();
  const p = portalText[lang];
  const { portal: map } = useMap();
  const colorOf = useMemo(() => vsupColors(), [resolved]); // eslint-disable-line react-hooks/exhaustive-deps
  const grid = useMemo(() => vsupGrid(colorOf), [colorOf]);
  const [walk, setWalk] = useState(null);
  const ink = useMemo(() => ({ accent2: cssVar('--accent-2'), text: cssVar('--text'), cool: cssVar('--series-1') }), [resolved]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new place: fly there and fetch its 10-minute walking area.
  useEffect(() => {
    setWalk(null);
    if (!location) return;
    map?.flyTo({ center: location.center, zoom: 15, padding: { top: 40, bottom: padBottom + 40, left: 40, right: 40 }, duration: 1000 });
    const ctrl = new AbortController();
    walkIsochrone(location.center, ctrl.signal)
      .then(setWalk)
      .catch(() => {});
    return () => ctrl.abort();
  }, [location, map]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const place = COOL_PLACES.find((x) => x.id === placeId);
    if (place) map?.flyTo({ center: place.center, zoom: 16, padding: { top: 40, bottom: padBottom + 40, left: 40, right: 40 }, duration: 900 });
  }, [placeId, map]); // eslint-disable-line react-hooks/exhaustive-deps

  const ring = useMemo(() => (location ? circle(location.center, RADIUS_M) : null), [location]);

  if (!MAPBOX_TOKEN) return <div className="map-placeholder absolute inset-0" aria-label={p.map.label} />;

  return (
    <div className="absolute inset-0" role="region" aria-label={p.map.label}>
      <MapGL
        id="portal"
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: REGION.center[0], latitude: REGION.center[1], zoom: 12 }}
        mapStyle={basemapUrl(resolved === 'dark' ? 'dark' : 'light')}
        projection={MAP_PROJECTION}
        fog={MAP_FOG}
        style={{ width: '100%', height: '100%' }}
        cursor="pointer"
        attributionControl={false}
        onClick={(e) => {
          if (e.originalEvent?.target?.closest?.('.mapboxgl-marker')) return;
          setLocation({ name: p.search.mapPoint, place: '', center: [e.lngLat.lng, e.lngLat.lat] });
        }}
      >
        <Source id="portal-heat" type="geojson" data={grid}>
          <Layer id="portal-heat-fill" type="fill" paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.72 }} />
        </Source>
        {walk && (
          <Source id="portal-walk" type="geojson" data={walk}>
            <Layer id="portal-walk-fill" type="fill" paint={{ 'fill-color': ink.accent2, 'fill-opacity': 0.1 }} />
            <Layer id="portal-walk-line" type="line" paint={{ 'line-color': ink.accent2, 'line-width': 2 }} />
          </Source>
        )}
        {ring && (
          <Source id="portal-ring" type="geojson" data={ring}>
            <Layer id="portal-ring-line" type="line" paint={{ 'line-color': ink.text, 'line-width': 1.5, 'line-dasharray': [2, 2] }} />
          </Source>
        )}

        {COOL_PLACES.map((x) => {
          const Icon = KIND_ICON[x.kind];
          const on = x.id === placeId;
          return (
            <Marker key={x.id} longitude={x.center[0]} latitude={x.center[1]} anchor="center">
              {/* 44 px hit area around a 30 px mark. */}
              <button
                type="button"
                onClick={() => pickPlace(x.id)}
                aria-label={p.map.place(x.name, p.cool.kinds[x.kind])}
                aria-pressed={on}
                title={x.name}
                className="grid size-11 place-items-center"
              >
                <span
                  className={`grid size-[30px] place-items-center border-2 shadow-[var(--shadow-glass)] ${on ? 'text-on-accent' : 'bg-surface-strong'}`}
                  style={{ borderColor: ink.cool, color: on ? undefined : ink.cool, background: on ? ink.cool : undefined }}
                >
                  <Icon size={16} aria-hidden />
                </span>
              </button>
            </Marker>
          );
        })}

        {location && <PlacePin key={location.center.join()} center={location.center} name={`${p.legend.you}: ${location.name}`} />}
      </MapGL>

      {/* Same compact controls as the workspace map: zoom in, zoom out, north. */}
      <div className="absolute right-3 top-3">
        <Group>
          <ControlButton label={p.map.zoomIn} onClick={() => map?.zoomIn()}>
            <LuPlus size={14} />
          </ControlButton>
          <ControlButton label={p.map.zoomOut} onClick={() => map?.zoomOut()}>
            <LuMinus size={14} />
          </ControlButton>
          <NorthButton map={map} label={p.map.north} />
        </Group>
      </div>

      <Legend p={p} colorOf={colorOf} hasPlace={!!location} />
    </div>
  );
}

/*
  Legend for the value-suppressing heat layer: rows by confidence (sure → unsure), columns
  cooler → typical → hotter than the Mannheim median, so fading towards grey reads as
  "less sure". Words on both axes; plus
  the place, its 300 m ring and the 10-minute walking area once a place is chosen.
*/
function Legend({ p, colorOf, hasPlace }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="absolute left-3 top-3 max-w-[calc(100%-5rem)] border border-border-strong bg-surface-strong shadow-[var(--shadow-glass)]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex h-11 w-full items-center gap-2 px-2.5 text-left text-xs font-semibold text-text md:px-3 md:text-sm">
        <span className="min-w-0 flex-1">{p.legend.title}</span>
        <span className="text-xs font-normal text-muted">{open ? p.legend.hide : p.legend.show}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 md:px-3 md:pb-3">
          {/* Smaller swatches and labels on phones, where the legend sits over a small map. */}
          <table className="border-separate border-spacing-px text-2xs md:border-spacing-0.5 md:text-xs">
            <tbody>
              {LEVELS.map((lv) => (
                <tr key={lv}>
                  <th scope="row" className="pr-1.5 text-left font-normal text-muted md:pr-2">
                    {p.legend.rows[lv]}
                  </th>
                  {LEGEND_D.map((d) => (
                    <td key={d} className="size-2.5 p-0 md:size-4" style={{ background: colorOf(CITY_MEDIAN + d, lv) }} aria-hidden />
                  ))}
                </tr>
              ))}
              <tr>
                <td />
                <td colSpan={5} className="pt-0.5">
                  <span className="flex justify-between gap-2 text-muted">
                    <span>{p.legend.cooler}</span>
                    <span>{p.legend.typical}</span>
                    <span>{p.legend.hotter}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          {hasPlace && (
            <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-xs text-text">
              <li className="flex items-center gap-2">
                <LuMapPin size={14} className="shrink-0 text-[var(--search-pin)]" aria-hidden />
                <span>{p.legend.you}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="block h-0 w-3.5 shrink-0 border-t-2 border-dashed border-text" aria-hidden />
                <span>{p.legend.ring}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="block h-2.5 w-3.5 shrink-0 border-2 border-accent-2 bg-[color-mix(in_srgb,var(--accent-2)_10%,transparent)]" aria-hidden />
                <span>{p.legend.walk}</span>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
