"""Heat layers from the imported data: Landsat summer LST composites (lst_composites) as
rasters and as a coarser vector grid, a heat hazard class raster derived from them, and a
2 m air temperature model interpolated from the DWD stations (grid and isotherms, clipped to
the region's municipality).

Rasters use the frontend's raster shape: bounds [w, s, e, n], cols, rows, values row-major
from the north-west corner (null = no data). Modelled values carry p05 / p50 / p95 and a
quality flag (docs/architecture.md).
"""

import json
import math

import asyncpg
import numpy as np
from fastapi import APIRouter, Depends, Query, Response

from app.config import settings
from app.db import get_pool

router = APIRouter(prefix="/heat", tags=["heat"])

MIN_SCENES = 3  # fewer clear scenes in a cell: quality "low"
BLOCK = 3  # surface-temp vector cells = BLOCK × BLOCK raster cells (≈ 300 m)
AIR_CELL = (0.014, 0.009)  # air temperature grid, degrees (≈ 1 km)
HAZARD_LABELS = ["Very low", "Low", "Moderate", "High", "Very high"]


def heat_class(t: float) -> str:
    """Surface temperature class (°C), as the Surface Temp legend."""
    return "Severe" if t >= 38 else "High" if t >= 35 else "Moderate" if t >= 32 else "Low"


def air_class(t: float) -> str:
    """Class of the summer mean daily maximum air temperature (°C)."""
    return "Severe" if t >= 31 else "High" if t >= 29 else "Moderate" if t >= 27 else "Low"


def _json(body: dict | list) -> Response:
    return Response(content=json.dumps(body, separators=(",", ":")), media_type="application/json", headers={"Cache-Control": "max-age=300"})


async def _composite(pool: asyncpg.Pool, year: int | None) -> asyncpg.Record | None:
    """The summer asked for, else the latest with at least MIN_SCENES scenes (else the latest);
    None before the first import."""
    if year is not None:
        row = await pool.fetchrow("SELECT * FROM lst_composites WHERE year = $1", year)
    else:
        row = await pool.fetchrow(
            "SELECT * FROM lst_composites ORDER BY (cardinality(scenes) >= $1) DESC, year DESC LIMIT 1", MIN_SCENES
        )
    return row


# Before the first import: empty answers, never cached (the client retries until data arrive).
def _empty_fc() -> Response:
    return Response(content='{"type":"FeatureCollection","features":[]}', media_type="application/geo+json", headers={"Cache-Control": "no-store"})


def _empty_raster() -> Response:
    w, s, e, n = settings.region_bbox
    body = {"year": None, "bounds": [w, s, e, n], "cols": 0, "rows": 0, "scenes": 0, "values": []}
    return Response(content=json.dumps(body), media_type="application/json", headers={"Cache-Control": "no-store"})


def _r1(values: list) -> list:
    """°C arrays to one decimal (stored as float4, which reads back as 38.79999923706055)."""
    return [None if v is None else round(v, 1) for v in values]


def _base(row: asyncpg.Record) -> dict:
    return {"year": row["year"], "bounds": [row["west"], row["south"], row["east"], row["north"]], "cols": row["cols"], "rows": row["rows"], "scenes": len(row["scenes"])}


@router.get("/years")
async def years(pool: asyncpg.Pool = Depends(get_pool)) -> list[dict]:
    """Summers with a composite: year, clear scenes used, summer complete."""
    rows = await pool.fetch("SELECT year, cardinality(scenes) AS scenes, complete FROM lst_composites ORDER BY year")
    return [dict(r) for r in rows]


@router.get("/lst", responses={200: {"content": {"application/json": {}}}})
async def lst(year: int | None = Query(None, description="Summer; default the latest with enough scenes."), pool: asyncpg.Pool = Depends(get_pool)) -> Response:
    """Land surface temperature raster (°C, ≈ 100 m): values = summer median (p50), with p05,
    p95 and the clear-scene count n per cell."""
    row = await _composite(pool, year)
    if row is None:
        return _empty_raster()
    return _json({**_base(row), "unit": "°C", "values": _r1(row["p50"]), "p05": _r1(row["p05"]), "p95": _r1(row["p95"]), "n": row["n"]})


@router.get("/hazard", responses={200: {"content": {"application/json": {}}}})
async def hazard(year: int | None = Query(None), pool: asyncpg.Pool = Depends(get_pool)) -> Response:
    """Heat hazard class raster 1–5: quintiles of the summer median LST across the region, so
    class 5 is the hottest fifth of the city that summer."""
    row = await _composite(pool, year)
    if row is None:
        return _empty_raster()
    p50 = np.array([np.nan if v is None else v for v in row["p50"]], dtype="float64")
    breaks = np.nanquantile(p50, [0.2, 0.4, 0.6, 0.8])
    cls = np.digitize(p50, breaks) + 1
    values = [None if math.isnan(v) else int(c) for v, c in zip(p50, cls)]
    classes = [{"value": i + 1, "label": HAZARD_LABELS[i]} for i in range(5)]
    return _json({**_base(row), "unit": "", "values": values, "classes": classes, "breaks": [round(float(b), 1) for b in breaks]})


@router.get("/surface-temp", responses={200: {"content": {"application/geo+json": {}}}})
async def surface_temp(year: int | None = Query(None), pool: asyncpg.Pool = Depends(get_pool)) -> Response:
    """Surface temperature as a vector grid (≈ 300 m cells, medians of the raster cells):
    t = p50, p05, p95, n (clear scenes), heatClass, quality (observed | low)."""
    row = await _composite(pool, year)
    if row is None:
        return _empty_fc()
    cols, rows = row["cols"], row["rows"]
    w, n_ = row["west"], row["north"]
    d_lon, d_lat = (row["east"] - w) / cols, (n_ - row["south"]) / rows
    arr = {k: np.array([np.nan if v is None else v for v in row[k]], dtype="float64").reshape(rows, cols) for k in ("p05", "p50", "p95", "n")}
    features = []
    for r0 in range(0, rows, BLOCK):
        for c0 in range(0, cols, BLOCK):
            block = {k: a[r0 : r0 + BLOCK, c0 : c0 + BLOCK] for k, a in arr.items()}
            if not np.isfinite(block["p50"]).any():
                continue
            t, p05, p95 = (round(float(np.nanmedian(block[k])), 1) for k in ("p50", "p05", "p95"))
            scenes = int(np.nanmedian(block["n"]))
            x0, x1 = w + c0 * d_lon, w + min(c0 + BLOCK, cols) * d_lon
            y1, y0 = n_ - r0 * d_lat, n_ - min(r0 + BLOCK, rows) * d_lat
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "id": f"S-{r0 // BLOCK:03d}-{c0 // BLOCK:03d}",
                        "t": t,
                        "p05": p05,
                        "p95": p95,
                        "n": scenes,
                        "heatClass": heat_class(t),
                        "quality": "observed" if scenes >= MIN_SCENES else "low",
                        "year": row["year"],
                        "lon": round((x0 + x1) / 2, 5),
                        "lat": round((y0 + y1) / 2, 5),
                    },
                    "geometry": {"type": "Polygon", "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]},
                }
            )
    return _json({"type": "FeatureCollection", "features": features})


AIR_STATIONS = """
WITH season AS (
  SELECT (EXTRACT(YEAR FROM max(day)) - CASE WHEN EXTRACT(MONTH FROM max(day)) < 6 THEN 1 ELSE 0 END)::int AS y FROM dwd_daily
)
SELECT s.id, s.name, ST_X(s.geom) AS lon, ST_Y(s.geom) AS lat, avg(d.tmax) AS tmax, count(d.tmax) AS days, (SELECT y FROM season) AS season
FROM dwd_stations s JOIN dwd_daily d ON d.station_id = s.id, season
WHERE d.day BETWEEN make_date(season.y, 6, 1) AND make_date(season.y, 8, 31) AND d.tmax IS NOT NULL
GROUP BY s.id HAVING count(d.tmax) >= 60
"""


ISO_CELL = (0.0035, 0.00225)  # isotherm grid, degrees (≈ 250 m): smooth lines from the same model
ISO_STEPS = (0.05, 0.1, 0.2, 0.25, 0.5, 1.0, 2.0)  # isotherm intervals (°C); the finest giving ≤ ISO_MAX_LEVELS
ISO_MAX_LEVELS = 12

# Clips GeoJSON geometries ($2, text[]) to the region's municipality ($1 = ARS): index i
# (1-based) of every geometry that is left, with its clipped shape, kept to one dimension
# ($3: 2 lines, 3 polygons; a cut along the boundary yields stray points or lines). No
# boundary imported: all unclipped.
CLIP = """
WITH r AS (SELECT geom FROM admin_units WHERE level = 'gem' AND ars = $1 LIMIT 1),
g AS (SELECT i, ST_SetSRID(ST_GeomFromGeoJSON(j), 4326) AS geom FROM unnest($2::text[]) WITH ORDINALITY AS t(j, i))
SELECT g.i, ST_AsGeoJSON(CASE WHEN r.geom IS NULL THEN g.geom ELSE ST_CollectionExtract(ST_Intersection(g.geom, r.geom), $3) END, 6) AS geometry
FROM g LEFT JOIN r ON true
WHERE r.geom IS NULL OR ST_Intersects(g.geom, r.geom)
ORDER BY g.i
"""


async def _clip(pool: asyncpg.Pool, geometries: list[dict], dim: int) -> dict[int, dict]:
    """Geometries clipped to the region boundary, by their 0-based index (those outside it left out)."""
    rows = await pool.fetch(CLIP, settings.region_ars, [json.dumps(g) for g in geometries], dim)
    out = {}
    for r in rows:
        g = json.loads(r["geometry"]) if r["geometry"] else None
        if g and g.get("coordinates"):
            out[r["i"] - 1] = g
    return out


def _idw(stations: list, lon: np.ndarray, lat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Inverse-distance weighting (power 2) of the stations' summer mean daily maximum at the
    points (arrays of one shape): temperature (°C) and distance to the nearest station (km)."""
    rad = math.pi / 180
    km = np.stack(
        [
            12742 * np.arcsin(np.sqrt(np.sin((st["lat"] - lat) * rad / 2) ** 2 + np.cos(lat * rad) * math.cos(st["lat"] * rad) * np.sin((st["lon"] - lon) * rad / 2) ** 2))
            for st in stations
        ]
    )
    weights = 1 / np.maximum(km, 0.1) ** 2
    tmax = np.array([st["tmax"] for st in stations], dtype="float64").reshape((-1,) + (1,) * lon.ndim)
    return (weights * tmax).sum(axis=0) / weights.sum(axis=0), km.min(axis=0)


def _geojson(features: list[dict]) -> Response:
    body = json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":"))
    return Response(content=body, media_type="application/geo+json", headers={"Cache-Control": "max-age=300"})


@router.get("/air-temp", responses={200: {"content": {"application/geo+json": {}}}})
async def air_temp(pool: asyncpg.Pool = Depends(get_pool)) -> Response:
    """2 m air temperature grid (≈ 1 km), modelled: inverse-distance weighting (power 2) of the
    summer (June–August) mean daily maximum at the DWD stations with ≥ 60 days of data,
    clipped to the region's municipality. Per cell: t (°C), heatClass, stations used,
    nearestKm (distance to the closest station, the main source of uncertainty), quality "modelled"."""
    stations = await pool.fetch(AIR_STATIONS)
    if not stations:
        return _empty_fc()
    w, s, e, n = settings.region_bbox
    rows, cols = math.ceil((n - s) / AIR_CELL[1]), math.ceil((e - w) / AIR_CELL[0])
    lon = w + (np.arange(cols) + 0.5) * AIR_CELL[0]
    lat = n - (np.arange(rows) + 0.5) * AIR_CELL[1]
    t, near = _idw(stations, *np.meshgrid(lon, lat))
    cells = [(r, c) for r in range(rows) for c in range(cols)]
    squares = []
    for r, c in cells:
        x0, y1 = w + c * AIR_CELL[0], n - r * AIR_CELL[1]
        x1, y0 = x0 + AIR_CELL[0], y1 - AIR_CELL[1]
        squares.append({"type": "Polygon", "coordinates": [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]})
    features = []
    for i, geometry in (await _clip(pool, squares, 3)).items():
        r, c = cells[i]
        tc = round(float(t[r, c]), 1)
        props = {
            "id": f"A-{r:02d}-{c:02d}",
            "t": tc,
            "heatClass": air_class(tc),
            "stations": len(stations),
            "nearestKm": round(float(near[r, c]), 1),
            "quality": "modelled",
            "year": stations[0]["season"],
            "lon": round(float(lon[c]), 5),
            "lat": round(float(lat[r]), 5),
        }
        features.append({"type": "Feature", "properties": props, "geometry": geometry})
    return _geojson(features)


# Marching squares: corner bits tl 8, tr 4, br 2, bl 1 (set = at or above the level) → the
# cell edges (top, right, bottom, left) each contour segment joins. The saddles 5 and 10
# depend on whether the cell centre is above the level.
EDGES = {1: [("l", "b")], 2: [("b", "r")], 3: [("l", "r")], 4: [("t", "r")], 6: [("t", "b")], 7: [("l", "t")], 8: [("l", "t")], 9: [("t", "b")], 11: [("t", "r")], 12: [("l", "r")], 13: [("b", "r")], 14: [("l", "b")]}
SADDLE = {(5, True): [("l", "t"), ("b", "r")], (5, False): [("t", "r"), ("l", "b")], (10, True): [("t", "r"), ("l", "b")], (10, False): [("l", "t"), ("b", "r")]}


def _contours(v: np.ndarray, level: float, west: float, north: float, dx: float, dy: float) -> list[list[list[float]]]:
    """Polylines where the node grid v (row 0 = north edge) crosses the level."""
    rows, cols = v.shape

    def crossing(side: str, r: int, c: int) -> tuple[tuple, list[float]]:
        # Key of the grid edge (the same for both cells beside it) and the crossing on it.
        if side == "t":
            key, a, b = ("h", r, c), (r, c), (r, c + 1)
        elif side == "b":
            key, a, b = ("h", r + 1, c), (r + 1, c), (r + 1, c + 1)
        elif side == "l":
            key, a, b = ("v", r, c), (r, c), (r + 1, c)
        else:
            key, a, b = ("v", r, c + 1), (r, c + 1), (r + 1, c + 1)
        va, vb = v[a], v[b]
        f = 0.5 if vb == va else (level - va) / (vb - va)
        y, x = a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])
        return key, [round(west + x * dx, 6), round(north - y * dy, 6)]

    links: dict[tuple, list[tuple]] = {}
    coords: dict[tuple, list[float]] = {}
    for r in range(rows - 1):
        for c in range(cols - 1):
            tl, tr, br, bl = v[r, c], v[r, c + 1], v[r + 1, c + 1], v[r + 1, c]
            case = int(tl >= level) * 8 + int(tr >= level) * 4 + int(br >= level) * 2 + int(bl >= level)
            pairs = SADDLE[(case, bool((tl + tr + br + bl) / 4 >= level))] if case in (5, 10) else EDGES.get(case, [])
            for e1, e2 in pairs:
                (k1, p1), (k2, p2) = crossing(e1, r, c), crossing(e2, r, c)
                coords[k1], coords[k2] = p1, p2
                links.setdefault(k1, []).append(k2)
                links.setdefault(k2, []).append(k1)
    # Walk the segments into polylines: from open ends (one link) first, then around rings.
    lines, seen = [], set()
    for start in [k for k, ks in links.items() if len(ks) == 1] + list(links):
        if start in seen:
            continue
        line, prev, cur = [start], None, start
        seen.add(start)
        while True:
            nxt = next((k for k in links[cur] if k != prev and k not in seen), None)
            if nxt is None:
                if len(line) > 2 and start in links[cur]:
                    line.append(start)  # closed ring
                break
            line.append(nxt)
            seen.add(nxt)
            prev, cur = cur, nxt
        if len(line) > 1:
            lines.append([coords[k] for k in line])
    return lines


@router.get("/air-temp/isotherms", responses={200: {"content": {"application/geo+json": {}}}})
async def air_isotherms(pool: asyncpg.Pool = Depends(get_pool)) -> Response:
    """Isotherms of the modelled air temperature (the /air-temp model on a ≈ 250 m grid),
    clipped to the region's municipality: one MultiLineString per level; t = the level (°C),
    step = the interval (the finest of 0.05–2 °C that gives at most 12 levels)."""
    stations = await pool.fetch(AIR_STATIONS)
    if not stations:
        return _empty_fc()
    w, s, e, n = settings.region_bbox
    rows, cols = math.ceil((n - s) / ISO_CELL[1]) + 1, math.ceil((e - w) / ISO_CELL[0]) + 1
    lon, lat = np.meshgrid(w + np.arange(cols) * ISO_CELL[0], n - np.arange(rows) * ISO_CELL[1])
    t, _ = _idw(stations, lon, lat)
    lo, hi = float(t.min()), float(t.max())
    step = next((x for x in ISO_STEPS if (hi - lo) / x <= ISO_MAX_LEVELS), ISO_STEPS[-1])
    levels = [round(k * step, 2) for k in range(math.ceil(lo / step), math.floor(hi / step) + 1) if lo < k * step < hi]
    shapes = [(lv, {"type": "MultiLineString", "coordinates": _contours(t, lv, w, n, *ISO_CELL)}) for lv in levels]
    shapes = [(lv, g) for lv, g in shapes if g["coordinates"]]
    clipped = await _clip(pool, [g for _, g in shapes], 2) if shapes else {}
    features = [
        {"type": "Feature", "properties": {"id": f"I-{shapes[i][0]:.2f}", "t": shapes[i][0], "step": step, "quality": "modelled", "year": stations[0]["season"]}, "geometry": geometry}
        for i, geometry in clipped.items()
    ]
    return _geojson(features)
