# Conventions

## Naming

- **Modules**: kebab-case (`formula-weighing`, `production-timer`)
- **Components**: PascalCase (`FormulaWeighingPage.tsx`)
- **Services**: camelCase with `.api.ts` suffix
- **Backend**: NestJS standard (module.controller.service)

## Import Rules

```typescript
// ✅ Allowed
import { Button } from "@/shared/ui/button"
import { FormulaWeighingPage } from "@/modules/formula-weighing"

// ❌ Not allowed — cross-module direct import
import { SomeTimerHook } from "@/modules/production-timer/hooks/useTimer"
```

Use module public API (`index.ts`) instead.

## File Organization

- `app/` — Next.js routes only (thin wrappers)
- `src/modules/` — Feature modules
- `src/shared/` — Shared UI, layout, hooks, api-client

## Git Commits

Use descriptive messages focused on "why":

- `feat(formula-weighing): add ingredient weight dialog`
- `fix(production-timer): correct step duration calculation`

## Adding shadcn Components

Run from `frontend/apps/web/`:

```bash
npx shadcn@latest add <component>
```

Components install to `src/shared/ui/`.
