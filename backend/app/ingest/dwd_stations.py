"""DWD climate stations around the region (Climate Data Center, CDC).

- Station list: the daily-KL station description (fixed-width text); active stations within
  dwd_station_radius_km of the region centre.
- Daily values (run "daily"): the recent KL archive per station (about the last 500 days):
  mean, max, min air temperature, precipitation.
- Latest (run "latest"): the 10-minute "now" air temperature file per station.
"""

import io
import math
import re
import zipfile
from datetime import date, datetime, timedelta, timezone

from app.config import settings
from app.ingest.common import client, log, num, record

CDC = "https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate"
STATIONS = f"{CDC}/daily/kl/recent/KL_Tageswerte_Beschreibung_Stationen.txt"
DAILY = f"{CDC}/daily/kl/recent/tageswerte_KL_{{id}}_akt.zip"
LATEST = f"{CDC}/10_minutes/air_temperature/now/10minutenwerte_TU_{{id}}_now.zip"


def _km(lon1, lat1, lon2, lat2) -> float:
    r = math.pi / 180
    a = math.sin((lat2 - lat1) * r / 2) ** 2 + math.cos(lat1 * r) * math.cos(lat2 * r) * math.sin((lon2 - lon1) * r / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


# id, from, to, elevation, lat, lon, name (may contain single spaces), state; padded columns.
_ROW = re.compile(r"^(\d{5})\s+(\d{8})\s+(\d{8})\s+(-?\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(.+?)\s{2,}(\S+)")


def _stations(text: str) -> list[tuple]:
    """Parses the station list (fixed-width text; data rows are not aligned to the header)."""
    out = []
    for line in text.splitlines()[2:]:
        m = _ROW.match(line)
        if not m:
            continue
        sid, frm, to, elev, lat, lon, name, state = m.groups()
        out.append((sid, name.strip(), state, float(elev), datetime.strptime(frm, "%Y%m%d").date(), datetime.strptime(to, "%Y%m%d").date(), float(lon), float(lat)))
    return out


def _product(content: bytes) -> list[list[str]]:
    """Rows (split on ';') of the produkt_*.txt file in a CDC zip, header dropped."""
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        name = next(n for n in z.namelist() if n.startswith("produkt"))
        lines = z.read(name).decode("latin-1").splitlines()
    head = [c.strip() for c in lines[0].split(";")]
    return [dict(zip(head, (c.strip() for c in line.split(";")))) for line in lines[1:] if line.strip()]


async def _region_stations(conn, http) -> list[str]:
    res = await http.get(STATIONS)
    res.raise_for_status()
    lon0, lat0 = settings.region_center
    recent = date.today() - timedelta(days=14)
    near = [s for s in _stations(res.content.decode("latin-1")) if s[5] >= recent and _km(lon0, lat0, s[6], s[7]) <= settings.dwd_station_radius_km]
    await conn.executemany(
        """INSERT INTO dwd_stations (id, name, state, elevation_m, data_from, data_to, geom)
           VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326))
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, state = EXCLUDED.state, elevation_m = EXCLUDED.elevation_m,
             data_from = EXCLUDED.data_from, data_to = EXCLUDED.data_to, geom = EXCLUDED.geom""",
        near,
    )
    return [s[0] for s in near]


async def run_daily(conn) -> int:
    total = 0
    async with client() as http:
        ids = await _region_stations(conn, http)
        for sid in ids:
            res = await http.get(DAILY.format(id=sid))
            if res.status_code == 404:  # station without a recent KL archive
                continue
            res.raise_for_status()
            rows = [
                (sid, datetime.strptime(r["MESS_DATUM"], "%Y%m%d").date(), num(r["TMK"]), num(r["TXK"]), num(r["TNK"]), num(r["RSK"]))
                for r in _product(res.content)
            ]
            await conn.executemany(
                """INSERT INTO dwd_daily (station_id, day, tmean, tmax, tmin, precip) VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT (station_id, day) DO UPDATE SET tmean = EXCLUDED.tmean, tmax = EXCLUDED.tmax, tmin = EXCLUDED.tmin, precip = EXCLUDED.precip""",
                rows,
            )
            total += len(rows)
    await record(conn, "dwd-stations", status="ok", rows=total, version=date.today().isoformat())
    log.info("dwd-stations daily: %d stations, %d rows", len(ids), total)
    return total


async def run_latest(conn) -> int:
    ids = [r["id"] for r in await conn.fetch("SELECT id FROM dwd_stations")]
    n = 0
    async with client() as http:
        if not ids:
            ids = await _region_stations(conn, http)
        for sid in ids:
            res = await http.get(LATEST.format(id=sid))
            if res.status_code == 404:  # station without 10-minute temperature
                continue
            res.raise_for_status()
            rows = [r for r in _product(res.content) if num(r.get("TT_10", "")) is not None]
            if not rows:
                continue
            last = rows[-1]
            # 10-minute data are in UTC.
            at = datetime.strptime(last["MESS_DATUM"], "%Y%m%d%H%M").replace(tzinfo=timezone.utc)
            await conn.execute(
                """INSERT INTO dwd_latest (station_id, observed_at, t2m, humidity) VALUES ($1, $2, $3, $4)
                   ON CONFLICT (station_id) DO UPDATE SET observed_at = EXCLUDED.observed_at, t2m = EXCLUDED.t2m, humidity = EXCLUDED.humidity""",
                sid,
                at,
                num(last["TT_10"]),
                num(last.get("RF_10", "")),
            )
            n += 1
    log.info("dwd-stations latest: %d stations", n)
    return n
