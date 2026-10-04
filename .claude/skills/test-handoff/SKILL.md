---
name: test-handoff
description: Write the end-of-task test list the user runs themselves (terminal, Swagger, browser). Use after every implementation instead of testing.
---

End the reply with this block. Only steps for what changed; ≤ 10 steps.

```
## Test it
Prereq: <only if needed, e.g. `.env` value, `npm install`>
1. <Surface> — <action>
   `<exact command or URL>`
   Expect: <observable result>
```

- **Surfaces**: Terminal (PowerShell-friendly commands), Swagger `http://localhost:8180/api/docs` (endpoint, body to send, expected status and fields), Browser `http://localhost:8180` (clicks, expected UI), Database `docker compose exec database psql -U heatscape -d heatscape -c "<sql>"`.
- **Rebuild only changed services**: `docker compose up -d --build <service…>`.
- **Frontend-only changes**: also offer `cd frontend; npm run dev` → `http://localhost:5180`.
- Add one failure line: `If it fails: docker compose logs --tail 100 <service>`.
- Cover both themes and a narrow window when UI layout changed.
- Never write "verified", "works" or "tested".
