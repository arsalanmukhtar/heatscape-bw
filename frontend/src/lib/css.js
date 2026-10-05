/** Reads a design token from the document root, e.g. cssVar('--heat-5'). Used where a
    library needs a literal colour (Mapbox paint properties) instead of a CSS variable. */
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** CSS colours (tokens or var() expressions) resolved in the light theme, as rgb() strings.
    Printed output (reports, PDFs, DOCX) is always light, whatever the app theme. */
export function resolveLight(values) {
  const el = document.createElement('span');
  el.dataset.theme = 'light';
  document.body.appendChild(el);
  const out = values.map((v) => {
    el.style.color = v;
    return getComputedStyle(el).color;
  });
  el.remove();
  return out;
}

/** Great-circle distance in kilometres between two [lon, lat] points. */
export function distanceKm([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
