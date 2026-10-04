# Architecture

```
Browser ──► gateway (nginx) ──► /        frontend (static React build)
                            └──► /api/*  middleware (Fastify BFF) ──► backend (FastAPI) ──► database (PostGIS + H3)
```

## Services

| Service | Responsibility | Must not |
|---|---|---|
| gateway | Only public entry; path routing; TLS later | Hold logic |
| frontend | UI: map shell, panels, dock, charts | Call backend directly (always `/api`) |
| middleware | BFF: proxy `/api`, auth sessions, SSE/WebSocket hub, rate limits | Query the database or hold domain logic |
| backend | Domain API, spatial/non-spatial queries, process registry (OGC API – Processes) | Run long jobs in the request (use workers) |
| database | PostGIS, h3-pg, app data | Be reachable from outside the compose network |

## Planned services

| Service | Purpose |
|---|---|
| auth (Keycloak) | OIDC, roles: Public / Planner / Partner / Expert / Admin |
| worker + redis | Celery jobs: ingestion, downscaling, indicators |
| titiler | COG raster tiles; colour maps from the data tokens |
| stac | STAC catalog (pgstac) for the data cube |
| agent | Copilot: LLM tool calls into the backend process registry, read-only SQL role |
| object storage | COGs, exports, reports |
| reports | HTML → PDF |

## Data contracts

- Modelled values carry uncertainty: `p05`, `p50`, `p95`, plus a quality flag (observed / modelled / filled).
- Geometry stored in EPSG:4326; distances and areas computed in EPSG:25832.
- Every dataset has a version; tile URLs include it so caches can be immutable.
