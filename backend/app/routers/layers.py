"""Map layers from the imported open data, as GeoJSON FeatureCollections (EPSG:4326), and
for the admin units also as vector tiles with their attributes and single features.

Property names are camelCase, matching the layer fields in frontend/src/lib/layers.js.
"""

import gzip
from collections import OrderedDict

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Response

from app.db import get_pool

router = APIRouter(prefix="/layers", tags=["layers"])

# The FeatureCollection is built in the database (with its feature count); {props} is a
# json_build_object(...) body. Only the fixed SQL below is formatted in (the layer name is
# checked against LAYERS), no input.
FC = """
SELECT count(*) AS n, json_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(json_agg(json_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(geom, {precision})::json,
    'properties', json_build_object({props})
  )), '[]'::json)
)::text AS body
FROM ({source}) src
"""

LAYERS = {
    "hospitals": (
        "SELECT * FROM overture_places WHERE category = 'hospital' ORDER BY name",
        """'id', id, 'name', name, 'address', address, 'postcode', postcode, 'locality', locality,
           'phone', phone, 'website', website, 'confidence', round(confidence::numeric, 2)""",
    ),
    "water": (
        "SELECT * FROM osm_facilities WHERE kind = 'water' ORDER BY name",
        "'id', osm_id, 'name', COALESCE(name, initcap(replace(subtype, '_', ' '))), 'kind', subtype, 'operator', operator",
    ),
    # Stations with their latest 10-minute temperature and the counts of the latest summer
    # (Jun–Aug of the year of the newest daily value; before June the previous summer).
    "dwd-stations": (
        """
        WITH season AS (
          SELECT (EXTRACT(YEAR FROM max(day)) - CASE WHEN EXTRACT(MONTH FROM max(day)) < 6 THEN 1 ELSE 0 END)::int AS y FROM dwd_daily
        ), summer AS (
          SELECT station_id,
                 count(*) FILTER (WHERE tmax >= 25) AS summer_days,
                 count(*) FILTER (WHERE tmax >= 30) AS heat_days,
                 count(*) FILTER (WHERE tmin >= 20) AS tropical_nights,
                 max(tmax) AS summer_max
          FROM dwd_daily, season
          WHERE day BETWEEN make_date(season.y, 6, 1) AND make_date(season.y, 8, 31)
          GROUP BY station_id
        ), last_day AS (
          SELECT DISTINCT ON (station_id) station_id, day, tmax, tmin FROM dwd_daily WHERE tmax IS NOT NULL ORDER BY station_id, day DESC
        )
        SELECT s.id, s.name, s.elevation_m, s.geom, l.t2m, l.observed_at, d.day, d.tmax, d.tmin,
               su.summer_days, su.heat_days, su.tropical_nights, su.summer_max, (SELECT y FROM season) AS season
        FROM dwd_stations s
        LEFT JOIN dwd_latest l ON l.station_id = s.id
        LEFT JOIN last_day d ON d.station_id = s.id
        LEFT JOIN summer su ON su.station_id = s.id
        ORDER BY s.name
        """,
        """'id', id, 'name', name, 'elevation', elevation_m, 'latestTemp', t2m, 'observedAt', observed_at,
           'lastDay', day, 'lastDayMax', tmax, 'lastDayMin', tmin, 'season', season,
           'summerDays', summer_days, 'heatDays', heat_days, 'tropicalNights', tropical_nights, 'summerMax', summer_max""",
    ),
    "zensus": (
        "SELECT * FROM zensus_grid",
        "'id', grid_id, 'population', population, 'meanAge', mean_age",
    ),
    **{
        f"admin-{level}": (
            f"SELECT * FROM admin_units WHERE level = '{level}' ORDER BY name",
            """'id', id, 'name', name, 'type', type, 'ars', ars, 'ags', ags, 'population', population,
               'area', round(area_km2::numeric, 2), 'density', round((population / NULLIF(area_km2, 0))::numeric),
               'district', district, 'region', region, 'state', state, 'nuts', nuts""",
        )
        for level in ("land", "rbz", "krs", "vwg", "gem", "osm9", "osm10")
    },
}
# Coordinate decimals per layer: admin boundaries go out unrounded (9 = ST_AsGeoJSON's full
# default), so no vertex moves and no outline can cross itself.
PRECISION = {name: 9 for name in LAYERS if name.startswith("admin-")}

# Admin units are drawn from vector tiles (decision 63): the browser keeps their attributes
# (table, queries, styles, labels) and fetches one unit's full geometry when it is
# highlighted. Spatial operations use admin_units.geom, never tile geometry.
TILED = {f"admin-{level}": level for level in ("land", "rbz", "krs", "vwg", "gem", "osm9", "osm10")}
TILE_EXTENT, TILE_BUFFER = 4096, 64
# Same properties as the GeoJSON, as MVT value types (int, float, text).
TILE_PROPS = """id, name, type, ars, ags, population, round(area_km2::numeric, 2)::float8 AS area,
  round((population / NULLIF(area_km2, 0))::numeric)::int AS density, district, region, state, nuts"""
TILE = f"""
SELECT ST_AsMVT(t, $5, {TILE_EXTENT}, 'geom') FROM (
  SELECT {TILE_PROPS}, ST_AsMVTGeom(geom_3857, ST_TileEnvelope($1, $2, $3), {TILE_EXTENT}, {TILE_BUFFER}, true) AS geom
  FROM admin_units
  WHERE level = $4 AND geom_3857 && ST_TileEnvelope($1, $2, $3, margin => {TILE_BUFFER / TILE_EXTENT})
) t WHERE geom IS NOT NULL
"""
ATTRIBUTES = """
SELECT count(*) AS n, json_build_object(
  'type', 'FeatureCollection',
  'version', $2::text,
  'features', COALESCE(json_agg(json_build_object(
    'type', 'Feature',
    'bbox', json_build_array(ST_XMin(geom), ST_YMin(geom), ST_XMax(geom), ST_YMax(geom)),
    'geometry', ST_AsGeoJSON(inner_pt, 7)::json,
    'properties', json_build_object({props})
  ) ORDER BY name), '[]'::json)
)::text AS body
FROM admin_units WHERE level = $1
"""
FEATURE = """
SELECT json_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(geom, 9)::json, 'properties', json_build_object('id', id))::text
FROM admin_units WHERE level = $1 AND id = $2
"""
# Rendered tiles (gzipped) per (layer, version, z, x, y); the version (import time) changes
# the URL, so entries never go stale. Least recently used dropped first beyond TILE_CACHE bytes.
_tiles: OrderedDict[tuple, bytes] = OrderedDict()
_tile_bytes = 0
TILE_CACHE = 256 * 1024 * 1024


def _tiled(layer: str) -> str:
    if layer not in TILED:
        raise HTTPException(status_code=404, detail=f"No tiles for '{layer}'. Tiled layers: {', '.join(TILED)}")
    return TILED[layer]


async def _version(pool: asyncpg.Pool, level: str) -> str:
    """Import time of the dataset behind a level (tile URL version)."""
    dataset = "overture-divisions" if level.startswith("osm") else "bkg-vg250"
    at = await pool.fetchval("SELECT extract(epoch FROM fetched_at)::bigint FROM datasets WHERE id = $1", dataset)
    return str(at or 0)


@router.get("/{layer}/attributes", responses={200: {"content": {"application/geo+json": {}}}})
async def attributes(layer: str, pool: asyncpg.Pool = Depends(get_pool)) -> Response:
    """Attributes of a tiled layer (admin-*) without boundaries: per unit the GeoJSON properties,
    a point inside it (geometry) and its bbox; `version` goes into the tile URLs."""
    level = _tiled(layer)
    row = await pool.fetchrow(ATTRIBUTES.format(props=LAYERS[layer][1]), level, await _version(pool, level))
    cache = "max-age=300" if row["n"] else "no-store"
    return Response(content=row["body"], media_type="application/geo+json", headers={"Cache-Control": cache})


@router.get("/{layer}/tiles/{z}/{x}/{y}.mvt", responses={200: {"content": {"application/vnd.mapbox-vector-tile": {}}}})
async def tile(layer: str, z: int, x: int, y: int, v: str = "", pool: asyncpg.Pool = Depends(get_pool)) -> Response:
    """Mapbox vector tile of a tiled layer (source layer = the layer name): the original
    geometries clipped to the tile and placed on its 4096 grid (no simplification)."""
    level = _tiled(layer)
    if not (0 <= z <= 22 and 0 <= x < 2**z and 0 <= y < 2**z):
        raise HTTPException(status_code=404, detail="Tile outside the grid")
    global _tile_bytes
    key = (layer, v, z, x, y)
    body = _tiles.get(key)
    if body is None:
        body = gzip.compress(bytes(await pool.fetchval(TILE, z, x, y, level, layer) or b""), compresslevel=6)
        _tiles[key] = body
        _tile_bytes += len(body)
        while _tile_bytes > TILE_CACHE and len(_tiles) > 1:
            _tile_bytes -= len(_tiles.popitem(last=False)[1])
    else:
        _tiles.move_to_end(key)
    # A versioned URL never changes content; an unversioned one may after the next import.
    cache = "public, max-age=86400, immutable" if v else "max-age=300"
    headers = {"Cache-Control": cache, "Content-Encoding": "gzip"}
    return Response(content=body, media_type="application/vnd.mapbox-vector-tile", headers=headers)


@router.get("/{layer}/features/{fid}", responses={200: {"content": {"application/geo+json": {}}}})
async def feature(layer: str, fid: str, pool: asyncpg.Pool = Depends(get_pool)) -> Response:
    """One unit of a tiled layer with its whole original geometry (highlight, zoom to)."""
    body = await pool.fetchval(FEATURE, _tiled(layer), fid)
    if body is None:
        raise HTTPException(status_code=404, detail=f"No feature '{fid}' in '{layer}'")
    return Response(content=body, media_type="application/geo+json", headers={"Cache-Control": "max-age=300"})


@router.get("/{layer}", responses={200: {"content": {"application/geo+json": {}}}})
async def layer(layer: str, pool: asyncpg.Pool = Depends(get_pool)) -> Response:
    """GeoJSON of an open-data layer: hospitals, water (OSM), dwd-stations (DWD), zensus (Destatis 100 m grid),
    admin-{land|rbz|krs|vwg|gem} (BKG VG250-EW, all of Germany), admin-{osm9|osm10} (OSM city districts / quarters).

    Empty until the worker (or `python -m app.ingest …`) has imported the data; see /api/datasets.
    """
    if layer not in LAYERS:
        raise HTTPException(status_code=404, detail=f"Unknown layer '{layer}'. Layers: {', '.join(LAYERS)}")
    source, props = LAYERS[layer]
    row = await pool.fetchrow(FC.format(source=source, props=props, precision=PRECISION.get(layer, 6)))
    # Cached for 5 min once there is data; an empty layer (not imported yet) is never cached,
    # so the client's retries see the import as soon as it lands.
    cache = "max-age=300" if row["n"] else "no-store"
    return Response(content=row["body"], media_type="application/geo+json", headers={"Cache-Control": cache})
