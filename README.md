# Heatscape BW

Geospatial analytics platform for urban heat and land sealing in Baden-Württemberg: map workspace, geoprocessing, agentic copilot.

## Quick start

```powershell
Copy-Item .env.example .env      # set POSTGRES_PASSWORD, optional VITE_MAPBOX_TOKEN
docker compose up -d --build
```

| What | URL |
|---|---|
| App | http://localhost:8080 |
| API docs (Swagger) | http://localhost:8080/api/docs |
| Health (middleware) | http://localhost:8080/healthz |
| Health (backend / database) | http://localhost:8080/api/health · /api/health/db |

## Services

| Folder | Service | Stack | Port |
|---|---|---|---|
| `gateway/` | Reverse proxy, only public entry | nginx | 8080 → 80 |
| `frontend/` | Web app | React 19, Vite, Tailwind v4 (JSX), Mapbox GL | internal 80 |
| `middleware/` | BFF, `/api` proxy | Node 22, Fastify | internal 3000 |
| `backend/` | Domain API | Python 3.12, FastAPI, asyncpg | internal 8000 |
| `database/` | Spatial database | PostgreSQL 17, PostGIS 3.5, h3-pg | internal 5432 |

## Local frontend dev

```powershell
cd frontend; npm install; npm run dev    # http://localhost:5173, reads the root .env
```

## Layout

```
.claude/     Claude rules, agents, skills
docs/        architecture, decisions, design system, product scope
frontend/    public/, src/{components,state,data,lib,styles,assets}
middleware/  src/
backend/     app/{routers}
database/    init/ (SQL run on first start)
gateway/     nginx.conf
```

## Status

| Item | State |
|---|---|
| GIS workspace screen (layers, map, attribute table, inspector) | Done, MOCK data |
| Backend health + database extensions check | Done |
| Auth, workers, tiles, copilot | Planned (`docs/architecture.md`) |

## Docs

[Architecture](docs/architecture.md) · [Decisions](docs/decisions.md) · [Design system](docs/design-system.md) · [Product scope](docs/product-scope.md)
