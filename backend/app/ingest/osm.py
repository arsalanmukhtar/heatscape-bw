"""Hospitals and drinking-water supply from OpenStreetMap (Overpass API) in the region bbox.

hospital: amenity=hospital. water: man_made=water_works, man_made=reservoir_covered and
man_made=pumping_station with substance=water (sewage and storm-water pumps left out).
Ways and relations are stored at their centre point.
"""

from app.config import settings
from app.ingest.common import client, log, overpass, record

QUERY = """
[out:json][timeout:90];
(
  nwr["amenity"="hospital"]({s},{w},{n},{e});
  nwr["man_made"~"^(water_works|reservoir_covered)$"]({s},{w},{n},{e});
  nwr["man_made"="pumping_station"]["substance"="water"]({s},{w},{n},{e});
);
out center tags;
"""


def _int(v: str | None) -> int | None:
    try:
        return int(v) if v else None
    except ValueError:
        return None


async def run(conn) -> int:
    w, s, e, n = settings.region_bbox
    async with client() as http:
        body = await overpass(http, QUERY.format(w=w, s=s, e=e, n=n))
    rows = []
    for el in body.get("elements", []):
        t = el.get("tags", {})
        lon, lat = (el["lon"], el["lat"]) if el["type"] == "node" else (el["center"]["lon"], el["center"]["lat"])
        kind = "hospital" if t.get("amenity") == "hospital" else "water"
        rows.append((f"{el['type'][0]}{el['id']}", kind, t.get("man_made") if kind == "water" else t.get("healthcare"), t.get("name"), t.get("operator"), _int(t.get("beds")), t.get("emergency"), lon, lat))
    async with conn.transaction():
        await conn.execute("DELETE FROM osm_facilities")
        await conn.executemany(
            """INSERT INTO osm_facilities (osm_id, kind, subtype, name, operator, beds, emergency, geom)
               VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326))""",
            rows,
        )
    await record(conn, "osm-facilities", status="ok", rows=len(rows), version=body.get("osm3s", {}).get("timestamp_osm_base"))
    log.info("osm-facilities: %d hospitals, %d water", sum(r[1] == "hospital" for r in rows), sum(r[1] == "water" for r in rows))
    return len(rows)
