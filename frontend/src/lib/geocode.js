const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const URL_BASE = 'https://api.mapbox.com/search/geocode/v6/forward';

/** Mapbox forward geocoding, biased to a point and limited to Germany. */
export async function geocode(query, { proximity, signal, limit = 10 } = {}) {
  const params = new URLSearchParams({ q: query, access_token: TOKEN, limit: String(limit), country: 'de', language: 'en', autocomplete: 'true' });
  if (proximity) params.set('proximity', proximity.join(','));
  const res = await fetch(`${URL_BASE}?${params}`, { signal });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const { features = [] } = await res.json();
  return features.map((f) => ({
    id: f.properties.mapbox_id ?? f.id,
    name: f.properties.name,
    place: f.properties.place_formatted ?? '',
    center: [f.properties.coordinates.longitude, f.properties.coordinates.latitude],
    bbox: f.properties.bbox,
  }));
}
