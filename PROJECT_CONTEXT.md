# PROJECT_CONTEXT.md

> เอกสารนี้สร้างจากการสแกน Source Code จริงของโปรเจกต์ TimeTracker เท่านั้น
> ข้อมูลที่ไม่พบใน Source Code จะถูกระบุว่า "ไม่พบข้อมูลในโปรเจกต์" หรือ "ยังไม่ได้กำหนด"

## 1. ภาพรวมโปรเจกต์

- **ชื่อ:** TimeTracker (root `package.json` name: `timetracker`, version `0.1.0`, private)
- **คำอธิบาย (จาก README):** ระบบตัวจับเวลาในไลน์ผลิต — Monorepo สำหรับระบบจัดการไลน์ผลิต
- **3 โมดูลหลักตามธุรกิจ (จาก README + source):**
  1. ตวงสูตร (Formula Weighing)
  2. จับเวลาผลิต (Production Timer)
  3. สรุปการผลิต (Production Summary)
- **ภาษาในโค้ด/คอมเมนต์:** ไทย + อังกฤษ (พบทั้งสองในไฟล์จริง)

## 2. โครงสร้างโปรเจกต์ (Monorepo)

จัดการด้วย **pnpm workspace** (`pnpm-workspace.yaml`):

```
packages:
  - "frontend/apps/*"
  - "frontend/packages/*"
  - "backend"
```

โฟลเดอร์ระดับบนสุดที่พบจริง:

| โฟลเดอร์ | เนื้อหา |
|----------|---------|
| `backend/` | NestJS + Prisma (workspace package ชื่อ `backend`) |
| `frontend/apps/web/` | Next.js app (workspace package ชื่อ `web`) |
| `frontend/packages/pin-login/` | workspace package `@jitdhana/pin-login` |
| `infra/` | `docker/`, `env/`, `scripts/`, `sql/` |
| `docs/` | `architecture.md`, `conventions.md`, `modules/` |
| `design/` | เอกสารออกแบบ UI |
| `prototype/` | HTML prototype |
| `pin-login-components/` | (พบเป็นโฟลเดอร์ระดับ root — ยังไม่ได้ตรวจสอบเนื้อหาในรอบนี้) |

หมายเหตุ: พบไฟล์ชื่อผิดปกติใน `backend/` เช่น `({step`, `p.())`, `{const`, `{console.error(e)`, `r.text()).then(console.log).catch(console.error)` — น่าจะเป็นไฟล์ที่ถูกสร้างโดยไม่ตั้งใจจาก shell (ควรให้เจ้าของตรวจสอบ/ลบ)

### Node engine
- root `package.json`: `"engines": { "node": ">=20" }`
- README ระบุ Prerequisites: Node 20+, pnpm 9+, MySQL 5.7+

## 3. Backend (NestJS)

- **Framework:** NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` `^11.0.0`)
- **ORM:** Prisma (`@prisma/client` `^6.0.0`, `prisma` `^6.0.0`)
- **Driver:** `mysql2` `^3.22.3` (ใช้สำหรับ connection pool ของ DB ภายนอกด้วย)
- **Auth libs:** `@nestjs/jwt` `^11.0.0`, `bcryptjs` `^3.0.3`
- **Validation:** `class-validator` `^0.14.1`, `class-transformer` `^0.5.1`
- **Config:** `@nestjs/config` `^4.0.0`
- **Test:** `vitest` `^3.2.4`
- **TypeScript:** `^5.7.0`, `tsconfig` target `ES2021`, `module: commonjs`, `strict: true`, decorators เปิดใช้
- **Build tool:** `nest build` (มี `nest-cli.json`), output ที่ `dist/`

### 3.1 Bootstrap (`backend/src/main.ts`)
- import `./shared/config/load-database-url` เป็นบรรทัดแรก (สร้าง `DATABASE_URL` ก่อน Nest โหลด)
- `app.setGlobalPrefix("api")` — ทุก route อยู่ใต้ `/api`
- Global `ValidationPipe({ whitelist: true, transform: true })`
- CORS แบบ custom: อนุญาต origin จาก `CORS_ORIGIN` (คั่นด้วย `,`) และใน non-production อนุญาต localhost / 127.0.0.1 / private LAN (192.168.x.x, 10.x.x.x, 172.16-31.x.x) อัตโนมัติ; `credentials: true`
- listen ที่ `process.env.PORT ?? 3001` บน host `0.0.0.0`

### 3.2 Root module (`backend/src/app.module.ts`)
imports ตามลำดับ: `ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../.env", "../infra/env/.env.example"] })`, `PrismaModule`, `AuthSharedModule`, `SharedModule`, `AuthModule`, `JobsModule`, `BusinessUnitsModule`, `WorkplanModule`, `FormulaWeighingModule`, `ProductionTimerModule`, `ProductionSummaryModule`

### 3.3 Feature modules (`backend/src/modules/`)
- `auth/` — controller, module, service, `dto/auth.dto.ts`
- `business-units/` — controller, module, service
- `formula-weighing/` — controller, module, service, `dto/`, `README.md`
- `jobs/` — controller, module, service
- `production-summary/` — controller, module, service, `dto/`
- `production-timer/` — controller, module, service (+ `.spec.ts`), `production-timer.util.ts` (+ spec), `dto/`
- `workplan/` — controller, module, service, `workplan.interface.ts`, providers: `mock-workplan.provider.ts`, `http-workplan.provider.ts`, `db-workplan.provider.ts`, `README.md`

### 3.4 Shared (`backend/src/shared/`)
- `auth/` — `auth-shared.module.ts`, `jwt-auth.guard.ts`, `permissions.guard.ts`, `permission.service.ts` (+spec), `permissions.constants.ts`, `require-permissions.decorator.ts`, `current-user.decorator.ts`, `auth-user.types.ts`, `pin-verifier.ts` (+spec)
- `config/load-database-url.ts`
- `prisma/prisma.module.ts` (มี `PrismaService` อยู่ในไฟล์เดียวกัน)
- `dto/production-job.dto.ts`
- `mappers/job.mapper.ts`
- `services/` — `batch-resolver.service.ts`, `bom.service.ts`, `material-resolver.service.ts`, `process-steps-reader.service.ts`, `process-templates-reader.service.ts`, `production-log.service.ts`, `user-resolver.service.ts`
- `utils/` — รวมไฟล์ utility + spec จำนวนมาก เช่น `batch-quantity.util.ts`, `bu-query.util.ts`, `datetime.util.ts`, `input-material-weight.util.ts`, `json-serialize.util.ts`, `labor-cost.util.ts`, `material-unit-price.util.ts`, `operator-weighable-material.util.ts`, `output-quantity.util.ts`, `production-output.util.ts`, `weighing-unit.util.ts`
- `shared.module.ts` — `@Global()` module ที่ provide/export 7 services ใน `services/`

### 3.5 รูปแบบ Controller (จากโค้ดจริง)
- ใช้ decorator `@Controller("<prefix>")` (รวมกับ global prefix `api` → `/api/<prefix>`)
- โมดูลที่ต้อง auth ใช้ `@UseGuards(JwtAuthGuard, PermissionsGuard)` ที่ระดับ class
- กำหนดสิทธิ์ราย endpoint ด้วย `@RequirePermissions("<action_key>")`
- ดึงผู้ใช้ปัจจุบันด้วย `@CurrentUser() user: AuthenticatedRequestUser` แล้ว override field ผู้กระทำจาก `user.sub` (ไม่เชื่อค่า actor จาก client — ดูคอมเมนต์ใน `formula-weighing.dto.ts`)
- query param แบบ optional แปลงเองใน controller เช่น `parseOptionalBuId(buId)`, parse limit ด้วย `Number.parseInt`
- `AuthController` ไม่มี guard ที่ระดับ class — `verify-pin` / `register-pin` เปิด public, ส่วน `me` / `change-pin` ใส่ `@UseGuards(JwtAuthGuard)` รายเมธอด

### 3.6 รูปแบบ Service / Database Access (จากโค้ดจริง)
- DB หลักเข้าถึงผ่าน **Prisma** (`PrismaService` inject เข้า service) เช่น `this.prisma.work_plans.findMany(...)`, `this.prisma.formula_weighing_job_settings.findUnique(...)`
- Service ประกอบงานจาก shared services ผ่าน constructor DI (เช่น `FormulaWeighingService` ใช้ `BatchResolverService`, `BomService`, `MaterialResolverService`, `UserResolverService`, `JobsService`, `PrismaService`)
- DB ภายนอก (process steps / templates) เข้าถึงด้วย **`mysql2/promise` connection pool** ที่สร้างเองใน service (`ProcessStepsReaderService` ใช้ `createPool({ uri: STEPS_DATABASE_URL, connectionLimit: 5 })` ใน `onModuleInit`, ปิดใน `onModuleDestroy`) — ใช้เฉพาะเมื่อ `STEPS_DB_NAME` ต่างจาก `DB_NAME`
- `PrismaService` (`shared/prisma/prisma.module.ts`): extends `PrismaClient`, ใน `onModuleInit` ถ้าไม่มี `DATABASE_URL` จะ warn แล้วทำงานต่อแบบไม่มี DB; ถ้าต่อได้จะรัน `SET time_zone = '+00:00'` และตั้ง flag `isConnected`
- มีการ try/catch รอบ Prisma query บางจุดเพื่อ fallback (เช่น คืน `Set` ว่างถ้า query setting ล้มเหลว)

### 3.7 รูปแบบ DTO (จากโค้ดจริง)
- ใช้ class + decorator จาก `class-validator` (`@IsString`, `@IsArray`, `@IsBoolean`, `@IsInt`, `@IsNumber`, `@IsOptional`, `@Min`, `@ValidateNested`) และ `@Type(() => ...)` จาก `class-transformer`
- nested array ใช้ `@ValidateNested({ each: true })` + `@Type(() => ItemDto)`

### 3.8 Workplan Adapter Pattern (จากโค้ดจริง)
- `workplan.interface.ts` ประกาศ token `WORKPLAN_PROVIDER` + interface `WorkplanProvider`
- `workplan.module.ts` ใช้ `useFactory` + `ConfigService` เลือก provider จาก env `WORKPLAN_PROVIDER`: `"http"` → `HttpWorkplanProvider`, `"mock"` → `MockWorkplanProvider`, อื่นๆ (default) → `DbWorkplanProvider` (ค่า default ใน factory คือ `"db"`)
- `DbWorkplanProvider` ใช้ Prisma ดึง `production_batches`, `process_executions` ฯลฯ แล้ว map ผ่าน `job.mapper.ts`

## 4. Authentication & Authorization (จากโค้ดจริง)

### 4.1 Authentication
- **กลไก:** PIN login → ออก JWT (`@nestjs/jwt`)
- `AuthService.verifyPin`: ถ้า `prisma.isConnected` ค้นหา `users` ด้วย `pin_display` + `is_active`, ตรวจ PIN ด้วย `verifyPinAgainstPassword(pin, user.password)` (bcrypt), แล้ว resolve role จาก `role_configurations`
- **Demo PINs** (`1234`/`5678`/`9999`) hardcoded ใน service แต่ใช้ได้เฉพาะเมื่อ `NODE_ENV !== "production"` **และ** `ALLOW_DEMO_PINS === "true"`
- **JWT config** (`auth-shared.module.ts`): `JwtModule.registerAsync`, `signOptions: { expiresIn: "8h" }`, secret จาก `JWT_SECRET`; ใน production บังคับ secret ยาว >= 16 ตัวอักษรและห้ามเป็นค่า insecure (`dev-secret`, `change-me`, ฯลฯ) มิฉะนั้น throw ตอน start; non-production fallback เป็น `"dev-secret"`
- JWT payload: `{ sub, name, role, roleId }`
- `registerPin` / `changePin` ปัจจุบัน throw (ยังไม่เปิดใช้ — register โยน `NotImplementedException`, change PIN โยน `BadRequestException` ว่าให้ไปทำที่ระบบ HR)

### 4.2 Authorization
- `JwtAuthGuard`: ดึง token จาก header `Authorization: Bearer <token>`, verify, resolve permissions แล้วแนบ `request.user = { ...payload, permissions }`
- `PermissionsGuard` + `@RequirePermissions(...)` ตรวจ action keys
- `permissions.constants.ts` กำหนด:
  - `AppRole`: `operator` | `weighing_staff` | `supervisor` | `elevated`
  - `MenuKey` 8 ค่า (เช่น `dashboard`, `formula_weighing`, `production_timer`, `admin_console`)
  - `ActionKey` 14 ค่า (เช่น `formula_weighing.write`, `formula_weighing.verify`, `production_timer.admin_edit`, `production_summary.view_cost`, `admin.users.write`)
  - `ROLE_PERMISSION_MATRIX` แมป role → menus/actions และ `ROLE_ALIASES` แมปชื่อ role ภายนอก (รวมภาษาไทย เช่น `พนักงาน`, `หัวหน้า`) → AppRole; default fallback = `operator`

## 5. Database (จากโค้ดจริง)

- **ชนิด:** MySQL (Prisma `datasource db { provider = "mysql"; url = env("DATABASE_URL") }`)
- **DB หลัก (จาก README/env):** `MNF_database411`
- **DB รอง (read-only, optional):** `manufacturing_system` สำหรับ `process_steps` / `process_templates` (เข้าผ่าน `STEPS_DB_*` / `TEMPLATES_DB_*`)
- **Schema:** `backend/prisma/schema.prisma` มาจาก `prisma db pull` (มีคอมเมนต์ว่า model มี comment ใน DB)
- **Migration policy (จาก README/env):** ใช้ `db pull` + `db:generate` เท่านั้น — ไม่รัน migrate ทับ DB production
- **จำนวน model ที่พบ:** 40 models รวมตารางจริงและตาราง backup เช่น:
  - งาน/แผน: `work_plans`, `work_plan_drafts`, `work_plan_operators`, `work_plan_workflow_statuses`, `workplan_sync_log`, `business_units`
  - ผลิต: `production_batches`, `batch_material_usage`, `batch_production_results`, `production_costs`, `production_costs_history`, `production_statuses`, `production_rooms`
  - process: `process_executions`, `process_execution_operators`, `process_steps`, `process_templates`, `process_template_history`, `product_active_versions`, `product_version_assignments`
  - master: `fg`, `fg_bom`, `materials`, `material`, `products`, `product_bom`, `unit_conversions`, `machines`, `menu_catalog`, `finished_flags`, `logs`
  - ผู้ใช้/สิทธิ์: `users`, `user_sessions`, `role_configurations`, `role_menu_permissions`, `role_menu_audits`
  - การตั้งค่าแอป: `formula_weighing_job_settings`
  - ตาราง backup: `products_backup_rename`, `work_plans_backup_20251021`, `work_plan_operators_backup_20251021`, `workplan_sync_log_backup_20251021`
- หมายเหตุ: รายชื่อ model ข้างต้นมาจาก source จริง; ความหมายเชิงธุรกิจของบางตาราง (เช่น `material` vs `materials`, ตาราง backup) **ไม่พบคำอธิบายในโค้ด** — ควรให้เจ้าของโปรเจกต์ยืนยัน

## 6. Environment Variables (จากโค้ดจริง: `infra/env/.env.example`, `load-database-url.ts`, `main.ts`, `auth-shared.module.ts`)

| ตัวแปร | การใช้งานที่พบในโค้ด |
|--------|----------------------|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | ใช้ใน `load-database-url.ts` สร้าง `DATABASE_URL` (mysql) อัตโนมัติ; `DB_PORT` default `3306` |
| `STEPS_DB_HOST/USER/PASSWORD/NAME/PORT` | สร้าง `STEPS_DATABASE_URL` (fallback ไปค่า `DB_*`) เมื่อมี `STEPS_DB_NAME` |
| `TEMPLATES_DB_HOST/USER/PASSWORD/NAME/PORT` | สร้าง `TEMPLATES_DATABASE_URL` เมื่อมี `TEMPLATES_DB_NAME` |
| `DATABASE_URL` / `STEPS_DATABASE_URL` / `TEMPLATES_DATABASE_URL` | สร้างโดยโค้ด ไม่ตั้งเองตรงๆ |
| `PORT` | พอร์ต backend (default `3001` ใน `main.ts`) |
| `JWT_SECRET` | ใช้ใน `auth-shared.module.ts` (บังคับแข็งแรงใน production) |
| `NODE_ENV` | ใช้ตัดสิน production ในหลายจุด |
| `ALLOW_DEMO_PINS` | เปิด demo PIN (ต้อง `"true"` + non-production) |
| `WORKPLAN_PROVIDER` | เลือก provider (`mock`/`http`/`db`); default ใน factory = `db`, ใน `.env.example` = `db` |
| `WORKPLAN_API_URL` | ใช้กับ `http` provider (ค่าใน example เป็นสตริงว่าง) |
| `CORS_ORIGIN` | รายการ origin คั่นด้วย `,` |
| `LABOR_STANDARD_WORK_MINUTES` | นาทีทำงานมาตรฐานต่อวัน (example = `495`) |
| `NEXT_PUBLIC_API_URL` | (frontend) backend API URL ตรง; default ใช้ proxy `/api` |

- README/`.env.example` ระบุค่า `DB_HOST=192.168.0.96`, `DB_USER=jitdhana`, `DB_NAME=MNF_database411` เป็นตัวอย่าง
- `backend/.env` มีอยู่จริงในเครื่อง (ไม่อ่านค่า secret ในเอกสารนี้)

## 7. API Routes (จากโค้ดจริงใน controllers; ทุก route นำหน้าด้วย `/api`)

> หมายเหตุ: ตารางสิทธิ์อ้างจาก `@RequirePermissions(...)` และ guard ที่ระดับ class ในแต่ละ controller

**auth** (`/api/auth`, ไม่มี guard ระดับ class)
- `POST /auth/verify-pin` (public)
- `POST /auth/register-pin` (public; ปัจจุบัน throw NotImplemented)
- `GET /auth/me` (`JwtAuthGuard`)
- `PATCH /auth/change-pin` (`JwtAuthGuard`; ปัจจุบัน throw)

**formula-weighing** (`/api/formula-weighing`, guard: `JwtAuthGuard` + `PermissionsGuard`)
- `GET /formula-weighing/jobs?date=&bu_id=`
- `GET /formula-weighing/settings/jobs` (`formula_weighing.settings`)
- `PUT /formula-weighing/settings/jobs` (`formula_weighing.settings`)
- `GET /formula-weighing/units?limit=`
- `GET /formula-weighing/materials?search=&limit=` (`formula_weighing.write`)
- `POST /formula-weighing` (`formula_weighing.write`)
- `DELETE /formula-weighing/:jobId/ingredients/:materialCode` (`formula_weighing.write`)
- `POST /formula-weighing/:jobId/verify` (`formula_weighing.verify`)
- `GET /formula-weighing/:jobId`

**production-timer** (`/api/production-timer`, guard: `JwtAuthGuard` + `PermissionsGuard`)
- `POST /production-timer` (`production_timer.write`)
- `PATCH /production-timer/:jobId` (`production_timer.write`)
- `PATCH /production-timer/:jobId/admin-correction` (`production_timer.admin_edit`)
- `PATCH /production-timer/:jobId/operator-weighing` (`production_timer.write`)
- `GET /production-timer/:jobId` (`production_timer.read`)

**โมดูลอื่น (controller มีอยู่จริง — endpoint ละเอียดยังไม่ได้อ่านครบในรอบนี้):**
- `auth`, `business-units`, `jobs`, `workplan`, `production-summary` (ดู README สำหรับรายการที่ระบุไว้ เช่น `GET /api/business-units`, `GET /api/jobs`, `GET/POST /api/production-summary`, `GET /api/workplan/jobs`) — **ควรยืนยันกับ controller ก่อนใช้เป็นข้อมูลทางการ**

## 8. Frontend (Next.js)

- **Framework:** Next.js `16.0.10` (App Router), React `19.2.0`
- **Styling:** Tailwind CSS `^4.1.9` (`@tailwindcss/postcss`), `tailwind-merge`, `tailwindcss-animate`, `tw-animate-css`
- **UI primitives:** Radix UI (หลายแพ็กเกจ) + shadcn-style components ใน `src/shared/ui/` (มี `components.json`)
- **ไอคอน:** `lucide-react`; **ฟอร์ม:** `react-hook-form` + `@hookform/resolvers` + `zod`; **กราฟ:** `recharts`; **toast:** `sonner`; **theme:** `next-themes`; **animation:** `framer-motion`; **analytics:** `@vercel/analytics`
- **Workspace dep:** `@jitdhana/pin-login` (`workspace:*`), ถูก `transpilePackages` ใน `next.config.mjs`
- **Test:** `vitest`; **Lint:** ESLint 9 (`eslint.config.mjs`, `eslint-config-next`)
- **tsconfig:** path alias `@/* -> ./src/*`, `strict: true`, `moduleResolution: bundler`, `jsx: react-jsx`

### 8.1 next.config.mjs (จากโค้ดจริง)
- `transpilePackages: ["@jitdhana/pin-login"]`
- `images.unoptimized: true`
- `allowedDevOrigins: ["127.0.0.1", "192.168.0.138", "192.168.0.139"]`
- **rewrites:** `/api/:path*` → `http://127.0.0.1:3001/api/:path*` (proxy ไป backend)
- `dev` script: `next dev --hostname 0.0.0.0`

### 8.2 โครงสร้าง frontend (จากโค้ดจริง)
- `app/` = route (thin pages) — route page เป็น wrapper บางๆ ที่ import component จาก `@/modules/...` (เช่น `app/formula-weighing/page.tsx` ห่อ `<FormulaWeighingPage />` ด้วย `<Suspense>`)
- routes ที่พบ: `/`, `/login`, `/register`, `/access-denied`, `/all-production`, `/all-production-list`, `/formula-weighing`, `/formula-weighing-list`, `/formula-weighing-settings`, `/production-list`, `/production-summary`, `/production-timer`, `/user-profile` (บาง route มี `loading.tsx` / `template.tsx`)
- `src/modules/<feature>/` = logic ต่อ feature; โครงภายในที่พบบ่อย: `components/`, `hooks/`, `services/`, `utils/`, `types/`, `constants/`, `mappers/`, `index.ts` (public API), `README.md`
- modules ที่พบ: `auth`, `dashboard`, `formula-weighing`, `production-summary`, `production-timer`, `user-profile`
- `src/shared/` = `api-client/`, `components/`, `hooks/`, `layout/`, `lib/`, `ui/`
- `middleware.ts` อยู่ที่ root ของ web app

### 8.3 รูปแบบ Frontend (จากโค้ดจริง)
- **API client** (`src/shared/api-client/index.ts`): wrapper รอบ `fetch`; ฝั่ง browser base = `/api` (ผ่าน proxy), ฝั่ง server ใช้ `NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api"`; แนบ `Authorization: Bearer <token>` จาก `localStorage("auth_token")` หรือ cookie; export object `apiClient` ที่มี `get/post/put/patch/delete`; มี `ApiError` (เก็บ `status`); จัดการ 401 (ล้าง token + redirect `/login`) และ 403
- **Service ต่อ module** (เช่น `formula-weighing/services/formula-weighing.api.ts`): export object เช่น `formulaWeighingApi` ที่เรียก `apiClient` และระบุ type ของ response; มี mapper (`mappers/`) แปลง shape API ↔ UI
- **Hook ต่อ module** (เช่น `hooks/useFormulaWeighing.ts`): `"use client"`, ใช้ `useState`/`useEffect`/`useCallback`, custom hook `useApiQuery`, ดึงข้อมูล user จาก `@/shared/lib/auth`
- **index.ts** ของ module export component/type เป็น public API ของ module

### 8.4 Middleware / Auth flow (จากโค้ดจริง `middleware.ts`)
- public paths: `/login`, `/register`, `/access-denied`
- ปล่อย `/api/*` ผ่านไป proxy (ไม่ redirect)
- ตรวจ cookie `auth_token`; ถ้าไม่มี redirect ไป `/login?from=<path>`
- ตรวจสิทธิ์เมนูบางเส้นทางผ่าน cookie `auth_menus` (เทียบกับ `ROUTE_MENUS`); ไม่ผ่าน → `/access-denied`
- ถ้า login แล้วเข้าหน้า `/login` หรือ `/register` จะ redirect ไป `/`

## 9. pin-login package (`frontend/packages/pin-login`)
- ชื่อ: `@jitdhana/pin-login` v`0.1.0`, `type: module`
- build ด้วย **Vite** (library mode) + `tsc`; output `dist/` (umd + esm + d.ts + css)
- peerDependencies: `react >=18`, `react-dom >=18`
- คำอธิบาย: "PIN login & register components for React apps"

## 10. Infra / Docker / Deployment (จากโค้ดจริง)

- `infra/docker/docker-compose.yml`: services `postgres` (profile `postgres`, ระบุในคอมเมนต์ว่า legacy/optional ไม่ใช้ใน workflow MySQL local), `backend` (build จาก `Dockerfile.backend`, env `DATABASE_URL=mysql://...host.docker.internal:3306/timetracker`, `WORKPLAN_PROVIDER=mock`, port 3001), `frontend` (build จาก `Dockerfile.frontend`, port 3000)
- `infra/docker/Dockerfile.backend`, `Dockerfile.frontend` (มีอยู่จริง — ยังไม่ได้อ่านเนื้อหาในรอบนี้)
- `infra/scripts/`: `dev.ps1`, `dev.sh`, `migrate.sh`
- `infra/sql/`: `001_business_units.sql`, `002_rogang_menu_rg001.sql`, `003_rogang_process_steps.sql`
- หมายเหตุจาก README: development ปกติใช้ MySQL local; Postgres ใน compose เป็น optional
- **CI/CD:** ไม่พบไฟล์ CI (เช่น `.github/workflows`) ในรอบสแกนนี้ — **ยังไม่ได้กำหนด/ไม่พบข้อมูลในโปรเจกต์**

## 11. Scripts (จาก root `package.json` + `backend/package.json`)

Root:
- `dev` = รัน web + backend พร้อมกัน (`pnpm --parallel --filter web --filter backend dev`)
- `dev:web`, `dev:backend`, `build`, `build:web`, `build:backend`, `build:pin-login`
- `db:migrate`, `db:generate`, `db:pull` (filter `backend`)

Backend:
- `build` = `nest build`, `dev` = `nest start --watch`, `start`/`start:prod` = `node dist/main.js`
- `prisma:generate` / `prisma:pull` / `prisma:migrate` / `prisma:studio` รันผ่าน `node scripts/load-env.cjs npx prisma ...`
- `test` = `vitest run`, `test:watch`

Frontend (`web`):
- `build` = `next build`, `dev` = `next dev --hostname 0.0.0.0`, `lint` = `eslint .`, `test` = `vitest run`, `start` = `next start`

## 12. External Services / Third-Party Integrations (จากโค้ดจริง)

- **MySQL** (DB หลัก + DB ภายนอก optional) — เป็น integration เดียวที่ยืนยันได้จากโค้ด
- **Workplan source:** ผ่าน adapter pattern; โหมด `http` มี `HttpWorkplanProvider` + `WORKPLAN_API_URL` (เป็น integration ภายนอกที่เป็นไปได้ แต่ค่า URL ใน example ว่าง)
- ไม่พบการเชื่อมต่อ third-party SaaS อื่น (เช่น payment, email, storage cloud) ในรอบสแกนนี้ — **ไม่พบข้อมูลในโปรเจกต์**

## 13. การเชื่อมต่อระหว่างระบบ (สรุปจากโค้ดจริง)

```
Browser (Next.js, port 3000)
  -> apiClient (fetch "/api/...")
  -> Next.js rewrite (/api/:path* -> http://127.0.0.1:3001/api/:path*)
  -> NestJS (global prefix /api, port 3001)
  -> Prisma -> MySQL (MNF_database411)
            -> mysql2 pool -> MySQL ภายนอก (manufacturing_system) [optional]
```

- Auth: PIN -> JWT (8h) -> เก็บฝั่ง client (localStorage/cookie `auth_token`) -> ส่ง `Bearer` ทุก request -> `JwtAuthGuard` + `PermissionsGuard`
- middleware ฝั่ง Next.js ใช้ cookie `auth_token` + `auth_menus` คุมการเข้าถึง route

## 14. สิ่งที่ "ยังไม่ได้กำหนด / ไม่พบข้อมูลในโปรเจกต์"

- ไฟล์ CI/CD pipeline
- เอกสาร/โค้ดที่อธิบายความหมายธุรกิจของตาราง backup และคู่ตาราง `material`/`materials`, `products`/`products_backup_rename`
- การเชื่อมต่อ third-party ภายนอกอื่นนอกจาก MySQL
- เนื้อหาของ `pin-login-components/` (โฟลเดอร์ root), `Dockerfile.*`, และ endpoint ละเอียดของ `business-units` / `jobs` / `workplan` / `production-summary` controllers (ยังไม่ได้อ่านครบในรอบนี้)
- ไฟล์ชื่อผิดปกติใน `backend/` (`({step`, `p.())`, ฯลฯ) — ที่มา/ความตั้งใจไม่ชัด
