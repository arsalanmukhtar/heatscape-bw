"""Administrative units.

bkg: BKG VG250-EW (Verwaltungsgebiete 1:250 000 with population, as of 31 Dec) for
all 16 Länder of Germany (STATE_KEYS; one file covers Germany, all
states go into the same table): states, Regierungsbezirke, Stadt-/Landkreise,
Verwaltungsgemeinschaften, Gemeinden (towns and villages). Land areas only (GF 4: the
Bodensee water parts are left out). The GeoPackage geometries (EPSG:25832) are read with
sqlite3 and transformed in PostGIS. VG250_FILE (env) = a local copy of the download (.zip or
.gpkg) to import instead of fetching it, for when the BKG server keeps dropping the download.

City districts and quarters (levels osm9, osm10) come from Overture divisions (overture.py);
PARENTS fills their containing Gemeinde, Kreis and state too.
"""

import os
import sqlite3
import tempfile
import zipfile
from pathlib import Path

from app.config import settings
from app.ingest.common import download, log, record

VG250 = "https://daten.gdz.bkg.bund.de/produkte/vg/vg250-ew_ebenen_1231/aktuell/vg250-ew_12-31.utm32s.gpkg.ebenen.zip"
# Länderschlüssel 01 (Schleswig-Holstein) to 16 (Thüringen): all of Germany.
STATE_KEYS = tuple(f"{k:02d}" for k in range(1, 17))
BKG_LEVELS = {"land": "vg250_lan", "rbz": "vg250_rbz", "krs": "vg250_krs", "vwg": "vg250_vwg", "gem": "vg250_gem"}

# Containing units: Land by the first 2 ARS digits, Kreis by the first 5, Regierungsbezirk by
# the first 3 (Rheinland-Pfalz has none); OSM units take theirs from the Gemeinde they lie in.
PARENTS = """
UPDATE admin_units u SET state = l.name FROM admin_units l
 WHERE l.level = 'land' AND u.level IN ('land', 'rbz', 'krs', 'vwg', 'gem') AND left(u.ars, 2) = left(l.ars, 2);
UPDATE admin_units u SET district = k.name FROM admin_units k
 WHERE k.level = 'krs' AND u.level IN ('vwg', 'gem') AND left(u.ars, 5) = k.ars;
UPDATE admin_units u SET region = r.name FROM admin_units r
 WHERE r.level = 'rbz' AND u.level IN ('krs', 'vwg', 'gem') AND left(u.ars, 3) = r.ars;
UPDATE admin_units o SET district = g.name, region = g.region, state = g.state FROM admin_units g
 WHERE g.level = 'gem' AND o.level IN ('osm9', 'osm10') AND ST_Contains(g.geom, ST_PointOnSurface(o.geom));
"""


def _wkb(blob: bytes) -> bytes:
    """GeoPackage geometry blob → WKB: skip the 8-byte header and the envelope (flags bits 1–3)."""
    env = (blob[3] >> 1) & 0b111
    return blob[8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env] :]


async def run_bkg(conn) -> int:
    with tempfile.TemporaryDirectory() as tmp:
        local = os.environ.get("VG250_FILE")
        if local:
            log.info("bkg-vg250: reading %s instead of downloading", local)
            archive = Path(local)
        else:
            archive = Path(tmp) / "vg250.zip"
            await download(VG250, archive)
        if archive.suffix.lower() == ".gpkg":
            gpkg = str(archive)
        else:
            with zipfile.ZipFile(archive) as z:
                member = next(n for n in z.namelist() if n.endswith(".gpkg"))
                gpkg = z.extract(member, tmp)
            if not local:
                archive.unlink()
        db = sqlite3.connect(gpkg)
        # Geometry column per table, as the GeoPackage declares it.
        geom_col = dict(db.execute("SELECT lower(table_name), column_name FROM gpkg_geometry_columns"))
        rows = []
        for level, table in BKG_LEVELS.items():
            for ars, ags, gen, bez, ewz, kfl, nuts, geom in db.execute(
                f'SELECT ARS, AGS, GEN, BEZ, EWZ, KFL, NUTS, "{geom_col[table]}" FROM "{table}" WHERE SN_L IN ({",".join("?" * len(STATE_KEYS))}) AND GF = 4',
                STATE_KEYS,
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
