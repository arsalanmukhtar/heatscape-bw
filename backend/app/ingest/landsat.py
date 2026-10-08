"""Landsat 8/9 land surface temperature (Collection 2 Level-2, band ST_B10) from Microsoft
Planetary Computer: STAC search, anonymous SAS token, COGs read for the region window only.

Per summer (June–August) and per cell of a ~100 m lon/lat grid over the region bbox (GRID):
p05, p50 (median), p95 of the clear-sky scenes and their count n → lst_composites. Clouds,
cloud shadow, cirrus, snow and fill are masked with QA_PIXEL; each scene's 30 m pixels are
averaged into the grid cells. Scenes with less than MIN_CLEAR of the region clear are skipped.

Summers already stored and complete are kept; the current summer (and one not yet complete)
is recomputed on every run, so the composite grows with new scenes until mid-September.
"""

import asyncio
import datetime as dt
import math
import warnings

import numpy as np
import rasterio
from rasterio.errors import RasterioIOError
from rasterio.transform import from_bounds as transform_from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds
from rasterio.windows import Window, from_bounds

from app.config import settings
from app.ingest.common import client, log, record

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
TOKEN = "https://planetarycomputer.microsoft.com/api/sas/v1/token/landsat-c2-l2"
COLLECTION = "landsat-c2-l2"
MAX_CLOUD = 70  # scene-level cloud cover (%) worth opening; pixels are masked anyway
MIN_CLEAR = 0.2  # share of the region that must be clear for a scene to count
SCALE, OFFSET = 0.00341802, 149.0  # ST_B10 → kelvin
# QA_PIXEL bits that mask a pixel: fill, dilated cloud, cirrus, cloud, cloud shadow, snow.
QA_MASK = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5)
CELL = (0.0014, 0.0009)  # grid cell, degrees lon × lat (≈ 100 m × 100 m at 49.5° N)
GDAL_ENV = {"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "GDAL_HTTP_MAX_RETRY": "3", "GDAL_HTTP_RETRY_DELAY": "2", "VSI_CACHE": "TRUE"}


def grid() -> dict:
    """The composite grid over the region bbox: bounds [w, s, e, n], cols, rows, transform."""
    w, s, e, n = settings.region_bbox
    cols, rows = math.ceil((e - w) / CELL[0]), math.ceil((n - s) / CELL[1])
    e, s = w + cols * CELL[0], n - rows * CELL[1]
    return {"bounds": [w, s, e, n], "cols": cols, "rows": rows, "transform": transform_from_bounds(w, s, e, n, cols, rows)}


async def _search(http, year: int) -> list[dict]:
    """Landsat 8/9 L2 items over the region in June–August of the year, oldest first."""
    body = {
        "collections": [COLLECTION],
        "bbox": list(settings.region_bbox),
        "datetime": f"{year}-06-01T00:00:00Z/{year}-08-31T23:59:59Z",
        "query": {"eo:cloud_cover": {"lt": MAX_CLOUD}, "platform": {"in": ["landsat-8", "landsat-9"]}},
        "limit": 100,
    }
    items = []
    while body:
        res = await http.post(STAC, json=body)
        res.raise_for_status()
        page = res.json()
        items += page.get("features", [])
        nxt = next((link for link in page.get("links", []) if link.get("rel") == "next"), None)
        body = nxt.get("body") if nxt and nxt.get("method", "GET") == "POST" else None
    return sorted(items, key=lambda it: it["properties"]["datetime"])


def _scene(lwir: str, qa: str, g: dict) -> np.ndarray | None:
    """One scene on the grid (°C, NaN = masked), or None when too little of it is clear."""
    with rasterio.Env(**GDAL_ENV), rasterio.open(lwir) as st, rasterio.open(qa) as q:
        box = transform_bounds("EPSG:4326", st.crs, *g["bounds"], densify_pts=21)
        win = from_bounds(*box, transform=st.transform).round_offsets().round_lengths()
        win = win.intersection(Window(0, 0, st.width, st.height))
        dn = st.read(1, window=win).astype("float32")
        bits = q.read(1, window=win)
        celsius = np.where((dn == 0) | (bits & QA_MASK != 0), np.nan, dn * SCALE + OFFSET - 273.15).astype("float32")
        out = np.full((g["rows"], g["cols"]), np.nan, dtype="float32")
        reproject(
            celsius,
            out,
            src_transform=st.window_transform(win),
            src_crs=st.crs,
            src_nodata=np.nan,
            dst_transform=g["transform"],
            dst_crs="EPSG:4326",
            dst_nodata=np.nan,
            resampling=Resampling.average,
        )
    clear = np.isfinite(out).mean()
    return out if clear >= MIN_CLEAR else None


def _composite(stack: list[np.ndarray]) -> tuple[list, list, list, list]:
    """Per cell p05, p50, p95 (°C, 0.1) and the clear-scene count; None where no scene is clear."""
    cube = np.stack(stack)
    n = np.isfinite(cube).sum(axis=0)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN cells
        p05, p50, p95 = np.nanpercentile(cube, [5, 50, 95], axis=0)
    as_list = lambda a: [None if not math.isfinite(x) else round(float(x), 1) for x in a.ravel()]  # noqa: E731
    return as_list(p05), as_list(p50), as_list(p95), [int(x) for x in n.ravel()]


async def _sign(http) -> str:
    res = await http.get(TOKEN)
    res.raise_for_status()
    return res.json()["token"]


async def run(conn) -> int:
    g = grid()
    today = dt.date.today()
    last = today.year if today >= dt.date(today.year, 6, 1) else today.year - 1
    complete = {r["year"] for r in await conn.fetch("SELECT year FROM lst_composites WHERE complete")}
    years = [y for y in range(settings.lst_first_year, last + 1) if y not in complete]
    stored = 0
    async with client() as http:
        for year in years:
            items = await _search(http, year)
            token = await _sign(http)
            stack, used = [], []
            for it in items:
                a = it["assets"]
                if "lwir11" not in a or "qa_pixel" not in a:
                    continue
                try:
                    scene = await asyncio.to_thread(_scene, f"{a['lwir11']['href']}?{token}", f"{a['qa_pixel']['href']}?{token}", g)
                except RasterioIOError as exc:  # one unreadable scene must not stop the summer
                    log.warning("landsat-lst %s: %s skipped (%s)", year, it["id"], exc)
                    continue
                if scene is not None:
                    stack.append(scene)
                    used.append(it["id"])
            done = year < today.year or today > dt.date(year, 9, 15)
            if not stack:
                log.info("landsat-lst %d: %d scenes found, none clear enough", year, len(items))
                continue
            p05, p50, p95, n = await asyncio.to_thread(_composite, stack)
            await conn.execute(
                """INSERT INTO lst_composites (year, west, south, east, north, cols, rows, p05, p50, p95, n, scenes, complete, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
                   ON CONFLICT (year) DO UPDATE SET west = EXCLUDED.west, south = EXCLUDED.south, east = EXCLUDED.east, north = EXCLUDED.north,
                     cols = EXCLUDED.cols, rows = EXCLUDED.rows, p05 = EXCLUDED.p05, p50 = EXCLUDED.p50, p95 = EXCLUDED.p95, n = EXCLUDED.n,
                     scenes = EXCLUDED.scenes, complete = EXCLUDED.complete, created_at = now()""",
                year,
                *g["bounds"],
                g["cols"],
                g["rows"],
                p05,
                p50,
                p95,
                n,
                used,
                done,
            )
            stored += 1
            log.info("landsat-lst %d: %d of %d scenes clear enough, composite stored%s", year, len(used), len(items), "" if done else " (summer not complete)")
    latest = await conn.fetchval("SELECT max(year) FROM lst_composites")
    await record(conn, "landsat-lst", status="ok", rows=stored, version=f"summers {settings.lst_first_year}–{latest}" if latest else None)
    return stored
