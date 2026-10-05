/*
  MOCK rasters as PNG image sources. Each cell value is written into the red channel
  (1–255, 0 = no data) and decoded on the GPU through raster-color-mix, so raster-color
  can colour the real values (°C, hazard class) with any ramp or palette.
  Continuous rasters map their [min, max] onto 1–255; classified rasters store the class.
*/
const cache = new Map();

export function rasterSource(def) {
  if (cache.has(def.id)) return cache.get(def.id);
  const { cols, rows, values, bounds } = def.raster;
  const data = values.filter((v) => v != null);
  const classified = def.kind === 'classified';
  const lo = classified ? 0 : Math.min(...data);
  const hi = classified ? 255 : Math.max(...data);
  const step = (hi - lo) / 254;
  const encode = (v) => (v == null ? 0 : classified ? v : 1 + Math.round((v - lo) / step));

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(cols, rows);
  values.forEach((v, i) => {
    img.data[i * 4] = encode(v);
    img.data[i * 4 + 3] = 255;
  });
  ctx.putImageData(img, 0, 0);

  const [w, s, e, n] = bounds;
  const source = {
    url: canvas.toDataURL('image/png'),
    coordinates: [[w, n], [e, n], [e, s], [w, s]],
    // raster-value = mix · (r, g, b) + offset, with r in 0–1.
    mix: classified ? [255, 0, 0, 0] : [step * 255, 0, 0, lo - step],
    // Decoded value of a no-data cell, and the full decoded range.
    nodata: classified ? 0 : lo - step,
    range: classified ? [0, Math.max(...data)] : [lo - step, hi],
  };
  cache.set(def.id, source);
  return source;
}
