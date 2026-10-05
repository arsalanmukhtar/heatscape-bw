import shp from 'shpjs';

/*
  Reads a measure footprint from the files picked in the Add measure form: GeoJSON, a
  zipped Shapefile, or a Shapefile's parts selected together (.shp + .dbf + .prj, .cpg
  optional). The .prj reprojects to WGS 84 (shpjs uses proj4). Throws an Error whose
  message is a key of t.measures.form.
*/
const ext = (file) => file.name.split('.').pop().toLowerCase();

/** First polygon of a GeoJSON object (FeatureCollection, Feature or geometry). */
function firstPolygon(json) {
  const geoms = json?.type === 'FeatureCollection' ? json.features.map((x) => x.geometry) : json?.type === 'Feature' ? [json.geometry] : [json];
  return geoms.find((g) => g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) ?? null;
}

const isLonLat = (geometry) => geometry.coordinates.flat(geometry.type === 'Polygon' ? 1 : 2).every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90);

export async function readFootprint(fileList) {
  const by = Object.fromEntries([...fileList].map((f) => [ext(f), f]));
  let json;
  try {
    if (by.geojson || by.json) json = JSON.parse(await (by.geojson ?? by.json).text());
    else if (by.zip) json = await shp(await by.zip.arrayBuffer());
    else if (by.shp) json = await shp({ shp: await by.shp.arrayBuffer(), dbf: await by.dbf?.arrayBuffer(), prj: await by.prj?.text(), cpg: await by.cpg?.text() });
  } catch {
    throw new Error('badFile');
  }
  if (!json) throw new Error(by.dbf || by.shx || by.prj ? 'needShp' : by.gpkg ? 'convertLater' : 'badType');
  // A zip with several layers gives one collection per layer.
  if (Array.isArray(json)) json = { type: 'FeatureCollection', features: json.flatMap((c) => c.features ?? []) };
  const geometry = firstPolygon(json);
  if (!geometry) throw new Error('noPolygon');
  if (!isLonLat(geometry)) throw new Error(by.shp || by.zip ? 'noPrj' : 'notLonLat');
  return { geometry, name: (by.geojson ?? by.json ?? by.zip ?? by.shp).name };
}
