# Auth Module

PIN-based authentication with role-based permissions (RBAC).

## Frontend

- `src/modules/auth/components/AuthLoginPage.tsx` — Login/Register wrapper
- `src/shared/lib/auth.ts` — session + permission helpers
- `src/shared/layout/AppNavMenu.tsx` — permission-aware navigation
- Routes: `/login`, `/register`, `/access-denied`

## Backend

- `POST /api/auth/verify-pin` — Verify PIN, return JWT + permissions (+ `needsRegistration` when applicable)
- `GET /api/auth/me` — Refresh current user permissions and registration state (Bearer token)
- `POST /api/auth/register-pin` — Set permanent PIN for accounts pending registration (Bearer token, `needsRegistration`)
- `PATCH /api/auth/change-pin` — Change PIN for registered users (Bearer token)

## Admin: เพิ่มสมาชิกใหม่

Admin ที่มีสิทธิ์ `admin.users.write` ใช้ `POST /api/admin/users`:

| Field | คำอธิบาย |
|-------|----------|
| `name` | ชื่อ-นามสกุล |
| `idCode` | รหัสพนักงาน (unique) |
| `roleId` | บทบาทที่กำหนดตั้งแต่สร้างบัญชี |
| `tempPin` | PIN ชั่วคราว 4 หลัก (ตัวเลข, ห้าม PIN อ่อน เช่น `1234`) |

ระบบตั้ง `employee_code = "NEEDS_REGISTER"` และแสดง PIN ชั่วคราวให้ Admin แจ้งพนักงานครั้งเดียว

## Registration Flow

1. Admin สร้างผู้ใช้ + กำหนดบทบาท + PIN ชั่วคราว (`POST /api/admin/users`)
2. พนักงาน login ที่ `/login` ด้วย PIN ชั่วคราว
3. ระบบตอบ `needsRegistration: true` และพาไป `/register`
4. พนักงานตั้ง PIN ใหม่ (`POST /api/auth/register-pin`)
5. เข้าระบบด้วยสิทธิ์ตามบทบาทที่ Admin กำหนดไว้

หมายเหตุ: หน้า `/register` เข้าได้เฉพาะหลัง login ด้วย PIN ชั่วคราว (ไม่มีลิงก์ตรงจากหน้า login)

## Roles

| Role | ตวงสูตร | ผลิต | งานผลิตทั้งหมด |
|------|---------|------|----------------|
| `operator` | ไม่เห็น | ได้ | ไม่เห็น |
| `weighing_staff` | ได้ | ได้ | ไม่เห็น |
| `manager` / `supervisor` | ได้ | ได้ | ได้ |

## Demo PINs

ใช้ได้เฉพาะ non-production + `ALLOW_DEMO_PINS=true`

| PIN | User | Role |
|-----|------|------|
| 1234 | ภา | operator |
| 5678 | สาม | weighing_staff |
| 9999 | เอ | manager |

## Permission Actions

- `formula_weighing.write` — บันทึกน้ำหนักสูตร
- `formula_weighing.verify` — ยืนยันสูตรก่อนเริ่มผลิต
- `production_timer.write` — เริ่ม/บันทึกจับเวลา
- `production_summary.write` — บันทึกสรุปผลผลิต
- `admin.users.read` / `admin.users.write` — ดู/จัดการผู้ใช้และสิทธิ์

## Login Flow

1. User enters PIN on login page
2. Frontend calls `POST /api/auth/verify-pin`
3. JWT + permissions stored in `localStorage` and menu cookie
4. Backend guards enforce write/verify actions
5. Frontend hides menus/tabs user cannot access
6. Operator starts production only after formula is verified by weighing staff
