/** Largest 1/2/5 × 10^n metres that fits maxPx at this latitude and zoom (512 px tiles). */
export function scaleBar(lat, zoom, maxPx = 80) {
  const mPerPx = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
  const max = mPerPx * maxPx;
  const pow = 10 ** Math.floor(Math.log10(max));
  const nice = [5, 2, 1].map((k) => k * pow).find((v) => v <= max) ?? pow;
  return { px: nice / mPerPx, label: nice >= 1000 ? `${nice / 1000} km` : `${nice} m` };
}

/** Baden-Württemberg extent [[west, south], [east, north]] (state boundary, rounded out). */
export const BW_BOUNDS = [
  [7.5, 47.53],
  [10.5, 49.8],
];

/** Germany extent [[west, south], [east, north]] (national border, rounded out). */
export const DE_BOUNDS = [
  [5.86, 47.27],
  [15.05, 55.06],
];

/** [[west, south], [east, north]] of a GeoJSON geometry. */
export function geometryBounds(geometry) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (c) => {
    if (typeof c[0] === 'number') {
      w = Math.min(w, c[0]);
      e = Math.max(e, c[0]);
      s = Math.min(s, c[1]);
      n = Math.max(n, c[1]);
    } else c.forEach(visit);
  };
  visit(geometry.coordinates);
  return [[w, s], [e, n]];
}

/** Moves a map to a geometry: points fly in (street level at least), others fit their bounds. */
export function flyToGeometry(map, geometry) {
  if (!map || !geometry) return;
  if (geometry.type === 'Point') map.flyTo({ center: geometry.coordinates, zoom: Math.max(map.getZoom(), 15), duration: 800 });
  else map.fitBounds(geometryBounds(geometry), { padding: 80, maxZoom: 16, duration: 800 });
}
