"""CLI: python -m app.ingest <job> [<job> ...] | all"""

import asyncio
import logging
import sys

from app.ingest import JOBS
from app.ingest.common import connect, log, record


async def run_jobs(names: list[str]) -> list[str]:
    """Runs the jobs in order; returns the names of those that failed."""
    conn = await connect()
    failed = []
    try:
        for name in names:
            dataset, job, _ = JOBS[name]
            try:
                await job(conn)
            except Exception as exc:  # report and continue with the next job
                failed.append(name)
                log.exception("%s failed", name)
                try:
                    await record(conn, dataset, status="failed", message=f"{type(exc).__name__}: {exc}"[:500])
                except Exception:  # e.g. the schema is missing (README → Live data)
                    log.exception("could not record the failure of %s", name)
    finally:
        await conn.close()
    return failed


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    names = sys.argv[1:]
    if names == ["all"]:
        names = list(JOBS)
    unknown = [n for n in names if n not in JOBS]
    if not names or unknown:
        print(f"usage: python -m app.ingest <job> [...] | all\njobs: {', '.join(JOBS)}" + (f"\nunknown: {', '.join(unknown)}" if unknown else ""))
        sys.exit(2)
    sys.exit(1 if asyncio.run(run_jobs(names)) else 0)


if __name__ == "__main__":
    main()
