import { SEASON } from '../data/mock';

/*
  Data and map attribution: one entry per provider with the credit line its licence asks
  for, a link, and the licence. Every place that credits data reads from here (map
  attribution tiles, report footer, portal "About the data", admin catalog and pipelines).
  credit: a string, or { en, de } where the provider gives both.
*/
const YEAR = SEASON.label.match(/\d{4}/)?.[0] ?? '';
const DL_DE_BY = 'https://www.govdata.de/dl-de/by-2-0';
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

export const ATTRIBUTIONS = {
  mapbox: { name: 'Mapbox', credit: '© Mapbox', url: 'https://www.mapbox.com/about/maps/', licence: 'Mapbox Terms of Service', licenceUrl: 'https://www.mapbox.com/legal/tos' },
  osm: { name: 'OpenStreetMap', credit: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright', licence: 'ODbL 1.0', licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/' },
  maxar: { name: 'Maxar', credit: '© Maxar', url: 'https://www.maxar.com/', licence: 'Mapbox Terms of Service', licenceUrl: 'https://www.mapbox.com/legal/tos' },
  usgs: {
    name: 'U.S. Geological Survey (Landsat)',
    credit: { en: 'Landsat data courtesy of the U.S. Geological Survey', de: 'Landsat-Daten mit freundlicher Genehmigung des U.S. Geological Survey' },
    url: 'https://www.usgs.gov/landsat-missions',
    licence: 'Public domain',
    licenceUrl: 'https://www.usgs.gov/information-policies-and-instructions/crediting-usgs',
  },
  copernicus: {
    name: 'Copernicus / ESA (Sentinel)',
    credit: { en: `Contains modified Copernicus Sentinel data ${YEAR}`, de: `Enthält veränderte Copernicus-Sentinel-Daten ${YEAR}` },
    url: 'https://dataspace.copernicus.eu',
    licence: 'Copernicus open licence',
    licenceUrl: 'https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice',
  },
  dwd: { name: 'Deutscher Wetterdienst (DWD)', credit: 'Datenbasis: Deutscher Wetterdienst', url: 'https://opendata.dwd.de', licence: 'CC BY 4.0', licenceUrl: CC_BY },
  destatis: { name: 'Statistisches Bundesamt (Destatis)', credit: '© Statistisches Bundesamt (Destatis), Zensus 2022', url: 'https://www.zensus2022.de', licence: 'dl-de/by-2-0', licenceUrl: DL_DE_BY },
  lgl: { name: 'LGL Baden-Württemberg', credit: '© LGL, www.lgl-bw.de', url: 'https://www.lgl-bw.de', licence: 'dl-de/by-2-0', licenceUrl: DL_DE_BY },
  heatscape: { name: 'HEATSCAPE-BW', credit: '© HEATSCAPE-BW', url: null, licence: 'CC BY 4.0', licenceUrl: CC_BY },
};

/** Open data providers, in the order the portal and reports list them. */
export const DATA_ATTRIBUTIONS = ['usgs', 'copernicus', 'dwd', 'destatis', 'lgl', 'osm', 'mapbox'];

/** Credit line of a provider in a language (en | de). */
export function credit(key, lang = 'en') {
  const c = ATTRIBUTIONS[key]?.credit;
  return typeof c === 'string' ? c : (c?.[lang] ?? c?.en ?? '');
}

/** Providers every map credits for its basemap (satellite styles add the imagery owner). */
export const basemapAttributions = (basemapId = '') => ['mapbox', 'osm', ...(basemapId.includes('satellite') ? ['maxar'] : [])];

/** Unique keys, first occurrence kept. */
export const uniqueKeys = (keys) => [...new Set(keys.filter((k) => ATTRIBUTIONS[k]))];

/** Credit lines joined into one line, for footers. */
export const creditLine = (keys, lang = 'en') => uniqueKeys(keys).map((k) => credit(k, lang)).join(' · ');
