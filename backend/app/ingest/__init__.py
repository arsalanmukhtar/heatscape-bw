"""Open-data imports (Phase 1 live data). Run one by name, or let the worker schedule them:

    python -m app.ingest <job> [<job> ...]   # jobs: see JOBS; "all" runs every job once
    python -m app.ingest.schedule            # worker loop (docker compose service "worker")
"""

from app.ingest import admin_units, dwd_forecast, dwd_stations, dwd_warnings, landsat, osm, overture, zensus

# job → (dataset id, coroutine(conn), refresh interval in seconds; None = once, kept for good).
# Order is run order on a pass: static reference data (admin units) first so their layers
# appear right after start-up, the large Zensus grid and the Landsat composites last.
JOBS = {
    "bkg-vg250": ("bkg-vg250", admin_units.run_bkg, None),
    "overture-divisions": ("overture-divisions", overture.run_divisions, 30 * 24 * 60 * 60),
    "dwd-warnings": ("dwd-warnings", dwd_warnings.run, 10 * 60),
    "dwd-forecast": ("dwd-forecast", dwd_forecast.run, 60 * 60),
    "dwd-stations": ("dwd-stations", dwd_stations.run_daily, 6 * 60 * 60),
    "dwd-latest": ("dwd-stations", dwd_stations.run_latest, 20 * 60),
    "overture-places": ("overture-places", overture.run_places, 7 * 24 * 60 * 60),
    "osm-water": ("osm-water", osm.run, 7 * 24 * 60 * 60),
    "zensus-grid": ("zensus-grid", zensus.run, None),
    # Long first run (every summer since lst_first_year); then only the current summer.
    "landsat-lst": ("landsat-lst", landsat.run, 7 * 24 * 60 * 60),
}
