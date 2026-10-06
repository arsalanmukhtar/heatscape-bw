"""DWD weather warnings for the region's warn cells (municipality and district layers).

Heat warnings are events with EC_II 247 (STARKE HITZE) and 248 (EXTREME HITZE). The table
holds the warnings active at the last fetch (replaced each run).
"""

from datetime import datetime

from app.config import settings
from app.ingest.common import client, log, record

WFS = "https://maps.dwd.de/geoserver/dwd/ows"
# Layer → its warn-cell field (the district layer names it GC_WARNCELLID).
LAYERS = {"dwd:Warnungen_Gemeinden": "WARNCELLID", "dwd:Warnungen_Landkreise": "GC_WARNCELLID"}
FIELDS = "IDENTIFIER,AREADESC,EVENT,EC_II,SEVERITY,HEADLINE,DESCRIPTION,INSTRUCTION,ONSET,EXPIRES,SENT"


def _ts(v: str | None) -> datetime | None:
    return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None


async def run(conn) -> int:
    cells = ",".join(str(c) for c in settings.dwd_warncells)
    rows = {}
    async with client() as http:
        for layer, cell in LAYERS.items():
            res = await http.get(
                WFS,
                params={
                    "service": "WFS",
                    "version": "2.0.0",
                    "request": "GetFeature",
                    "typeName": layer,
                    "outputFormat": "application/json",
                    "propertyName": f"{cell},{FIELDS}",
                    "CQL_FILTER": f"{cell} IN ({cells})",
                },
            )
            res.raise_for_status()
            for f in res.json().get("features", []):
                p = f["properties"]
                rows[p["IDENTIFIER"]] = (
                    p["IDENTIFIER"],
                    int(p[cell]),
                    p.get("AREADESC"),
                    p.get("EVENT") or "",
                    int(p["EC_II"]) if p.get("EC_II") not in (None, "") else None,
                    p.get("SEVERITY"),
                    p.get("HEADLINE"),
                    p.get("DESCRIPTION"),
                    p.get("INSTRUCTION"),
                    _ts(p.get("ONSET")),
                    _ts(p.get("EXPIRES")),
                    _ts(p.get("SENT")),
                )
    async with conn.transaction():
        await conn.execute("DELETE FROM dwd_warnings")
        await conn.executemany(
            """INSERT INTO dwd_warnings (identifier, warncell_id, area, event, ec_ii, severity, headline, description, instruction, onset, expires, sent)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)""",
            list(rows.values()),
        )
    await record(conn, "dwd-warnings", status="ok", rows=len(rows), version=datetime.now().strftime("%Y-%m-%d %H:%M"))
    log.info("dwd-warnings: %d active warnings", len(rows))
    return len(rows)
