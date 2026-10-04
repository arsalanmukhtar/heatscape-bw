---
name: add-endpoint
description: Add an API endpoint end to end — FastAPI router, schema, SQL, frontend client call.
---

1. Backend (`agents/backend.md`): router in `app/routers/<area>.py`, Pydantic schemas, parameterised SQL; register in `app/main.py` if the router is new.
2. Schema changes: idempotent SQL in `database/init/` (`agents/data-geo.md`); note that an existing volume needs a manual apply.
3. Middleware passes `/api/*` through; touch it only for auth, streaming or rate limits.
4. Frontend: call via `src/lib/api.js`; replace the matching MOCK data.
5. README: add the endpoint only if it is a user-facing URL; otherwise Swagger is the reference.
6. Finish with `test-handoff`: Swagger request and response first, then the UI.
