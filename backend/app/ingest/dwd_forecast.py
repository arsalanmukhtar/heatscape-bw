"""DWD MOSMIX_L point forecast for the region's station (hourly, about 10 days ahead).

The KMZ holds one KML with the time steps and one value row per element; temperatures are
in Kelvin. Stored: 2 m temperature (TTT) and the 12-hour max/min (TX, TN).
"""

import io
import re
import zipfile
from datetime import datetime

from app.config import settings
from app.ingest.common import client, log, record

URL = "https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/{id}/kml/MOSMIX_L_LATEST_{id}.kmz"


def _values(kml: str, element: str) -> list[float | None]:
    m = re.search(rf'elementName="{element}">\s*<dwd:value>([^<]*)</dwd:value>', kml)
    if not m:
        return []
    return [None if v == "-" else round(float(v) - 273.15, 1) for v in m.group(1).split()]


async def run(conn) -> int:
    station = settings.dwd_mosmix_station
    async with client() as http:
        res = await http.get(URL.format(id=station))
        res.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(res.content)) as z:
        kml = z.read(z.namelist()[0]).decode("latin-1")
    steps = [datetime.fromisoformat(s.replace("Z", "+00:00")) for s in re.findall(r"<dwd:TimeStep>([^<]+)</dwd:TimeStep>", kml)]
    ttt, tx, tn = _values(kml, "TTT"), _values(kml, "TX"), _values(kml, "TN")
    issued = re.search(r"<dwd:IssueTime>([^<]+)</dwd:IssueTime>", kml)
    rows = [(station, s, ttt[i] if i < len(ttt) else None, tx[i] if i < len(tx) else None, tn[i] if i < len(tn) else None) for i, s in enumerate(steps)]
    async with conn.transaction():
        await conn.execute("DELETE FROM dwd_forecast WHERE station_id = $1", station)
        await conn.executemany("INSERT INTO dwd_forecast (station_id, step, t2m, tmax12, tmin12) VALUES ($1, $2, $3, $4, $5)", rows)
    await record(conn, "dwd-forecast", status="ok", rows=len(rows), version=issued.group(1) if issued else None)
    log.info("dwd-forecast: %d steps for station %s", len(rows), station)
    return len(rows)
