/*
  Logos on the sign-in screen (files in public/partners/, from each organisation's website;
  USGS from Wikimedia Commons; DWD and LUBW traced to SVG from their small site images).
  Partners are the practice-partner candidates named in the proposal; no partnership is
  signed yet, so ask each one before going public. Data providers are credited as sources
  of the open data used. Without a usable logo file, `text` is shown as a wordmark.
  The strip is always light (both themes), so each logo has one file in its own colours.
*/
export const PARTNERS = [
  { id: 'stuttgart', name: 'Landeshauptstadt Stuttgart', src: '/partners/stuttgart.svg', url: 'https://www.stuttgart.de' },
  { id: 'vrs', name: 'Verband Region Stuttgart', src: '/partners/vrs.svg', url: 'https://www.region-stuttgart.org' },
  { id: 'mrn', name: 'Metropolregion Rhein-Neckar', src: '/partners/vrrn.svg', url: 'https://www.m-r-n.com' },
  { id: 'mannheim', name: 'Stadt Mannheim', src: '/partners/mannheim.svg', url: 'https://www.mannheim.de' },
];

export const DATA_PROVIDERS = [
  { id: 'copernicus', name: 'Copernicus', src: '/partners/copernicus.svg', url: 'https://www.copernicus.eu' },
  { id: 'esa', name: 'European Space Agency', src: '/partners/esa.svg', url: 'https://www.esa.int' },
  { id: 'nasa', name: 'NASA', src: '/partners/nasa.svg', url: 'https://www.nasa.gov' },
  { id: 'usgs', name: 'U.S. Geological Survey', src: '/partners/usgs.svg', url: 'https://www.usgs.gov' },
  { id: 'dwd', name: 'Deutscher Wetterdienst', src: '/partners/dwd.svg', url: 'https://www.dwd.de' },
  { id: 'lubw', name: 'LUBW Landesanstalt für Umwelt Baden-Württemberg', src: '/partners/lubw.svg', url: 'https://www.lubw.baden-wuerttemberg.de' },
  { id: 'lgl', name: 'Landesamt für Geoinformation und Landentwicklung Baden-Württemberg', src: '/partners/lgl.svg', url: 'https://www.lgl-bw.de' },
  { id: 'destatis', name: 'Statistisches Bundesamt (Destatis)', src: '/partners/destatis.svg', url: 'https://www.destatis.de' },
];
