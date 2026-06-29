# Architecture Overview

## System Diagram

```
Workplan (external) ──► Workplan Adapter ──► Jobs API
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
            Formula Weighing          Production Timer          Production Summary
                    │                         │                         │
                    └─────────────────────────┴─────────────────────────┘
                                              │
                                         PostgreSQL
```

## Data Flow

1. **Workplan sync** — `GET /api/jobs?date=` syncs jobs from Workplan adapter into DB
2. **Weighing** — Staff records ingredient weights → `POST /api/formula-weighing`
3. **Verification** — Operator verifies ingredients → `POST /api/formula-weighing/:jobId/verify`
4. **Production** — Timer sessions → `POST /api/production-timer`
5. **Summary** — Output quantities → `POST /api/production-summary`

## Status Gates

| Status | Next Action |
|--------|-------------|
| `pending` | Start formula weighing |
| `weighing` | Complete weighing |
| `weighed` | Operator verifies → start production |
| `in_production` | Complete timer steps |
| `completed` | Enter production summary |

## Frontend Module Structure

Each module in `frontend/apps/web/src/modules/<name>/`:

```
components/   # UI components
hooks/        # React hooks
services/     # API calls
types/        # TypeScript types
constants/    # Mock/fallback data
index.ts      # Public exports
README.md     # Module documentation
```

## Backend Module Structure

Each module in `backend/src/modules/<name>/`:

```
*.module.ts
*.controller.ts
*.service.ts
dto/
README.md
```

## Workplan Adapter

Switch provider via `WORKPLAN_PROVIDER` env:

- `mock` — Uses hardcoded demo jobs (default)
- `http` — Connects to external Workplan API (not yet implemented)

See [modules/workplan-adapter.md](modules/workplan-adapter.md)
