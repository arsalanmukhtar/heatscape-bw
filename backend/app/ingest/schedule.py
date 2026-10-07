"""Worker loop, driven by the ingest_jobs table so the schedule survives restarts and the
admin console can steer it:

- on start: one row per JOBS entry; a job's first next run follows its dataset's last
  successful import (now when never imported; none for a once-only job already imported);
  runs left 'running' by a stopped worker are closed as failed;
- every TICK_S: runs, in JOBS order, the jobs with a "Run now" request (even when paused)
  and the unpaused jobs whose next run is due; run_jobs logs each run and sets the next one.

Touches HEARTBEAT every pass for the healthcheck."""

import asyncio
import logging
from pathlib import Path

from app.ingest import JOBS
from app.ingest.__main__ import run_jobs
from app.ingest.common import connect, log

HEARTBEAT = Path("/tmp/heartbeat")
TICK_S = 60

SYNC = """
INSERT INTO ingest_jobs (job, dataset, interval_s, next_run_at, status)
SELECT $1, $2, $3::int,
       CASE WHEN d.fetched_at IS NULL THEN now()
            WHEN $3::int IS NULL THEN NULL
            ELSE d.fetched_at + make_interval(secs => $3::int) END,
       CASE WHEN d.fetched_at IS NULL THEN COALESCE(NULLIF(d.status, 'ok'), 'never') ELSE 'ok' END
FROM (SELECT 1) one LEFT JOIN datasets d ON d.id = $2
ON CONFLICT (job) DO UPDATE SET dataset = EXCLUDED.dataset, interval_s = EXCLUDED.interval_s
"""

DUE = """
SELECT job, run_requested_at IS NOT NULL AS manual FROM ingest_jobs
WHERE run_requested_at IS NOT NULL OR (NOT paused AND next_run_at <= now())
"""


async def _start() -> None:
    conn = await connect()
    try:
        for name, (dataset, _, interval) in JOBS.items():
            await conn.execute(SYNC, name, dataset, interval)
        await conn.execute("DELETE FROM ingest_jobs WHERE job <> ALL($1::text[])", list(JOBS))
        await conn.execute("UPDATE ingest_runs SET status = 'failed', finished_at = now(), message = 'worker stopped during the run' WHERE status = 'running'")
        await conn.execute("UPDATE ingest_jobs SET status = 'failed', next_run_at = now() WHERE status = 'running'")
    finally:
        await conn.close()


async def _due() -> dict[str, str]:
    """Due jobs in JOBS order → trigger; their Run now requests are taken (cleared)."""
    conn = await connect()
    try:
        rows = {r["job"]: "manual" if r["manual"] else "schedule" for r in await conn.fetch(DUE)}
        if rows:
            await conn.execute("UPDATE ingest_jobs SET run_requested_at = NULL WHERE job = ANY($1::text[])", list(rows))
        return {name: rows[name] for name in JOBS if name in rows}
    finally:
        await conn.close()


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    started = False
    while True:
        try:
            HEARTBEAT.touch()
            if not started:
                await _start()
                started = True
            due = await _due()
            if due:
                await run_jobs(list(due), due)
        except Exception:  # keep the worker alive; the next pass retries
            log.exception("scheduler pass failed")
        await asyncio.sleep(TICK_S)


if __name__ == "__main__":
    asyncio.run(main())
