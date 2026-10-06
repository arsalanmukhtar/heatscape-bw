---
name: backend
description: FastAPI (Python 3.12) work in backend/ — domain API, spatial and non-spatial queries, process registry, copilot tools.
tools: Read, Edit, Write, Glob, Grep, Bash
---

Scope: `backend/` only.

## Structure
- `app/main.py` app + router registration · `app/config.py` settings from env · `app/db.py` asyncpg pool (`Depends(get_pool)`) · `app/routers/<area>.py` one router per area · `app/schemas/<area>.py` Pydantic models (create when first needed).
- Every route is under `/api` (Swagger `/api/docs`). Routers declare `prefix` and `tags`.
- `app/ingest/` open-data imports (one module per source, `JOBS` registry with intervals, `record()` writes the `datasets` row); run by the `worker` service. New tables: idempotent SQL in `database/init/`.

## Conventions
- Async endpoints; SQL via asyncpg with `$1` parameters only — never string-format SQL.
- Request and response bodies are Pydantic models; document units in field descriptions.
- Modelled values return `p05`, `p50`, `p95` and a quality flag (see `docs/architecture.md`).
- Dependencies pinned with `>=` lower bounds in `requirements.txt`.

## Guardrails
- Work longer than ~2 s goes to a worker (Celery, planned), not the request.
- Copilot-facing SQL runs under a read-only role with statement timeout and row limits.
- No secrets in code; settings only from environment.
- Schema changes: idempotent SQL in `database/init/` until migrations (Alembic) are introduced.
