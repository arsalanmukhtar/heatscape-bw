"""Shared pieces of the open-data imports: DB connection, HTTP client, dataset records."""

import asyncio
import logging
from datetime import datetime, timezone

import asyncpg
import httpx

from app.config import settings

log = logging.getLogger("ingest")

# Dataset catalogue: one entry per import, written to the datasets table on every run.
# attribution: provider key in frontend/src/lib/attribution.js.
DATASETS = {
    "dwd-warnings": {
        "title": "DWD weather warnings (incl. heat warnings)",
        "source": "Deutscher Wetterdienst, GeoServer WFS dwd:Warnungen_Gemeinden / _Landkreise",
        "url": "https://maps.dwd.de/geoserver/dwd/ows",
        "licence": "CC BY 4.0 (GeoNutzV)",
        "attribution": "dwd",
    },
    "dwd-forecast": {
        "title": "DWD MOSMIX_L point forecast",
        "source": "Deutscher Wetterdienst, Open Data (MOSMIX_L single station)",
        "url": "https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/",
        "licence": "CC BY 4.0 (GeoNutzV)",
        "attribution": "dwd",
    },
    "dwd-stations": {
        "title": "DWD climate stations: daily values and latest 10-minute temperature",
        "source": "Deutscher Wetterdienst, Climate Data Center (CDC)",
        "url": "https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/",
        "licence": "CC BY 4.0 (GeoNutzV)",
        "attribution": "dwd",
    },
    "osm-facilities": {
        "title": "Hospitals and drinking-water supply (OpenStreetMap)",
        "source": "OpenStreetMap contributors, Overpass API",
        "url": "https://www.openstreetmap.org",
        "licence": "ODbL 1.0",
        "attribution": "osm",
    },
    "bkg-vg250": {
        "title": "Administrative units of Baden-Württemberg (VG250-EW): state to municipality",
        "source": "Bundesamt für Kartographie und Geodäsie (BKG), VG250-EW Ebenen",
        "url": "https://gdz.bkg.bund.de/index.php/default/verwaltungsgebiete-1-250-000-mit-einwohnerzahlen-ebenen-stand-31-12-vg250-ew-ebenen-31-12.html",
        "licence": "dl-de/by-2-0",
        "attribution": "bkg",
    },
    "osm-admin": {
        "title": "City districts and quarters (OpenStreetMap admin_level 9/10)",
        "source": "OpenStreetMap contributors, Overpass API",
        "url": "https://www.openstreetmap.org",
        "licence": "ODbL 1.0",
        "attribution": "osm",
    },
    "zensus-grid": {
        "title": "Zensus 2022, 100 m grid: population and mean age",
        "source": "Statistisches Bundesamt (Destatis), Zensus 2022 Gitterzellen",
        "url": "https://www.zensus2022.de/DE/Ergebnisse-des-Zensus/gitterzellen.html",
        "licence": "dl-de/by-2-0",
        "attribution": "destatis",
    },
}


async def connect() -> asyncpg.Connection:
    return await asyncpg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
    )


def client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=settings.ingest_timeout_s,
        follow_redirects=True,
        headers={"User-Agent": settings.ingest_user_agent},
    )


async def record(conn: asyncpg.Connection, dataset: str, *, status: str, rows: int | None = None, version: str | None = None, message: str | None = None) -> None:
    """Upserts the dataset's catalogue row with the outcome of a run."""
    meta = DATASETS[dataset]
    await conn.execute(
        """
        INSERT INTO datasets (id, title, source, url, licence, attribution, version, fetched_at, rows, status, message)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title, source = EXCLUDED.source, url = EXCLUDED.url, licence = EXCLUDED.licence,
          attribution = EXCLUDED.attribution,
          version = COALESCE(EXCLUDED.version, datasets.version),
          fetched_at = CASE WHEN EXCLUDED.status = 'ok' THEN EXCLUDED.fetched_at ELSE datasets.fetched_at END,
          rows = COALESCE(EXCLUDED.rows, datasets.rows),
          status = EXCLUDED.status, message = EXCLUDED.message
        """,
        dataset,
        meta["title"],
        meta["source"],
        meta["url"],
        meta["licence"],
        meta["attribution"],
        version,
        datetime.now(timezone.utc),
        rows,
        status,
        message,
    )


async def overpass(http: httpx.AsyncClient, query: str) -> dict:
    """Runs an Overpass query; on a rate limit or timeout (429/504 or an HTML error page) it
    waits and tries once more."""
    for attempt in (1, 2):
        res = await http.post(settings.overpass_url, data={"data": query})
        busy = res.status_code in (429, 504) or not res.headers.get("content-type", "").startswith("application/json")
        if not busy:
            res.raise_for_status()
            return res.json()
        if attempt == 1:
            log.info("overpass busy (%s), retrying in 30 s", res.status_code)
            await asyncio.sleep(30)
    raise RuntimeError(f"Overpass unavailable (HTTP {res.status_code}): {res.text[:200]}")


def num(value: str) -> float | None:
    """A DWD/Destatis number: blanks, '-999' and '–' mean missing; decimal comma allowed."""
    v = value.strip().replace(",", ".")
    if not v or v in {"-", "–", "-999", "-999.0"}:
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    return None if x <= -999 else x
