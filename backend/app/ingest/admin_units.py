"""Administrative units.

bkg: BKG VG250-EW (Verwaltungsgebiete 1:250 000 with population, as of 31 Dec) for
Baden-Württemberg (Länderschlüssel 08): state, Regierungsbezirke, Stadt-/Landkreise,
Verwaltungsgemeinschaften, Gemeinden (towns and villages). Land areas only (GF 4: the
Bodensee water parts are left out). The GeoPackage geometries (EPSG:25832) are read with
sqlite3 and transformed in PostGIS.

osm: city districts and quarters (OSM boundary=administrative, admin_level 9 and 10) in the
region bbox, assembled from their member ways with ST_BuildArea.
"""

import json
import sqlite3
import tempfile
import zipfile
from pathlib import Path

from app.config import settings
from app.ingest.common import client, log, overpass, record

VG250 = "https://daten.gdz.bkg.bund.de/produkte/vg/vg250-ew_ebenen_1231/aktuell/vg250-ew_12-31.utm32s.gpkg.ebenen.zip"
STATE_KEY = "08"  # Baden-Württemberg
BKG_LEVELS = {"land": "vg250_lan", "rbz": "vg250_rbz", "krs": "vg250_krs", "vwg": "vg250_vwg", "gem": "vg250_gem"}

OSM_QUERY = """
[out:json][timeout:120];
relation["boundary"="administrative"]["admin_level"~"^(9|10)$"]({s},{w},{n},{e});
out geom;
"""

# Containing units: Kreis by the first 5 ARS digits, Regierungsbezirk by the first 3.
PARENTS = """
UPDATE admin_units u SET district = k.name FROM admin_units k
 WHERE k.level = 'krs' AND u.level IN ('vwg', 'gem') AND left(u.ars, 5) = k.ars;
UPDATE admin_units u SET region = r.name FROM admin_units r
 WHERE r.level = 'rbz' AND u.level IN ('krs', 'vwg', 'gem') AND left(u.ars, 3) = r.ars;
UPDATE admin_units o SET district = g.name, region = g.region FROM admin_units g
 WHERE g.level = 'gem' AND o.level IN ('osm9', 'osm10') AND ST_Contains(g.geom, ST_PointOnSurface(o.geom));
"""


def _wkb(blob: bytes) -> bytes:
    """GeoPackage geometry blob → WKB: skip the 8-byte header and the envelope (flags bits 1–3)."""
    env = (blob[3] >> 1) & 0b111
    return blob[8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env] :]


async def run_bkg(conn) -> int:
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp) / "vg250.zip"
        async with client() as http:
            async with http.stream("GET", VG250) as res:
                res.raise_for_status()
                with archive.open("wb") as f:
                    async for chunk in res.aiter_bytes(1 << 20):
                        f.write(chunk)
        with zipfile.ZipFile(archive) as z:
            member = next(n for n in z.namelist() if n.endswith(".gpkg"))
            gpkg = z.extract(member, tmp)
        archive.unlink()
        db = sqlite3.connect(gpkg)
        rows = []
        for level, table in BKG_LEVELS.items():
            for ars, ags, gen, bez, ewz, kfl, nuts, geom in db.execute(
                f'SELECT ARS, AGS, GEN, BEZ, EWZ, KFL, NUTS, geom FROM "{table}" WHERE SN_L = ? AND GF = 4',
                (STATE_KEY,),
            ):
                rows.append((f"{level}:{ars}", level, ars, ags, gen, bez, ewz, kfl, nuts, _wkb(geom)))
        db.close()
    async with conn.transaction():
        await conn.execute("DELETE FROM admin_units WHERE level = ANY($1::text[])", list(BKG_LEVELS))
        # A unit split into several land parts arrives as several rows: their geometries merge.
        await conn.executemany(
            """INSERT INTO admin_units (id, level, ars, ags, name, type, population, area_km2, nuts, geom)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_Multi(ST_Transform(ST_GeomFromWKB($10, 25832), 4326)))
               ON CONFLICT (id) DO UPDATE SET geom = ST_Multi(ST_Union(admin_units.geom, EXCLUDED.geom))""",
            rows,
        )
        await conn.execute(PARENTS)
    await record(conn, "bkg-vg250", status="ok", rows=len(rows), version="VG250-EW, Stand 31.12.")
    log.info("bkg-vg250: %s", ", ".join(f"{lv} {sum(r[1] == lv for r in rows)}" for lv in BKG_LEVELS))
    return len(rows)


async def run_osm(conn) -> int:
    w, s, e, n = settings.region_bbox
    async with client() as http:
        body = await overpass(http, OSM_QUERY.format(w=w, s=s, e=e, n=n))
    rows = []
    for el in body.get("elements", []):
        t = el.get("tags", {})
        lines = [[[p["lon"], p["lat"]] for p in m["geometry"]] for m in el.get("members", []) if m.get("type") == "way" and m.get("geometry")]
        if not lines or not t.get("name"):
            continue
        level = f"osm{t.get('admin_level')}"
        pop = t.get("population", "").replace(".", "").strip()
        rows.append((f"{level}:r{el['id']}", level, t["name"], "Stadtbezirk" if level == "osm9" else "Stadtteil", int(pop) if pop.isdigit() else None, json.dumps({"type": "MultiLineString", "coordinates": lines})))
    async with conn.transaction():
        await conn.execute("DELETE FROM admin_units WHERE level IN ('osm9', 'osm10')")
        # Member ways → polygons (outer and inner rings); relations that do not close are skipped.
        await conn.executemany(
            """INSERT INTO admin_units (id, level, name, type, population, area_km2, geom)
               SELECT $1, $2, $3, $4, $5, ST_Area(ST_Transform(g, 25832)) / 1e6, g
               FROM (SELECT ST_Multi(ST_CollectionExtract(ST_BuildArea(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)), 3)) g) a
               WHERE NOT ST_IsEmpty(g)""",
            rows,
        )
        await conn.execute(PARENTS)
    stored = await conn.fetchval("SELECT count(*) FROM admin_units WHERE level IN ('osm9', 'osm10')")
    await record(conn, "osm-admin", status="ok", rows=stored, version=body.get("osm3s", {}).get("timestamp_osm_base"))
    log.info("osm-admin: %d of %d relations stored", stored, len(rows))
    return stored
