"""Worker loop: runs each import at its interval (JOBS) and on start-up; the Zensus grid
once when it has never been loaded. Touches HEARTBEAT every pass for the healthcheck."""

import asyncio
import logging
import time
from pathlib import Path

from app.ingest import JOBS
from app.ingest.__main__ import run_jobs
from app.ingest.common import connect, log

HEARTBEAT = Path("/tmp/heartbeat")
TICK_S = 60
RETRY_S = 15 * 60


async def _loaded(dataset: str) -> bool:
    conn = await connect()
    try:
        return bool(await conn.fetchval("SELECT status = 'ok' FROM datasets WHERE id = $1", dataset))
    finally:
        await conn.close()


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    last: dict[str, float] = {}
    while True:
        try:
            HEARTBEAT.touch()
            now = time.monotonic()
            due = []
            for name, (dataset, _, every) in JOBS.items():
                if every is None:
                    if name not in last and not await _loaded(dataset):
                        due.append(name)
                    last.setdefault(name, now)
                elif now - last.get(name, -1e12) >= every:
                    due.append(name)
            if due:
                failed = await run_jobs(due)
                done = time.monotonic()
                for name in due:
                    every = JOBS[name][2] or 0
                    # A failed job retries after RETRY_S instead of waiting a full interval.
                    last[name] = done - max(0, every - RETRY_S) if name in failed else done
        except Exception:  # keep the worker alive; the next pass retries
            log.exception("scheduler pass failed")
        await asyncio.sleep(TICK_S)


if __name__ == "__main__":
    asyncio.run(main())
