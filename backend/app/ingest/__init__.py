"""Open-data imports (Phase 1 live data). Run one by name, or let the worker schedule them:

    python -m app.ingest <job> [<job> ...]   # jobs: see JOBS; "all" runs every job once
    python -m app.ingest.schedule            # worker loop (docker compose service "worker")
"""

from app.ingest import admin_units, dwd_forecast, dwd_stations, dwd_warnings, osm, zensus

# job → (dataset id, coroutine(conn), refresh interval in seconds; None = on demand / once).
JOBS = {
    "dwd-warnings": ("dwd-warnings", dwd_warnings.run, 10 * 60),
    "dwd-forecast": ("dwd-forecast", dwd_forecast.run, 60 * 60),
    "dwd-stations": ("dwd-stations", dwd_stations.run_daily, 6 * 60 * 60),
    "dwd-latest": ("dwd-stations", dwd_stations.run_latest, 20 * 60),
    "osm-facilities": ("osm-facilities", osm.run, 7 * 24 * 60 * 60),
    "zensus-grid": ("zensus-grid", zensus.run, None),
    "bkg-vg250": ("bkg-vg250", admin_units.run_bkg, None),
    "osm-admin": ("osm-admin", admin_units.run_osm, 30 * 24 * 60 * 60),
}
