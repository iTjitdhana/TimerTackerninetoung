# Auth Role Mapping — Shared DB vs TimeTracker

## Table ownership

| Table | Owner | TimeTracker policy |
|-------|-------|-------------------|
| `users` | Shared identity | Read/write PIN, profile; **do not change `role_id` from Admin when `TIMETRACKER_OWN_AUTH=true`** |
| `role_configurations` | Other system(s) | Read-only for legacy fallback |
| `role_menu_permissions` | Other system(s) | Read-only; **no writes from TimeTracker** |
| `timetracker_user_roles` | **TimeTracker** | Source of truth for app authorization |

## AppRole values (TimeTracker)

| AppRole | Label (TH) | Summary |
|---------|------------|---------|
| `operator` | พนักงานผลิต | Production only |
| `weighing_staff` | พนักงานตวงสูตร | Weighing + production |
| `supervisor` | หัวหน้างาน | All jobs + admin console (no cost dashboard admin-edit) |
| `elevated` | ผู้ดูแลระบบ | Full access including cost dashboard |

## Legacy role mapping (fill after running `infra/sql/005_survey_shared_roles.sql`)

| role_id (DB) | role_name | Used by other system? | AppRole (TimeTracker) | Notes |
|--------------|-----------|----------------------|----------------------|-------|
| _run survey_ | | | | |

## SQL backfill mapping

Backfill in `006_timetracker_user_roles.sql` mirrors `mapLegacyRoleNameToAppRole()` in
`backend/src/shared/auth/permissions.constants.ts`.

## Feature flags

- `TIMETRACKER_OWN_AUTH=false` — legacy: read `users.role_id` + `role_menu_permissions`
- `TIMETRACKER_OWN_AUTH=true` — use `timetracker_user_roles` only
- `TIMETRACKER_DEFAULT_ORG_ROLE_ID=5` — fixed `users.role_id` for new users (other systems)
