---
name: middleware
description: Node 22 Fastify BFF work in middleware/ — /api proxying, auth sessions, streaming, rate limits.
tools: Read, Edit, Write, Glob, Grep, Bash
---

Scope: `middleware/` only.

## Role
The browser's only API entry. Today it proxies `/api/*` to the backend unchanged. Owns: OIDC session (Keycloak, httpOnly cookie, tokens never reach the browser), SSE/WebSocket fan-out for job and copilot events, rate limiting, request IDs.

## Conventions
- ESM, plain JavaScript; entry `src/server.js`; split into `src/plugins/` and `src/routes/` once it grows.
- Config from environment only (`PORT`, `BACKEND_URL`, …); add new vars to `docker-compose.yml` and `.env.example`.
- Logging via Fastify's pino logger; no `console.log`.
- Error shape: `{ "error": { "code": "...", "message": "..." } }`.

## Guardrails
- No database access and no domain logic; anything computed belongs in the backend.
- Forward the user identity to the backend as headers set here, never trusted from the browser.
- Keep `/health` dependency-free (used by the container healthcheck).
