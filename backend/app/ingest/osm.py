"""Drinking-water supply from OpenStreetMap (Overpass API) in the region bbox. Hospitals and
city districts come from Overture (overture.py); water stays here because Overture's base
theme has no water works or covered reservoirs (docs/decisions.md 57).

Drinking-water supply only: man_made=water_works,
man_made=reservoir_covered and man_made=pumping_station with substance=water. Left out:
sewage and storm-water tagging (content/substance/usage) and, as many such basins carry no
such tag, names of storm-water, overflow and wastewater works (NOT_DRINKING).
Ways and relations are stored at their centre point.
"""

import re

from app.config import settings
from app.ingest.common import client, log, overpass, record

QUERY = """
[out:json][timeout:90];
(
  nwr["man_made"="water_works"]["water_works"!~"^(sewage|wastewater)$"]({s},{w},{n},{e});
  nwr["man_made"="reservoir_covered"]["content"!~"^(sewage|wastewater|rainwater|stormwater|storm_water)$"]["usage"!~"^(sewage|stormwater|storm_water|flood_control)$"]({s},{w},{n},{e});
  nwr["man_made"="pumping_station"]["substance"="water"]({s},{w},{n},{e});
);
out center tags;
"""


# Storm-water / combined-sewer overflow basins and sewage works, by name (German and English).
NOT_DRINKING = re.compile(
    r"regen|überlauf|\brüb\b|\brrb\b|\brkb\b|rückhalte|klär|abwasser|misch|stauraumkanal|kanal|storm|overflow|sewage|waste",
    re.IGNORECASE,
)


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
        if NOT_DRINKING.search(" ".join(filter(None, (t.get("name"), t.get("description"), t.get("operator"))))):
            continue
        rows.append((f"{el['type'][0]}{el['id']}", "water", t.get("man_made"), t.get("name"), t.get("operator"), _int(t.get("beds")), t.get("emergency"), lon, lat))
    async with conn.transaction():
        await conn.execute("DELETE FROM osm_facilities")
        await conn.executemany(
            """INSERT INTO osm_facilities (osm_id, kind, subtype, name, operator, beds, emergency, geom)
               VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326))""",
            rows,
        )
    await record(conn, "osm-water", status="ok", rows=len(rows), version=body.get("osm3s", {}).get("timestamp_osm_base"))
    log.info("osm-water: %d drinking-water facilities", len(rows))
    return len(rows)
