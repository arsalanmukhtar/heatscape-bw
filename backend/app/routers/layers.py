"""Map layers from the imported open data, as GeoJSON FeatureCollections (EPSG:4326).

Property names are camelCase, matching the layer fields in frontend/src/lib/layers.js.
"""

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Response

from app.db import get_pool

router = APIRouter(prefix="/layers", tags=["layers"])

# The FeatureCollection is built in the database; {props} is a json_build_object(...) body.
# Only the fixed SQL below is formatted in (the layer name is checked against LAYERS), no input.
FC = """
SELECT json_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(json_agg(json_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(geom, {precision})::json,
    'properties', json_build_object({props})
  )), '[]'::json)
)::text
FROM ({source}) src
"""

LAYERS = {
    "hospitals": (
        "SELECT * FROM osm_facilities WHERE kind = 'hospital' ORDER BY name",
        "'id', osm_id, 'name', COALESCE(name, 'Hospital (unnamed)'), 'operator', operator, 'beds', beds, 'emergency', emergency",
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
               'district', district, 'region', region, 'nuts', nuts""",
        )
        for level in ("land", "rbz", "krs", "vwg", "gem", "osm9", "osm10")
    },
}
# Coordinate decimals per layer (5 ≈ 1 m: enough for the generalised VG250 boundaries).
PRECISION = {name: 5 for name in LAYERS if name.startswith("admin-")}


@router.get("/{layer}", responses={200: {"content": {"application/geo+json": {}}}})
async def layer(layer: str, pool: asyncpg.Pool = Depends(get_pool)) -> Response:
    """GeoJSON of an open-data layer: hospitals, water (OSM), dwd-stations (DWD), zensus (Destatis 100 m grid),
    admin-{land|rbz|krs|vwg|gem} (BKG VG250-EW, Baden-Württemberg), admin-{osm9|osm10} (OSM city districts / quarters).

    Empty until the worker (or `python -m app.ingest …`) has imported the data; see /api/datasets.
    """
    if layer not in LAYERS:
        raise HTTPException(status_code=404, detail=f"Unknown layer '{layer}'. Layers: {', '.join(LAYERS)}")
    source, props = LAYERS[layer]
    body = await pool.fetchval(FC.format(source=source, props=props, precision=PRECISION.get(layer, 6)))
    return Response(content=body, media_type="application/geo+json", headers={"Cache-Control": "max-age=300"})
