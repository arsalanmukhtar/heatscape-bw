"""Shared pieces of the open-data imports: DB connection, HTTP client, dataset records."""

import asyncio
import logging
from pathlib import Path
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
    "overture-places": {
        "title": "Hospitals (Overture Maps places)",
        "source": "Overture Maps Foundation, places theme (GeoParquet on S3)",
        "url": "https://docs.overturemaps.org/guides/places/",
        "licence": "CDLA-Permissive-2.0",
        "attribution": "overture",
    },
    "osm-water": {
        "title": "Drinking-water supply (OpenStreetMap)",
        "source": "OpenStreetMap contributors, Overpass API",
        "url": "https://www.openstreetmap.org",
        "licence": "ODbL 1.0",
        "attribution": "osm",
    },
    "bkg-vg250": {
        "title": "Administrative units of Baden-Württemberg, Hessen, Rheinland-Pfalz, Bayern (VG250-EW): state to municipality",
        "source": "Bundesamt für Kartographie und Geodäsie (BKG), VG250-EW Ebenen",
        "url": "https://gdz.bkg.bund.de/index.php/default/verwaltungsgebiete-1-250-000-mit-einwohnerzahlen-ebenen-stand-31-12-vg250-ew-ebenen-31-12.html",
        "licence": "dl-de/by-2-0",
        "attribution": "bkg",
    },
    "overture-divisions": {
        "title": "City districts and quarters (Overture Maps divisions, from OpenStreetMap)",
        "source": "Overture Maps Foundation, divisions theme (GeoParquet on S3)",
        "url": "https://docs.overturemaps.org/guides/divisions/",
        "licence": "ODbL 1.0",
        "attribution": "overture",
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


async def download(url: str, path: Path, attempts: int = 6) -> None:
    """Streams a large file to path. A dropped connection resumes from the bytes already on
    disk (HTTP Range) instead of starting over; gives up after `attempts` tries."""
    async with client() as http:
        for attempt in range(1, attempts + 1):
            have = path.stat().st_size if path.exists() else 0
            headers = {"Range": f"bytes={have}-"} if have else {}
            try:
                async with http.stream("GET", url, headers=headers) as res:
                    if res.status_code == 416:  # nothing left to fetch
                        return
                    res.raise_for_status()
                    # 206: the server resumes; 200: it ignored the range, so start over.
                    with path.open("ab" if res.status_code == 206 else "wb") as f:
                        async for chunk in res.aiter_bytes(1 << 20):
                            f.write(chunk)
                    total = res.headers.get("content-range", "").rpartition("/")[2] or res.headers.get("content-length")
                if not total or not total.isdigit() or path.stat().st_size >= int(total):
                    return
                raise httpx.RemoteProtocolError(f"incomplete: {path.stat().st_size} of {total} bytes")
            except (httpx.TransportError, httpx.RemoteProtocolError) as exc:
                if attempt == attempts:
                    raise
                log.warning("download %s interrupted at %d bytes (%s); resuming (%d/%d)", url, path.stat().st_size if path.exists() else 0, exc, attempt, attempts - 1)
                await asyncio.sleep(5 * attempt)


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


OVERPASS_ROUNDS = 3  # passes over the server list
OVERPASS_WAIT_S = 30  # pause between passes (× pass number)


async def overpass(http: httpx.AsyncClient, query: str) -> dict:
    """Runs an Overpass query on the main server, then the mirrors (settings) when one is busy
    (429/504, an HTML error page) or unreachable; OVERPASS_ROUNDS passes over the list with a
    growing pause between them. The error names the last server's answer."""
    servers = (settings.overpass_url, *settings.overpass_mirrors)
    last = "no answer"
    for rnd in range(1, OVERPASS_ROUNDS + 1):
        for url in servers:
            try:
                res = await http.post(url, data={"data": query})
            except httpx.TransportError as exc:
                last = f"{url}: {type(exc).__name__}"
                log.info("overpass %s unreachable (%s), trying the next server", url, type(exc).__name__)
                continue
            if res.status_code not in (429, 502, 503, 504) and res.headers.get("content-type", "").startswith("application/json"):
                res.raise_for_status()
                return res.json()
            last = f"{url}: HTTP {res.status_code}"
            log.info("overpass %s busy (HTTP %s), trying the next server", url, res.status_code)
        if rnd < OVERPASS_ROUNDS:
            log.info("all Overpass servers busy, retrying in %d s (%d/%d)", OVERPASS_WAIT_S * rnd, rnd, OVERPASS_ROUNDS - 1)
            await asyncio.sleep(OVERPASS_WAIT_S * rnd)
    raise RuntimeError(f"Overpass unavailable after {OVERPASS_ROUNDS} passes over {len(servers)} servers ({last})")


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
