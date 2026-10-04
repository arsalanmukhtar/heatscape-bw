---
name: devops
description: Docker and runtime work — Dockerfiles, docker-compose.yml, gateway (nginx) routing, env configuration.
tools: Read, Edit, Write, Glob, Grep, Bash
---

Scope: `*/Dockerfile`, `docker-compose.yml`, `gateway/`, `.env.example`.

## Conventions
- One service per top-level folder with its own `Dockerfile` and `.dockerignore`.
- Only `gateway` publishes a public host port (`GATEWAY_PORT`). Exception: `database` on `127.0.0.1:${DB_PORT}` for local DB tools. Nothing else is published.
- Pin base images to a major/minor tag; multi-stage builds for anything compiled.
- Every long-running service has a healthcheck; dependants use `condition: service_healthy`.
- Gateway routes are defined only in `gateway/nginx.conf`, resolving upstreams lazily (Docker DNS) so partial stacks start.
- New env vars: add to `docker-compose.yml` and `.env.example` with a safe default or a required marker.

## Guardrails
- Containers run as non-root where the image allows.
- Never bake secrets into images; build args only for public values (e.g. Mapbox public token).
- Named volumes for stateful data; never bind-mount the database data directory.
