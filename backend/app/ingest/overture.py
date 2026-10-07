"""Overture Maps (https://overturemaps.org): monthly GeoParquet releases on a public S3 bucket,
read for the region bbox with DuckDB (httpfs, anonymous: no API, no key, no rate limit).

places: hospitals (category hospital) → overture_places.
divisions: city districts and quarters (division_area subtypes macrohood and neighborhood)
→ admin_units levels osm9 and osm10 (the layer ids from the earlier OSM import are kept).

Probe (decides whether the Water Supply layer can move to Overture too):
    python -m app.ingest.overture        # base-theme classes in the bbox + water-like names

The latest release is found by listing the bucket (settings.overture_release pins one).
Only the columns a release has are read: the places schema has changed between releases.
"""

import asyncio
import re
import xml.etree.ElementTree as ET

import duckdb

from app.config import settings
from app.ingest.common import client, log, record

BUCKET = "overturemaps-us-west-2"
LIST_URL = f"https://{BUCKET}.s3.us-west-2.amazonaws.com/?list-type=2&prefix=release/&delimiter=/"
EXTENSIONS = "/opt/duckdb"  # httpfs is installed there in the image (backend/Dockerfile)
S3_NS = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}
HOSPITAL = ("hospital",)
DIVISION_LEVEL = {"macrohood": ("osm9", "District"), "neighborhood": ("osm10", "Quarter")}


async def latest_release() -> str:
    if settings.overture_release:
        return settings.overture_release
    async with client() as http:
        res = await http.get(LIST_URL)
        res.raise_for_status()
    found = [p.text.split("/")[1] for p in ET.fromstring(res.text).findall("s3:CommonPrefixes/s3:Prefix", S3_NS)]
    releases = [r for r in found if re.fullmatch(r"\d{4}-\d{2}-\d{2}\.\d+", r)]
    if not releases:
        raise RuntimeError("no Overture release found in the bucket listing")
    return max(releases, key=lambda r: (r.split(".")[0], int(r.split(".")[1])))


def _db() -> duckdb.DuckDBPyConnection:
    db = duckdb.connect()
    db.execute(f"SET extension_directory = '{EXTENSIONS}'")
    db.execute("LOAD httpfs")
    # Geometry stays WKB (no spatial extension): PostGIS reads it.
    db.execute("SET autoinstall_known_extensions = false; SET autoload_known_extensions = false; SET s3_region = 'us-west-2'")
    return db


def _source(release: str, theme: str, kind: str) -> str:
    """Parquet files of one type, or of all types of a theme (kind "*": the type then comes
    from the path, hive partitioning)."""
    hive = 1 if kind == "*" else 0
    return f"read_parquet('s3://{BUCKET}/release/{release}/theme={theme}/type={kind}/*', hive_partitioning = {hive}, union_by_name = 1)"


def _bbox() -> tuple[str, list[float]]:
    w, s, e, n = settings.region_bbox
    return "bbox.xmin <= ? AND bbox.xmax >= ? AND bbox.ymin <= ? AND bbox.ymax >= ?", [e, w, n, s]


def _columns(db, source: str) -> set[str]:
    return {r[0] for r in db.execute(f"DESCRIBE SELECT * FROM {source}").fetchall()}


def _query_places(release: str) -> list[tuple]:
    db = _db()
    try:
        src = _source(release, "places", "place")
        cols = _columns(db, src)
        cats = [x for x, c in (("categories.primary", "categories"), ("basic_category", "basic_category")) if c in cols]
        if not cats:
            raise RuntimeError(f"Overture places {release}: no category column (columns: {sorted(cols)})")
        category = f"coalesce({', '.join(cats)})"
        opt = lambda col, expr: expr if col in cols else "NULL"  # noqa: E731
        where, params = _bbox()
        return db.execute(
            f"""SELECT id, names.primary, {category}, {opt('confidence', 'confidence')},
                       {opt('addresses', 'addresses[1].freeform')}, {opt('addresses', 'addresses[1].postcode')},
                       {opt('addresses', 'addresses[1].locality')}, {opt('phones', 'phones[1]')},
                       {opt('websites', 'websites[1]')}, geometry
                FROM {src} WHERE {where} AND {category} IN ({', '.join('?' * len(HOSPITAL))})""",
            [*params, *HOSPITAL],
        ).fetchall()
    finally:
        db.close()


def _query_divisions(release: str) -> list[tuple]:
    db = _db()
    try:
        src = _source(release, "divisions", "division_area")
        cols = _columns(db, src)
        land = "AND (class IS NULL OR class = 'land')" if "class" in cols else ""
        where, params = _bbox()
        return db.execute(
            f"SELECT id, names.primary, subtype, geometry FROM {src} WHERE {where} AND subtype IN ('macrohood', 'neighborhood') {land}",
            params,
        ).fetchall()
    finally:
        db.close()


async def run_places(conn) -> int:
    release = await latest_release()
    rows = await asyncio.to_thread(_query_places, release)
    data = [
        (pid, name or "Hospital (unnamed)", cat, conf, address, postcode, locality, phone, website, bytes(geom))
        for pid, name, cat, conf, address, postcode, locality, phone, website, geom in rows
    ]
    async with conn.transaction():
        await conn.execute("DELETE FROM overture_places")
        # Areas (a few places are polygons) are stored at a point on their surface.
        await conn.executemany(
            """INSERT INTO overture_places (id, name, category, confidence, address, postcode, locality, phone, website, geom)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_PointOnSurface(ST_SetSRID(ST_GeomFromWKB($10), 4326)))""",
            data,
        )
    await record(conn, "overture-places", status="ok", rows=len(data), version=release)
    log.info("overture-places %s: %d hospitals", release, len(data))
    return len(data)


async def run_divisions(conn) -> int:
    from app.ingest.admin_units import PARENTS  # containing Gemeinde, Kreis, state

    release = await latest_release()
    rows = await asyncio.to_thread(_query_divisions, release)
    data = [(f"{DIVISION_LEVEL[sub][0]}:{did}", *DIVISION_LEVEL[sub], name, bytes(geom)) for did, name, sub, geom in rows if name]
    async with conn.transaction():
        await conn.execute("DELETE FROM admin_units WHERE level IN ('osm9', 'osm10')")
        # One unit split into several areas arrives as several rows: their geometries merge.
        await conn.executemany(
            """INSERT INTO admin_units (id, level, type, name, area_km2, geom)
               SELECT $1, $2, $3, $4, ST_Area(ST_Transform(g, 25832)) / 1e6, g
               FROM (SELECT ST_Multi(ST_CollectionExtract(ST_SetSRID(ST_GeomFromWKB($5), 4326), 3)) g) a
               WHERE NOT ST_IsEmpty(g)
               ON CONFLICT (id) DO UPDATE SET geom = ST_Multi(ST_Union(admin_units.geom, EXCLUDED.geom)),
                                              area_km2 = ST_Area(ST_Transform(ST_Union(admin_units.geom, EXCLUDED.geom), 25832)) / 1e6""",
            data,
        )
        await conn.execute(PARENTS)
    stored = await conn.fetchval("SELECT count(*) FROM admin_units WHERE level IN ('osm9', 'osm10')")
    await record(conn, "overture-divisions", status="ok", rows=stored, version=release)
    log.info("overture-divisions %s: %d districts and quarters", release, stored)
    return stored


WATER_NAMES = r"(?i)wasser|hochbeh|pumpwerk|brunnen|water|reservoir"


def _probe(release: str) -> None:
    db = _db()
    try:
        src = _source(release, "base", "*")
        where, params = _bbox()
        print(f"Overture {release}, theme=base, region bbox {settings.region_bbox}\n\nfeatures per type / subtype / class:")
        for kind, sub, cls, n in db.execute(f"SELECT type, subtype, class, count(*) FROM {src} WHERE {where} GROUP BY ALL ORDER BY 1, 2, 3", params).fetchall():
            print(f"  {kind:<14} {sub or '-':<22} {cls or '-':<28} {n}")
        print("\nwater-like names (wasser, hochbeh, pumpwerk, brunnen, water, reservoir):")
        for kind, sub, cls, name in db.execute(
            f"SELECT type, subtype, class, names.primary FROM {src} WHERE {where} AND regexp_matches(names.primary, ?) ORDER BY 1, 2, 3, 4",
            [*params, WATER_NAMES],
        ).fetchall():
            print(f"  {kind:<14} {sub or '-':<22} {cls or '-':<28} {name}")
    finally:
        db.close()


async def _main() -> None:
    release = await latest_release()
    await asyncio.to_thread(_probe, release)


if __name__ == "__main__":
    asyncio.run(_main())
