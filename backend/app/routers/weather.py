"""DWD warnings and forecast for the region (imported by the worker)."""

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.db import get_pool
from app.schemas.live import ForecastDay, PortalWarning, WeatherWarning

router = APIRouter(tags=["weather"])

HEAT = (247, 248)  # DWD EC_II: strong heat, extreme heat

# Local (Europe/Berlin) days of the forecast: today's remaining hours count for today.
FORECAST_DAYS = """
SELECT (step AT TIME ZONE 'Europe/Berlin')::date AS day, max(t2m) AS tmax, min(t2m) AS tmin
FROM dwd_forecast WHERE station_id = $1 AND step >= now() - interval '1 hour'
GROUP BY 1 ORDER BY 1
"""


@router.get("/weather/warnings", response_model=list[WeatherWarning])
async def warnings(pool: asyncpg.Pool = Depends(get_pool)) -> list[WeatherWarning]:
    """Active DWD warnings for the region's warn cells (all events), most severe first."""
    rows = await pool.fetch("SELECT * FROM dwd_warnings WHERE expires IS NULL OR expires > now() ORDER BY ec_ii DESC NULLS LAST, onset")
    return [WeatherWarning(**dict(r)) for r in rows]


@router.get("/weather/forecast", response_model=list[ForecastDay])
async def forecast(pool: asyncpg.Pool = Depends(get_pool)) -> list[ForecastDay]:
    """Daily highest and lowest 2 m air temperature from the DWD MOSMIX point forecast (°C)."""
    rows = await pool.fetch(FORECAST_DAYS, settings.dwd_mosmix_station)
    return [ForecastDay(**dict(r)) for r in rows]


@router.get("/portal/warning", response_model=PortalWarning)
async def portal_warning(pool: asyncpg.Pool = Depends(get_pool)) -> PortalWarning:
    """Heat warning card of the public portal: DWD heat warning level (now or later today) and
    the forecast highs and tonight's low for the city."""
    loaded = await pool.fetch("SELECT id, fetched_at FROM datasets WHERE id = ANY($1::text[]) AND status = 'ok'", ["dwd-warnings", "dwd-forecast"])
    if not loaded:
        raise HTTPException(status_code=503, detail="DWD warnings and forecast are not imported yet (worker starting, or run: python -m app.ingest dwd-warnings dwd-forecast).")
    heat = await pool.fetchrow(
        """SELECT ec_ii, area, onset, expires FROM dwd_warnings
           WHERE ec_ii = ANY($1::int[]) AND (expires IS NULL OR expires > now())
             AND (onset IS NULL OR (onset AT TIME ZONE 'Europe/Berlin')::date <= (now() AT TIME ZONE 'Europe/Berlin')::date)
           ORDER BY ec_ii DESC, onset LIMIT 1""",
        list(HEAT),
    )
    days = await pool.fetch(FORECAST_DAYS, settings.dwd_mosmix_station)
    night = await pool.fetchval(
        """SELECT min(t2m) FROM dwd_forecast
           WHERE station_id = $1
             AND step >= ((now() AT TIME ZONE 'Europe/Berlin')::date + time '18:00') AT TIME ZONE 'Europe/Berlin'
             AND step <  ((now() AT TIME ZONE 'Europe/Berlin')::date + 1 + time '09:00') AT TIME ZONE 'Europe/Berlin'""",
        settings.dwd_mosmix_station,
    )
    return PortalWarning(
        area=(heat["area"] if heat and heat["area"] else f"Stadt {settings.region_name}"),
        level="none" if not heat else ("extreme" if heat["ec_ii"] == 248 else "strong"),
        onset=heat["onset"] if heat else None,
        expires=heat["expires"] if heat else None,
        forecast_max=days[0]["tmax"] if len(days) > 0 else None,
        tomorrow_max=days[1]["tmax"] if len(days) > 1 else None,
        night_min=night,
        updated=max(r["fetched_at"] for r in loaded),
    )
