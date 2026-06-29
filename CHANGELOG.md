# Changelog — TimeTacker

## [2026-06-18] Cost Dashboard + UI Improvements

---

### 1. หน้า Cost Dashboard (ใหม่)

หน้าดูต้นทุนสินค้ารายวัน สำหรับ **Admin / Elevated** เท่านั้น

#### เส้นทาง
- Frontend: `/cost-dashboard`
- API: `GET /cost-dashboard/daily?date=YYYY-MM-DD`
- API: `GET /cost-dashboard/search?q=<keyword>`

#### ฟีเจอร์
| ฟีเจอร์ | รายละเอียด |
|---|---|
| ดูรายวัน | Calendar picker เลือกวันที่ (default = วันนี้ ตาม timezone Bangkok) |
| รายการตาม Work Plan | หน้าแรกแสดง **work plan ทั้งหมดของวันนั้น** — ข้อมูลที่ยังไม่มีแสดง `-` |
| ค้นหา | ค้นด้วยชื่อสินค้า / รหัส / ชื่อผู้ปฏิบัติงาน (จากประวัติ `production_costs`) |
| ตารางข้อมูล | สินค้า → ผู้ปฏิบัติงาน → เวลา → % Yield → ต้นทุนรวม → ข้อมูลครบ → สถานะเวลา |
| Detail Drawer | กดแถวเพื่อดูรายละเอียด + checklist ความครบข้อมูล 3 ขั้น |
| เปิด Production Timer | ปุ่มใน Drawer เปิด `/production-timer` ใน **แท็บใหม่** (`window.open`) |
| Timer Status Badge | `ปกติ` (เขียว) / `ตรวจสอบเวลา` (เหลือง) / `ไม่มีข้อมูล` (เทา) |
| ข้อมูลครบ Badge | `100%` / `67%` / `33%` / `0%` — จาก 3 ขั้น: ตวงวัตถุดิบ / กดเวลาครบ / บันทึกจำนวนผลิต |

#### ไฟล์ที่สร้างใหม่

**Backend**
```
backend/src/modules/cost-dashboard/
  ├── cost-dashboard.module.ts
  ├── cost-dashboard.controller.ts
  ├── cost-dashboard.service.ts
  ├── cost-dashboard.service.spec.ts
  ├── cost-dashboard.util.ts
  └── cost-dashboard.util.spec.ts
```

**Frontend**
```
frontend/apps/web/src/modules/cost-dashboard/
  ├── index.ts
  ├── services/cost-dashboard.api.ts
  └── components/CostDashboardPage.tsx

frontend/apps/web/app/cost-dashboard/page.tsx
```

#### Logic ดึงข้อมูล

**รายวัน (`getDailyOverview`)**
- ดึง `work_plans` ของวันที่เลือกเป็นหลัก (เรียง `job_name`)
- join `production_costs` ด้วย `work_plan_id` ก่อน แล้ว fallback `(job_code + bu_id + production_date)`
- ถ้ายังไม่มี cost row ใช้ id แบบ `wp-{workPlanId}` และแสดงค่าว่างเป็น `null` → UI แสดง `-`
- ดึง `batch_id` จาก cost หรือ `production_batches.work_plan_id`

**ผู้ปฏิบัติงาน**
- ดึงจาก `work_plan_operators` โดยใช้ `users.name` (ผ่าน `user_id` relation)
- ถ้า `user_id` เป็น null ให้ fallback lookup ผ่าน `id_code → users.id_code`

**% Yield**
- คำนวณจาก `input_material_qty` + `batch_production_results` (`good_secondary_qty`, `defect_qty`)
- **ไม่ใช้** คอลumn generated `yield_percent` ใน DB โดยตรง (เทียบหน่วยไม่ตรงกัน → ค่าสูงผิดปกติ)

**Timer Status** (ให้ตรงกับ Production Timer)
- อ่าน executions จาก `work_plan_id` เป็นหลัก (ไม่ใช่ batch ก่อน)
- โหลด log timings ผ่าน `ProductionLogService.getStepTimings()`
- ขั้นตอนถือว่าเสร็จถ้า: `status = completed` **หรือ** log มี start+stop **หรือ** มีทั้ง `start_time` + `end_time`
- `ok` = ครบทุกขั้น · `warn` = มีข้อมูลแต่ไม่ครบ · `no_data` = ไม่มี execution/log

**ความครบข้อมูลการผลิต (`dataCompleteness`)**
| ขั้น | เงื่อนไขครบ |
|---|---|
| ตวงวัตถุดิบ | `input_material_qty` / `material_cost` > 0 หรือมี `batch_material_usage` |
| กดเวลาครบ | Timer status = `ok` |
| บันทึกจำนวนผลิต | `output_qty` > 0 หรือมีผลใน `batch_production_results` |

คะแนน: ครบ 3/3 = **100%** · 2/3 = **67%** · 1/3 = **33%** · 0/3 = **0%**

**Timezone**
- ใช้ `parseDateOnlyBangkok` / `nextDateOnlyBangkok` / `todayDateOnlyBangkok` ใน `datetime.util.ts`
- Frontend ตั้ง `selectedDate` หลัง mount (`useMounted`) เพื่อกัน hydration mismatch

---

### 2. ระบบ Permission

#### Backend (`backend/src/shared/auth/permissions.constants.ts`)
- เพิ่ม `"cost_dashboard"` ใน `MenuKey` type และ `isMenuKey()`
- เพิ่ม `"admin.cost_dashboard.view"` ใน `ActionKey` type และ `isActionKey()`
- เพิ่ม `"cost_dashboard"` ใน `ELEVATED_MENUS` (Admin เท่านั้น — Supervisor ไม่ได้รับ)
- เพิ่ม `"admin.cost_dashboard.view"` ใน `ELEVATED_ACTIONS`

#### Frontend (`frontend/apps/web/src/shared/lib/permissions.constants.ts`)
- เพิ่ม `"cost_dashboard"` ใน `MenuKey` union และ `ELEVATED_MENUS`
- เพิ่ม `"admin.cost_dashboard.view"` ใน `ActionKey` และ `ELEVATED_ACTIONS`
- Supervisor menus **ไม่รวม** `cost_dashboard`

#### Middleware (`frontend/apps/web/middleware.ts`)
- เพิ่ม route guard: `"/cost-dashboard": "cost_dashboard"`

#### Nav Menu
- เพิ่มลิงก์ **Dashboard ต้นทุน** → `/cost-dashboard` (ไอคอน `TrendingUp`)
- เพิ่ม label ใน `menu-labels.ts`: `cost_dashboard: "Dashboard ต้นทุน"`

> **หมายเหตุ**: หลัง deploy ต้อง logout → login ใหม่เพื่อให้ JWT token มี permission ใหม่

---

### 3. Production Timer — IngredientsPanel

#### ปัญหาเดิม
- Panel อยู่ใน sticky header ทำให้ scroll ในตารางวัตถุดิบแล้ว page หลักเลื่อนแทน

#### การแก้ไข
- ย้าย IngredientsPanel ออกจาก header มาไว้ใน content area
- **Mobile**: แสดง inline ใต้ข้อมูล job
- **Desktop (md+)**: แสดงเป็น Dialog popup กลางจอ (`max-w-5xl`, `max-h-[90vh]`)

#### UI ที่ปรับ
- Input ปริมาณ + ราคา + ปุ่มบันทึก อยู่ใน row เดียวกัน (compact)
- ฟอนต์ใหญ่ขึ้นใน Dialog (`md:text-base`)
- เพิ่ม `overscroll-contain` เพื่อกัน scroll bubbling

---

### 4. Header / Mobile UI

- ลด padding header: `px-2.5 py-1.5` บน mobile, `md:p-4 lg:p-5` บน desktop
- ลด margin ใต้ header: `mb-1.5 md:mb-3`
- ปุ่มเลือกงาน: `px-2 py-1` บน mobile, `md:px-3 md:py-2` บน desktop
- Avatar: `w-5 h-5` บน mobile, `md:w-8 md:h-8` บน desktop
- Font ข้อมูล job info: `text-xs` บน mobile

---

### 5. Backend — Body Size Limit

- เพิ่ม limit ของ request body เป็น **10MB** ใน `backend/src/main.ts`
- รองรับการอัปโหลด avatar ขนาดใหญ่ขึ้น

```typescript
app.use(require("express").json({ limit: "10mb" }));
app.use(require("express").urlencoded({ limit: "10mb", extended: true }));
```

---

### 6. ไฟล์ที่แก้ไข (สรุป)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `backend/src/main.ts` | เพิ่ม body limit 10MB |
| `backend/src/app.module.ts` | import CostDashboardModule |
| `backend/src/shared/auth/permissions.constants.ts` | MenuKey + ActionKey cost_dashboard, Admin-only role matrix |
| `backend/src/shared/utils/datetime.util.ts` | `parseDateOnlyBangkok`, `nextDateOnlyBangkok`, `todayDateOnlyBangkok` |
| `backend/src/modules/cost-dashboard/*` | module ใหม่ + util + service spec (23 tests) |
| `frontend/apps/web/middleware.ts` | route guard `/cost-dashboard` |
| `frontend/apps/web/src/shared/lib/permissions.constants.ts` | MenuKey + ActionKey cost_dashboard |
| `frontend/apps/web/src/shared/layout/AppShell.tsx` | ลด padding header mobile + แก้ hydration display name |
| `frontend/apps/web/src/shared/layout/AppNavMenu.tsx` | เพิ่มลิงก์ Cost Dashboard |
| `frontend/apps/web/src/modules/user-profile/lib/menu-labels.ts` | เพิ่ม label cost_dashboard |
| `frontend/apps/web/src/modules/cost-dashboard/*` | หน้า Cost Dashboard + API types + completeness UI |
| `frontend/apps/web/src/modules/production-timer/components/ProductionTimerPage.tsx` | ย้าย IngredientsPanel + Dialog desktop |
| `frontend/apps/web/src/modules/production-timer/components/IngredientsPanel.tsx` | compact row input + ฟอนต์ใหญ่ขึ้น |

---

### 7. Bug fixes — Cost Dashboard

| ปัญหา | การแก้ |
|---|---|
| Supervisor เข้า Cost Dashboard ได้ | sync permission ให้ Admin-only ทั้ง backend + frontend + middleware |
| วันที่ไม่ตรง timezone ไทย | ใช้ Bangkok date utilities + init date picker หลัง mount |
| Join work plan ไม่เจอ | join ด้วย `work_plan_id` ก่อน fallback composite key |
| % Yield สูงผิดปกติ (เช่น 800%) | คำนวณจาก kg จริงใน `batch_production_results` |
| Timer ขึ้น "ตรวจสอบเวลา" ทั้งที่กดครบ | align logic กับ Production Timer + อ่าน logs |
| หน้าแรกว่างทั้งที่มี work plan | backend compile error (`job_name` ขาดใน `_enrichWithWpData`) — แก้แล้ว |
| Hydration mismatch ชื่อผู้ใช้ / วันที่ | `AppShell` + `CostDashboardPage` init หลัง mount |
