"""Zensus 2022 100 m grid (Destatis): population and mean age for the region.

The national CSVs (EPSG:3035 cell centres) are streamed from the zip and only cells inside
the region bbox are kept; cells become 100 m squares transformed to EPSG:4326. Run on
demand (the data are a fixed census release).
"""

import csv
import io
import tempfile
import zipfile
from typing import BinaryIO

from app.config import settings
from app.ingest.common import client, log, num, record

BASE = "https://www.destatis.de/static/DE/zensus/gitterdaten"
FILES = {
    "population": (f"{BASE}/Zensus2022_Bevoelkerungszahl.zip", "Einwohner"),
    "mean_age": (f"{BASE}/Durchschnittsalter_in_Gitterzellen.zip", "Durchschnittsalter"),
}


async def _download(http, url: str) -> BinaryIO:
    """Streams a zip to a temporary file (tens of MB) and returns it rewound."""
    f = tempfile.TemporaryFile()
    async with http.stream("GET", url) as res:
        res.raise_for_status()
        async for chunk in res.aiter_bytes(1 << 20):
            f.write(chunk)
    f.seek(0)
    return f


def _cells(f, column: str, box: tuple[float, float, float, float]) -> dict[str, tuple[float, float, float | None]]:
    """grid id → (x, y, value) for cells whose centre lies in box (EPSG:3035)."""
    x0, y0, x1, y1 = box
    out = {}
    with zipfile.ZipFile(f) as z:
        name = next(n for n in z.namelist() if n.endswith("100m-Gitter.csv"))
        with z.open(name) as raw:
            reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""), delimiter=";")
            for r in reader:
                x, y = float(r["x_mp_100m"]), float(r["y_mp_100m"])
                if x0 <= x <= x1 and y0 <= y <= y1:
                    out[r["GITTER_ID_100m"]] = (x, y, num(r[column]))
    return out


async def run(conn) -> int:
    w, s, e, n = settings.region_bbox
    # Region bbox in EPSG:3035 (LAEA Europe), the grid's own CRS.
    b = await conn.fetchrow(
        "SELECT ST_XMin(g) x0, ST_YMin(g) y0, ST_XMax(g) x1, ST_YMax(g) y1 FROM (SELECT ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3035) g) t",
        float(w), float(s), float(e), float(n),
    )
    box = (b["x0"], b["y0"], b["x1"], b["y1"])
    values: dict[str, dict[str, tuple]] = {}
    async with client() as http:
        for key, (url, column) in FILES.items():
            with await _download(http, url) as f:
                values[key] = _cells(f, column, box)
    pop, age = values["population"], values["mean_age"]
    rows = []
    for gid in pop.keys() | age.keys():
        x, y, _ = pop.get(gid) or age[gid]
        p = pop.get(gid, (0, 0, None))[2]
        rows.append((gid, int(p) if p is not None else None, age.get(gid, (0, 0, None))[2], x, y))
    async with conn.transaction():
        await conn.execute("DELETE FROM zensus_grid")
        await conn.executemany(
            """INSERT INTO zensus_grid (grid_id, population, mean_age, geom)
               VALUES ($1, $2, $3, ST_Transform(ST_MakeEnvelope($4::float8 - 50, $5::float8 - 50, $4::float8 + 50, $5::float8 + 50, 3035), 4326))""",
            rows,
        )
    await record(conn, "zensus-grid", status="ok", rows=len(rows), version="Zensus 2022 (census day 15 May 2022)")
    log.info("zensus-grid: %d cells", len(rows))
    return len(rows)
