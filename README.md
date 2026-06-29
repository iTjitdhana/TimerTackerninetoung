# TimeTracker — ระบบตัวจับเวลาในไลน์ผลิต

Monorepo สำหรับระบบจัดการไลน์ผลิต ประกอบด้วย 3 โมดูลหลัก:

1. **ตวงสูตร (Formula Weighing)** — ดึงงานจาก Workplan, บันทึกน้ำหนักวัตถุดิบ
2. **จับเวลาผลิต (Production Timer)** — ตรวจสอบวัตถุดิบ, จับเวลาตามขั้นตอน
3. **สรุปการผลิต (Production Summary)** — บันทึกผลผลิต, แสดง input/output/waste

## Recent Updates

### Production Summary — หน่วยผลิตจาก FG master (พ.ค. 2026)

**อาการ:** dropdown หน่วยผลิตแสดงแค่ **กก.** แม้สินค้าใน `fg` กำหนด `FG_Unit` เป็น **แพ็ค** (เช่น `135012` น้ำแกงส้ม 450 กรัม (1*5 แพ็ค))

**สาเหตุหลัก**

1. **`work_plans.job_code` ไม่ตรงกับ `fg.FG_Code`** — งานหลายรายการใช้รหัสสั้น เช่น `3`, `16` แทน `135012` ทำให้ lookup จากรหัสล้มเหลว
2. **ชื่องานใน work plan ไม่ตรงกับ master 100%** — มีช่องว่างเกินก่อนวงเล็บ เช่น `น้ำแกงส้ม 450 กรัม   (1*5 แพ็ค)` จึงค้นหา FG จากชื่อแบบ exact match ไม่เจอ
3. **Backend ไม่ rebuild** — มี TypeScript error ใน Production Timer ทำให้ dev server ยังรันโค้ดเก่าที่ resolve FG ไม่ได้

**การแก้ไข**

- **`BatchResolverService`** — ค้นหา FG หลายชั้น: `job_code` → รหัสตัวเลข 4+ หลัก → `fg_bom` → ชื่องาน (normalize ช่องว่าง, ตัดวงเล็บ, partial match)
- **`output-quantity.util.ts`** — สร้าง `unitOptions` จาก `fg.FG_Unit` + `conversion_rate` (เช่น แพ็ค × 0.45 = กก.)
- **Production Summary API** — `GET/POST /api/production-summary` คืน/ใช้ `outputConfig`; บันทึก `good_qty` ตามหน่วยที่เลือก, `good_secondary_qty` เป็นน้ำหนัก kg, `defect_qty` เป็นเศษ (kg); upsert `production_costs`
- **Frontend** — dropdown หน่วยจาก master, เปลี่ยน "ของเสีย" เป็น **"เศษ"**, เลือกหน่วยเริ่มต้นจาก `FG_Unit` (ไม่ใช่ กก. เสมอ)
- **Production Timer** — ส่ง `outputConfig` ไปหน้าสรุปผลผลิต; `PATCH .../operator-weighing` บันทึกน้ำหนักฝั่งผู้ปฏิบัติงาน

**ตัวอย่าง:** FG `135012` → `unitOptions: [กก., แพ็ค]` (`conversion_rate: 0.45`)

**หมายเหตุระยะยาว:** ควรแก้ข้อมูล `work_plans.job_code` ให้ตรง `fg.FG_Code` เพื่อลดการพึ่ง fallback จากชื่องาน

### Phase 2 — เชื่อมต่อ API / Database จริง

- **Backend** ครบ 3 โมดูลหลัก: Formula Weighing, Production Timer, Production Summary
- **Frontend** ใช้ API จริงแทน mock ใน Dashboard, รายการงาน, ตวงสูตร, จับเวลา, สรุปผลผลิต
- **Workplan** ใช้ `WORKPLAN_PROVIDER=db` อ่านงานจาก MySQL (`work_plans`, `production_batches`, ฯลฯ)
- **Shared services** ใหม่: `BatchResolver`, `UserResolver`, `MaterialResolver`, `BomService`, `ProductionLogService`, `ProcessStepsReader`, `ProcessTemplatesReader`
- **Auth + Business Units** — PIN login, JWT, permissions, เลือก BU ในรายการงาน (`bu_id` query)

### Production Timer

- **ลำดับการหาขั้นตอน** (fallback อัตโนมัติ):
  1. `process_executions` (ถ้ามี session ของงานนั้น)
  2. `process_templates` จาก DB ภายนอก `manufacturing_system`
  3. `process_templates` จาก DB หลัก (`MNF_database411`)
  4. `process_steps` จาก DB ภายนอก
  5. `logs` (fallback ชื่อขั้นตอนทั่วไป)
- **เวลา** อ่านจากตาราง `logs` ใน DB หลัก ผ่าน `ProductionLogService` (timezone ไทย, คืนค่า `HH:mm`)
- **Fallback version** — ถ้า `product_active_versions` ชี้ version ที่ไม่มี template จะ fallback ไป version ล่าสุดที่มีข้อมูล
- **Frontend Timer controls card** แสดงเวลาจริงจาก API (ไม่ใช่ mock timer):
  - **เวลาเริ่ม / เวลาสิ้นสุด** = timestamp คงที่ (`HH:mm:ss` ใน controls card)
  - **เวลาที่ใช้** = นับต่อเนื่องทุกวินาทีเมื่องานเริ่มแล้วแต่ยังไม่จบ
  - **เวลาสิ้นสุด** จะขึ้นเมื่อจบขั้นตอนจริงเท่านั้น (ไม่ใช้เวลาปัจจุบันแทน)

### Formula Weighing

- `GET /api/formula-weighing/jobs` — รายการงานสำหรับตวงสูตร (รองรับ `bu_id`)
- `GET /api/formula-weighing/:jobId` — ดึง BOM + น้ำหนักที่บันทึกแล้ว
- `POST /api/formula-weighing` — บันทึกน้ำหนักวัตถุดิบ → `batch_material_usage`
- `POST /api/formula-weighing/:jobId/verify` — ตรวจสอบวัตถุดิบก่อนเริ่มผลิต
- `GET/PUT /api/formula-weighing/settings/jobs` — ตั้งค่างานตวงสูตร

### Production Summary

- `GET /api/production-summary/:jobId` — ดึง context สรุปผล (ผลผลิตที่บันทึกแล้ว, `outputConfig`, preview ต้นทุน/yield)
- `POST /api/production-summary` — บันทึกผลผลิตลง `batch_production_results` + `production_costs`
- รองรับหน่วยผลิตหลายแบบ (กก. / แพ็ค ฯลฯ) แปลงเป็น kg ผ่าน `fg.conversion_rate`
- อัปเดตสถานะ batch เมื่อจบงาน

### Database / Environment

- DB หลัก: **`MNF_database411`** (อ่าน/เขียน work plans, logs, batches)
- DB รอง (read-only): **`manufacturing_system`** สำหรับ `process_templates` และ `process_steps`
- ใช้ `DB_*`, `STEPS_DB_*`, `TEMPLATES_DB_*` แทนการใส่ `DATABASE_URL` ตรงๆ — ระบบสร้าง URL ให้อัตโนมัติ
- ใช้ `prisma db pull` + `db:generate` กับ schema เดิม — **ไม่รัน migrate ทับ DB production**

## Prerequisites

- Node.js 20+
- pnpm 9+
- MySQL 5.7+ (local — XAMPP, MySQL Workbench, MariaDB)

## Quick Start

```bash
# ติดตั้ง dependencies
pnpm install

# สร้าง env files
cp infra/env/.env.example backend/.env
cp frontend/apps/web/.env.local.example frontend/apps/web/.env.local
```

แก้ค่าใน `backend/.env` ให้ตรงกับ MySQL ของคุณ (ดูตัวอย่างใน `infra/env/.env.example`):

```env
DB_HOST=192.168.0.96
DB_USER=jitdhana
DB_PASSWORD=your_password
DB_NAME=MNF_database411
DB_PORT=3306

# optional — DB ภายนอกสำหรับ process_templates / process_steps
STEPS_DB_NAME=manufacturing_system
TEMPLATES_DB_NAME=manufacturing_system

WORKPLAN_PROVIDER=db
```

จากนั้น:

```bash
# Generate Prisma client (จาก schema ที่ pull มาแล้ว)
pnpm db:generate

# รัน dev (frontend + backend พร้อมกัน)
pnpm dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Login: http://localhost:3000/login (PIN demo: `1234`, `5678`, `9999`)

## API Endpoints (หลัก)

Frontend เรียก `/api/...` ผ่าน Next.js rewrite ไปที่ backend (`frontend/apps/web/next.config.mjs`) — ไม่จำเป็นต้องเปิด port 3001 ให้เครื่องอื่นใน WiFi ถ้าเข้าผ่าน port 3000

| Method | Path | คำอธิบาย |
|--------|------|----------|
| `POST` | `/api/auth/verify-pin` | เข้าสู่ระบบด้วย PIN |
| `POST` | `/api/auth/register-pin` | ลงทะเบียน PIN |
| `GET` | `/api/auth/me` | ข้อมูล session ปัจจุบัน (JWT) |
| `GET` | `/api/business-units` | รายการหน่วยธุรกิจ (BU) |
| `GET` | `/api/jobs?date=&bu_id=` | รายการงานตามวันที่ / BU |
| `GET` | `/api/jobs/:id` | รายละเอียดงาน |
| `GET` | `/api/workplan/jobs?date=&bu_id=` | งานจาก Workplan adapter โดยตรง |
| `GET` | `/api/formula-weighing/jobs?date=&bu_id=` | รายการงานสำหรับตวงสูตร |
| `GET` | `/api/formula-weighing/:jobId` | สูตร + น้ำหนักวัตถุดิบ |
| `POST` | `/api/formula-weighing` | บันทึกน้ำหนักวัตถุดิบ |
| `DELETE` | `/api/formula-weighing/:jobId/ingredients/:materialCode` | ลบวัตถุดิบที่เพิ่มเอง |
| `POST` | `/api/formula-weighing/:jobId/verify` | ตรวจสอบวัตถุดิบ |
| `GET` | `/api/formula-weighing/units` | หน่วยน้ำหนักยอดนิยม |
| `GET` | `/api/formula-weighing/materials?search=` | ค้นหาวัตถุดิบ |
| `GET` | `/api/formula-weighing/settings/jobs` | ตั้งค่างานตวงสูตร |
| `PUT` | `/api/formula-weighing/settings/jobs` | อัปเดตตั้งค่างานตวงสูตร |
| `GET` | `/api/production-timer/:jobId` | ขั้นตอน + เวลาผลิต |
| `POST` | `/api/production-timer` | เริ่ม session จับเวลา |
| `PATCH` | `/api/production-timer/:jobId` | อัปเดตเวลาแต่ละขั้นตอน |
| `PATCH` | `/api/production-timer/:jobId/operator-weighing` | บันทึกน้ำหนักวัตถุดิบฝั่งผู้ปฏิบัติงาน |
| `POST` | `/api/production-summary` | บันทึกผลผลิต |
| `GET` | `/api/production-summary/:jobId` | ดึงผลผลิตที่บันทึกแล้ว |

> Endpoint ส่วนใหญ่ต้องมี JWT ยกเว้น `auth/verify-pin` และ `auth/register-pin` — ดู permission ใน controller แต่ละโมดูล

## หน้า Frontend (Next.js App Router)

| Path | โมดูล | คำอธิบาย |
|------|--------|----------|
| `/` | dashboard | แดชบอร์ดหลัก |
| `/login` | auth | เข้าสู่ระบบ PIN |
| `/register` | auth | ลงทะเบียน PIN |
| `/production-list` | dashboard | รายการงานผลิต (ตาม BU) |
| `/all-production-list` | dashboard | รายการงานทุก BU |
| `/formula-weighing-list` | formula-weighing | รายการตวงสูตร |
| `/formula-weighing` | formula-weighing | ตวงสูตรรายงาน |
| `/formula-weighing-settings` | formula-weighing | ตั้งค่างานตวงสูตร |
| `/production-timer` | production-timer | จับเวลาผลิต |
| `/production-summary` | production-summary | สรุปผลผลิต |
| `/all-production` | — | หน้ารวมผลิต (legacy route) |
| `/access-denied` | — | ไม่มีสิทธิ์เข้าถึง |

Logic อยู่ใน `frontend/apps/web/src/modules/<name>/` — route ใน `app/` เป็น thin wrapper

## โครงสร้างโปรเจกต์

```
TimeTacker/
├── frontend/
│   ├── apps/web/                 # Next.js 15 (App Router)
│   │   ├── app/                  # Routes (thin pages)
│   │   ├── src/modules/          # Feature modules
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── formula-weighing/
│   │   │   ├── production-timer/
│   │   │   └── production-summary/
│   │   ├── components/           # Shared UI (shadcn)
│   │   ├── lib/                  # API client, utils
│   │   └── middleware.ts         # Auth redirect
│   └── packages/pin-login/       # @jitdhana/pin-login (workspace package)
├── backend/                      # NestJS + Prisma
│   ├── prisma/schema.prisma      # Schema จาก db pull
│   ├── scripts/                  # Debug / seed / verify scripts
│   └── src/
│       ├── modules/
│       │   ├── auth/             # PIN + JWT
│       │   ├── business-units/   # หน่วยธุรกิจ (BU)
│       │   ├── jobs/             # รายการงานรวม
│       │   ├── workplan/         # Adapter (mock / http / db)
│       │   ├── formula-weighing/
│       │   ├── production-timer/
│       │   └── production-summary/
│       └── shared/
│           ├── auth/             # Guards, JWT, permissions
│           ├── prisma/
│           ├── services/         # BatchResolver, BomService, MaterialResolver, …
│           └── utils/
├── infra/
│   ├── docker/                   # docker-compose, Dockerfiles
│   ├── env/.env.example          # ตัวอย่าง env รวม
│   ├── scripts/                  # dev.ps1, dev.sh, migrate.sh
│   └── sql/                      # SQL สำหรับ BU / seed ข้อมูลตัวอย่าง
├── docs/
│   ├── architecture.md
│   ├── conventions.md
│   └── modules/                  # เอกสารแต่ละโมดูล
├── design/                       # เอกสารออกแบบ UI (เช่น LOGIN-DESIGN.md)
├── prototype/                    # HTML prototype ก่อนสร้าง Next.js
├── package.json                  # Root scripts (pnpm workspace)
└── pnpm-workspace.yaml
```

Monorepo จัดการด้วย **pnpm workspace** (`frontend/apps/*`, `frontend/packages/*`, `backend`)

## Module Development Rules

1. **Module สื่อสารกันผ่าน API เท่านั้น** — ห้าม import ข้าม module (ยกเว้น `shared/`)
2. **แต่ละ module มี public API ชัดเจน** — export ผ่าน `index.ts`
3. **Route page บางที่สุด** — logic อยู่ใน `src/modules/`
4. **Types แชร์ผ่าน module types หรือ API response**
5. **Workplan ใช้ Adapter Pattern** — สลับ mock/real API ผ่าน env

## How to Add a New Module

1. สร้างโฟลเดอร์ `frontend/apps/web/src/modules/<name>/`
2. สร้าง backend module ใน `backend/src/modules/<name>/`
3. เพิ่ม README.md ใน module folder
4. เพิ่มเอกสารใน `docs/modules/<name>.md`
5. Register NestJS module ใน `app.module.ts`
6. สร้าง thin route ใน `app/`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host (DB หลัก) | — |
| `DB_USER` | MySQL user | — |
| `DB_PASSWORD` | MySQL password | — |
| `DB_NAME` | Database หลัก (เช่น `MNF_database411`) | — |
| `DB_PORT` | MySQL port | `3306` |
| `STEPS_DB_*` | DB ภายนอกสำหรับ `process_steps` (optional) | fallback ไป `DB_*` |
| `TEMPLATES_DB_*` | DB ภายนอกสำหรับ `process_templates` (optional) | fallback ไป `DB_*` |
| `DATABASE_URL` | สร้างอัตโนมัติจาก `DB_*` | — |
| `PORT` | Backend port | `3001` |
| `JWT_SECRET` | JWT signing secret | (required in prod) |
| `WORKPLAN_PROVIDER` | `mock`, `http`, หรือ `db` | `mock` |
| `WORKPLAN_API_URL` | Workplan API URL (เมื่อใช้ `http`) | (empty) |
| `CORS_ORIGIN` | Allowed frontend origins (คั่นด้วย `,`) | `http://localhost:3000` |
| `LABOR_STANDARD_WORK_MINUTES` | นาทีทำงานมาตรฐานต่อวัน (คำนวณต้นทุนแรงงาน) | `495` |
| `NEXT_PUBLIC_API_URL` | Backend API โดยตรง (optional — default ใช้ proxy `/api`) | (ว่าง = proxy) |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run frontend + backend |
| `pnpm dev:web` | Run frontend only |
| `pnpm dev:backend` | Run backend only |
| `pnpm build` | Build all packages |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:pull` | Pull schema จาก MySQL (`prisma db pull`) |
| `pnpm db:migrate` | Prisma migrate (ใช้เฉพาะ dev DB ใหม่ — **ไม่รันทับ production**) |
| `pnpm build:pin-login` | Build `@jitdhana/pin-login` package |

## Deployment

Docker Compose ใน `infra/docker/` มี PostgreSQL เป็น optional สำหรับทีมที่ deploy แบบ container — การพัฒนาปกติใช้ MySQL local

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

ดูรายละเอียดเพิ่มใน [docs/architecture.md](docs/architecture.md)
