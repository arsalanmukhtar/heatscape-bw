from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RunStatus = Literal["running", "ok", "failed"]


class PipelineRun(BaseModel):
    id: int
    job: str
    trigger: Literal["schedule", "manual", "cli"]
    started_at: datetime
    finished_at: datetime | None
    status: RunStatus
    rows: int | None = Field(None, description="Rows written by the run.")
    duration_s: float | None = Field(None, description="Run time, seconds (None while running).")
    message: str | None = Field(None, description="Error of a failed run.")


class Pipeline(BaseModel):
    job: str = Field(..., description="Worker job (python -m app.ingest <job>).")
    dataset: str
    title: str
    source: str
    url: str
    licence: str
    attribution: str = Field(..., description="Provider key of the credit line (frontend lib/attribution.js).")
    interval_s: int | None = Field(None, description="Refresh interval, seconds; None = once, then on request.")
    paused: bool
    fetched_at: datetime | None = Field(None, description="Last successful import of the dataset (UTC).")
    run_requested: bool = Field(..., description="A Run now request waits for the worker's next pass (≤ 1 min).")
    status: Literal["running", "ok", "failed", "never"]
    next_run_at: datetime | None = Field(None, description="Next scheduled run (None = not scheduled).")
    last_run: PipelineRun | None = None


class PauseRequest(BaseModel):
    paused: bool
