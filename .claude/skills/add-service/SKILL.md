---
name: add-service
description: Add a new container/service (e.g. auth, worker, titiler, agent) to the stack.
---

1. New top-level folder with `Dockerfile`, `.dockerignore` and source (`agents/devops.md`).
2. Service in `docker-compose.yml`: healthcheck, `depends_on` with health conditions, env vars, no published port.
3. Public route needed? Add a location to `gateway/nginx.conf`.
4. New env vars in `.env.example`.
5. Update the README services table and move the row in `docs/architecture.md` from "Planned" to "Services".
6. Finish with `test-handoff` (`docker compose up -d --build <service>`, `docker compose ps`, health URL).
