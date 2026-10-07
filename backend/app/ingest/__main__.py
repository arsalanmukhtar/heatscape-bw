"""CLI: python -m app.ingest <job> [<job> ...] | all"""

import asyncio
import logging
import sys

from app.ingest import JOBS
from app.ingest.common import connect, log, record

RETRY_S = 15 * 60  # a failed job runs again after this, whatever its interval


async def _book(conn, sql: str, *args):
    """Run bookkeeping (ingest_runs / ingest_jobs); a missing table must not stop the import."""
    try:
        return await conn.fetchval(sql, *args)
    except Exception:  # e.g. the schema is missing (README → Live data)
        log.exception("could not write the run log")
        return None


async def run_jobs(names: list[str], triggers: dict[str, str] | None = None) -> list[str]:
    """Runs the jobs in order, logging each run (ingest_runs) and setting its next run
    (ingest_jobs: interval after success, RETRY_S after a failure, none for a once-only job
    that succeeded). triggers: job → schedule | manual (default cli). Returns the failed jobs."""
    conn = await connect()
    failed = []
    try:
        for name in names:
            dataset, job, interval = JOBS[name]
            run_id = await _book(
                conn,
                "INSERT INTO ingest_runs (job, trigger, started_at, status) VALUES ($1, $2, now(), 'running') RETURNING id",
                name,
                (triggers or {}).get(name, "cli"),
            )
            await _book(conn, "UPDATE ingest_jobs SET status = 'running' WHERE job = $1", name)
            rows, message = None, None
            try:
                n = await job(conn)
                rows = n if isinstance(n, int) else None
            except Exception as exc:  # report and continue with the next job
                failed.append(name)
                message = f"{type(exc).__name__}: {exc}"[:500]
                log.exception("%s failed", name)
                try:
                    await record(conn, dataset, status="failed", message=message)
                except Exception:  # e.g. the schema is missing (README → Live data)
                    log.exception("could not record the failure of %s", name)
            status = "failed" if message else "ok"
            await _book(conn, "UPDATE ingest_runs SET finished_at = now(), status = $2, rows = $3, message = $4 WHERE id = $1", run_id, status, rows, message)
            await _book(
                conn,
                """UPDATE ingest_jobs SET status = $2,
                     next_run_at = CASE WHEN $2 = 'failed' THEN now() + make_interval(secs => $3)
                                        WHEN $4::int IS NULL THEN NULL
                                        ELSE now() + make_interval(secs => $4::int) END
                   WHERE job = $1""",
                name,
                status,
                RETRY_S,
                interval,
            )
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
