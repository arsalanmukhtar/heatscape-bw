# Heatscape BW — working rules

Geospatial heat and land-sealing analytics platform (map workspace, geoprocessing, agentic copilot).
Services and commands: `README.md`. Context, read only when the task needs it: `docs/architecture.md`, `docs/decisions.md`, `docs/design-system.md`, `docs/product-scope.md`.

## Hard rules

1. **No testing by Claude.** Never run tests, builds, dev servers, containers, linters, HTTP calls to the app, browsers or screenshots. Installing a dependency to update a lockfile is allowed.
2. **Hand over a test list** after every change, using skill `test-handoff`. Never claim something works.
3. **"commit"**: when the user's message is `commit` (optionally with a note), run `git add -A` then `git commit -m "<type>(<scope>): <summary>"` (conventional type, ≤ 72 chars, written from the diff). Nothing else: no push, no tests, no amend, no review. Reply with the short hash and the message.
4. **README.md** changes in the same edit whenever setup, commands, URLs, services, layout or status change. Terse: tables and bullets, no paragraphs.
5. **Memory**: durable decisions go to `docs/decisions.md` as one line (decision — reason). Open questions go under its "Open" list.
6. **No duplication** across README, docs and `.claude`: each fact has one home; link to it.
7. **JavaScript/JSX only.** No TypeScript, no `.ts`/`.tsx`, no type packages.
8. **Secrets** only in `.env` (template `.env.example`). `misc/` is local and gitignored: never reference it from code or docs.
9. **Mock data** is labelled `MOCK` and kept in one module per service until real data replaces it.
10. Stay in scope: no unrequested features, refactors or files.

## Stack conventions

Before editing a service folder, follow its agent file (delegate to it or read it):
`frontend/` → `agents/frontend.md` · `middleware/` → `agents/middleware.md` · `backend/` → `agents/backend.md` · `database/`, spatial SQL, tiles, rasters → `agents/data-geo.md` · Dockerfiles, `docker-compose.yml`, `gateway/` → `agents/devops.md`.

Playbooks (skills): `implement-screen`, `add-endpoint`, `add-service`, `test-handoff`.
