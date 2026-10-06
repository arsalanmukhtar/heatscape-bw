/*
  Coordinates typed or pasted into the address search: two decimal numbers separated by a
  comma or spaces, optionally with ° and N/S/E/W ("49.4875, 8.466", "8.466 49.4875",
  "49.4875° N 8.466° E"); with a semicolon between them, decimal commas work too
  ("49,4875; 8,466"). order: latlon | lonlat says which comes first when no hemisphere
  letters decide it. Returns [lon, lat] or null.
*/
const NUM = String.raw`([+-]?\d{1,3}(?:\.\d+)?)\s*°?\s*([NSEWnsew])?`;
const PAIR = new RegExp(String.raw`^${NUM}\s*(?:,\s*|\s+)${NUM}$`);

export function parseCoords(text, order = 'latlon') {
  let s = text.trim();
  if (s.includes(';')) s = s.replace(/,/g, '.').replace(';', ' ');
  const m = PAIR.exec(s);
  if (!m) return null;
  const a = { v: parseFloat(m[1]), h: m[2]?.toUpperCase() };
  const b = { v: parseFloat(m[3]), h: m[4]?.toUpperCase() };
  const signed = (x) => (x.h === 'S' || x.h === 'W' ? -Math.abs(x.v) : x.v);
  const latFirst = a.h || b.h ? (!!a.h && 'NS'.includes(a.h)) || (!!b.h && 'EW'.includes(b.h)) : order === 'latlon';
  const [lat, lon] = latFirst ? [signed(a), signed(b)] : [signed(b), signed(a)];
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat];
}

/** "49.48750° N, 8.46600° E" */
export const fmtLatLon = ([lon, lat], digits = 5) => `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(digits)}° ${lon >= 0 ? 'E' : 'W'}`;
