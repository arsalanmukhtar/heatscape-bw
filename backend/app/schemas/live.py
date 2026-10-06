from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class Dataset(BaseModel):
    id: str
    title: str
    source: str
    url: str
    licence: str
    attribution: str = Field(..., description="Provider key of the credit line (frontend lib/attribution.js).")
    version: str | None = Field(None, description="Provider issue time or release of the data last imported.")
    fetched_at: datetime | None = Field(None, description="Last successful import (UTC).")
    rows: int | None = Field(None, description="Rows written by the last successful import.")
    status: Literal["ok", "failed", "never"]
    message: str | None = Field(None, description="Error of the last failed run.")


class WeatherWarning(BaseModel):
    identifier: str
    area: str | None
    event: str = Field(..., description="DWD event name, e.g. STARKE HITZE.")
    ec_ii: int | None = Field(None, description="DWD event code: 247 strong heat, 248 extreme heat.")
    severity: str | None
    headline: str | None
    description: str | None
    instruction: str | None
    onset: datetime | None
    expires: datetime | None


class ForecastDay(BaseModel):
    day: date = Field(..., description="Local date (Europe/Berlin).")
    tmax: float | None = Field(None, description="Highest hourly 2 m air temperature of the day, °C (DWD MOSMIX).")
    tmin: float | None = Field(None, description="Lowest hourly 2 m air temperature of the day, °C.")


class PortalWarning(BaseModel):
    area: str = Field(..., description="Warned area, e.g. Stadt Mannheim.")
    level: Literal["none", "strong", "extreme"] = Field(..., description="DWD heat warning level now or later today.")
    onset: datetime | None = Field(None, description="Start of the heat warning (UTC).")
    expires: datetime | None = Field(None, description="End of the heat warning (UTC).")
    forecast_max: float | None = Field(None, description="Highest air temperature forecast for the rest of today, °C.")
    tomorrow_max: float | None = Field(None, description="Highest air temperature forecast for tomorrow, °C.")
    night_min: float | None = Field(None, description="Lowest air temperature forecast tonight (18:00–09:00 local), °C.")
    updated: datetime | None = Field(None, description="Last successful fetch of the warnings and forecast (UTC).")
