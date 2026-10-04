import { TEMP_DOMAIN } from '../data/mock';
import { cssVar } from './css';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
// Flat Web Mercator everywhere; Mapbox GL v3 would otherwise switch to a globe when zoomed out.
export const MAP_PROJECTION = 'mercator';
export const MAP_STYLES = { dark: 'mapbox://styles/mapbox/dark-v11', light: 'mapbox://styles/mapbox/light-v11' };

/*
  Mapbox basemaps offered in the basemap control. 'auto' follows the UI theme (dark-v11 /
  light-v11). thumb: path under public/ (e.g. '/basemaps/streets.png'); null shows an
  empty square until thumbnails are supplied.
*/
export const BASEMAPS = [
  { id: 'auto', url: null, thumb: null },
  { id: 'standard', url: 'mapbox://styles/mapbox/standard', thumb: null },
  { id: 'standard-satellite', url: 'mapbox://styles/mapbox/standard-satellite', thumb: null },
  { id: 'streets', url: 'mapbox://styles/mapbox/streets-v12', thumb: null },
  { id: 'outdoors', url: 'mapbox://styles/mapbox/outdoors-v12', thumb: null },
  { id: 'light', url: 'mapbox://styles/mapbox/light-v11', thumb: null },
  { id: 'dark', url: 'mapbox://styles/mapbox/dark-v11', thumb: null },
  { id: 'satellite', url: 'mapbox://styles/mapbox/satellite-v9', thumb: null },
  { id: 'satellite-streets', url: 'mapbox://styles/mapbox/satellite-streets-v12', thumb: null },
  { id: 'navigation-day', url: 'mapbox://styles/mapbox/navigation-day-v1', thumb: null },
  { id: 'navigation-night', url: 'mapbox://styles/mapbox/navigation-night-v1', thumb: null },
];

/** Style URL for a basemap id; 'auto' (or an unknown id) follows the resolved theme. */
export const basemapUrl = (id, theme) => BASEMAPS.find((b) => b.id === id)?.url ?? MAP_STYLES[theme];

/** Heat ramp stops spread evenly over the legend domain (28–42 °C). */
export function heatStops() {
  const [lo, hi] = TEMP_DOMAIN;
  return Array.from({ length: 9 }, (_, i) => [lo + ((hi - lo) * i) / 8, cssVar(`--heat-${i + 1}`)]).flat();
}

/** Low-confidence hatch (45°, alternating dark and light lines) as a Mapbox image. */
export function addHatchImage(map, id = 'unc-hatch') {
  if (map.hasImage(id)) return;
  const gap = parseFloat(cssVar('--unc-hatch-gap')) || 6;
  const size = gap * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 1.5;
  [
    [cssVar('--unc-hatch-dark'), 0],
    [cssVar('--unc-hatch-light'), gap],
  ].forEach(([color, offset]) => {
    ctx.strokeStyle = color;
    for (const d of [-size, 0, size]) {
      ctx.beginPath();
      ctx.moveTo(d + offset, size);
      ctx.lineTo(d + offset + size, 0);
      ctx.stroke();
    }
  });
  map.addImage(id, ctx.getImageData(0, 0, size, size));
}
