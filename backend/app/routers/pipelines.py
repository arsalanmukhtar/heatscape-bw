"""Import pipelines for the admin console: the worker's jobs (ingest_jobs) with their
datasets and run log (ingest_runs). Run now and Pause are written here and picked up by the
worker on its next pass; both need the admin role (x-user-roles, set by the middleware from
the session)."""

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.db import get_pool
from app.schemas.pipelines import PauseRequest, Pipeline, PipelineRun

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

RUN_COLS = """r.id, r.job, r.trigger, r.started_at, r.finished_at, r.status, r.rows, r.message,
              extract(epoch FROM r.finished_at - r.started_at)::float8 AS duration_s"""


def require_admin(x_user_roles: str = Header("", include_in_schema=False)) -> None:
    if "admin" not in x_user_roles.split(","):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required.")


@router.get("", response_model=list[Pipeline])
async def pipelines(pool: asyncpg.Pool = Depends(get_pool)) -> list[Pipeline]:
    """The worker's import jobs: dataset, schedule, status and last run."""
    rows = await pool.fetch(
        f"""
        SELECT j.job, j.dataset, d.title, d.source, d.url, d.licence, d.attribution, j.interval_s, j.paused, d.fetched_at,
               j.run_requested_at IS NOT NULL AS run_requested, j.status, j.next_run_at, row_to_json(last) AS last_run
        FROM ingest_jobs j
        JOIN datasets d ON d.id = j.dataset
        LEFT JOIN LATERAL (SELECT {RUN_COLS} FROM ingest_runs r WHERE r.job = j.job ORDER BY r.started_at DESC LIMIT 1) last ON true
        ORDER BY j.job
        """
    )
    out = []
    for r in rows:
        item = dict(r)
        last = item.pop("last_run")
        out.append(Pipeline(**item, last_run=PipelineRun.model_validate_json(last) if last else None))
    return out


@router.get("/runs", response_model=list[PipelineRun])
async def runs(
    job: str | None = Query(None, description="One job; all jobs when left out."),
    limit: int = Query(200, ge=1, le=1000),
    pool: asyncpg.Pool = Depends(get_pool),
) -> list[PipelineRun]:
    """Run log, newest first."""
    rows = await pool.fetch(
        f"SELECT {RUN_COLS} FROM ingest_runs r WHERE $1::text IS NULL OR r.job = $1 ORDER BY r.started_at DESC LIMIT $2",
        job,
        limit,
    )
    return [PipelineRun(**dict(r)) for r in rows]


@router.post("/{job}/run", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(require_admin)])
async def run_now(job: str, pool: asyncpg.Pool = Depends(get_pool)) -> dict:
    """Asks the worker to run the job on its next pass (≤ 1 min), even when paused."""
    if not await pool.fetchval("UPDATE ingest_jobs SET run_requested_at = now() WHERE job = $1 RETURNING true", job):
        raise HTTPException(status_code=404, detail=f"Unknown job '{job}'.")
    return {"job": job, "requested": True}


@router.post("/{job}/pause", dependencies=[Depends(require_admin)])
async def pause(job: str, body: PauseRequest, pool: asyncpg.Pool = Depends(get_pool)) -> dict:
    """Pauses or resumes the job's schedule (Run now still works while paused)."""
    if not await pool.fetchval("UPDATE ingest_jobs SET paused = $2 WHERE job = $1 RETURNING true", job, body.paused):
        raise HTTPException(status_code=404, detail=f"Unknown job '{job}'.")
    return {"job": job, "paused": body.paused}
