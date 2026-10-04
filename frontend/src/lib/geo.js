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

/** Whole-world view for the "zoom to world" control. */
export const WORLD_VIEW = { center: [10, 25], zoom: 1.2 };
