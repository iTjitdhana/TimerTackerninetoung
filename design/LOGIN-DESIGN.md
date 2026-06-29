# ออกแบบหน้า Login (PIN) — Gate ก่อน Portal

## 1. เป้าหมาย

- เป็นประตูเข้า Portal — ยังไม่ login จะเข้า Portal ไม่ได้
- Login ด้วย **รหัสพนักงาน/Username + PIN**
- หลัง login สำเร็จ → redirect ไป Portal ตาม Role

---

## 2. องค์ประกอบบนหน้า (UI Components)

```
┌─────────────────────────────────────┐
│         [Logo องค์กร]               │
│                                     │
│      เข้าสู่ระบบ Portal             │
│   กรุณากรอกรหัสพนักงานและ PIN       │
│                                     │
│  รหัสพนักงาน / Username             │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  PIN (4–6 หลัก)                     │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐│
│  │ • │ │ • │ │   │ │   │ │   │ │   ││  ← ช่องทีละหลัก (แนะนำ)
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘│
│                                     │
│  [ ข้อความ error / แจ้งเตือน ]      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │         เข้าสู่ระบบ          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ลืม PIN? ติดต่อ IT Support         │
└─────────────────────────────────────┘
```

---

## 3. ฟิลด์และพฤติกรรม

| องค์ประกอบ | รายละเอียด |
|------------|------------|
| **รหัสพนักงาน** | text input, autofocus, required |
| **PIN** | ตัวเลข 4–6 หลัก, แสดงเป็น • , ไม่เก็บ plain text ฝั่ง client |
| **ปุ่ม Login** | disabled จนกว่ากรอกครบ, loading state ตอนส่ง |
| **Error** | PIN ไม่ถูก, บัญชีถูก lock, session หมดอายุ |
| **Return URL** | เก็บ `?redirect=/portal/...` หลัง login กลับไปหน้าเดิม |

### PIN Input — แนะนำ 2 แบบ

1. **ช่องทีละหลัก (OTP-style)** — UX ดีบนมือถือ, เหมาะ PIN สั้น
2. **ช่องเดียว type=password inputmode=numeric** — ทำง่าย, เหมาะ desktop

Prototype ใช้แบบ **ช่องทีละหลัก 6 หลัก**

---

## 4. Flow การใช้งาน

```
เปิด URL Portal
    → ไม่มี session → redirect /login?redirect=/portal
    → กรอก Username + PIN
    → กด Login
        → สำเร็จ: สร้าง session → redirect ไป Portal (ตาม role)
        → ล้มเหลว: แสดง error, นับครั้งผิด (lock หลัง 5 ครั้ง)
```

---

## 5. สถานะต่างๆ ที่ต้องออกแบบ

| สถานะ | การแสดงผล |
|-------|-----------|
| **Default** | ฟอร์มว่าง พร้อมกรอก |
| **Loading** | ปุ่ม spinner, disable input |
| **Error — PIN ผิด** | ข้อความแดง + เขย่าช่อง PIN |
| **Error — Lock** | "บัญชีถูกระงับชั่วคราว ลองใหม่ใน X นาที" |
| **Success** | redirect ทันที (ไม่ต้องหน้า success แยก) |

---

## 6. ความปลอดภัย (ออกแบบรองรับตั้งแต่ต้น)

- PIN ส่งผ่าน **HTTPS** เท่านั้น
- จำกัดความพยายาม (rate limit / lockout)
- ไม่แสดงว่า "username ไม่มี" vs "PIN ผิด" แยกกัน (ป้องกัน enumeration)
- Session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`
- Log การ login (สำเร็จ/ล้มเหลว) สำหรับ audit

---

## 7. Responsive

| ขนาดจอ | พฤติกรรม |
|--------|----------|
| Desktop | การ์ดกลางจอ, PIN box ขนาดกลาง |
| Mobile | full width, PIN box ใหญ่ขึ้น, เปิด numpad อัตโนมัติ |

---

## 8. สิ่งที่ทำใน Phase ถัดไป (หลัง UI)

- [ ] API `POST /auth/login` (username, pin)
- [ ] Session / JWT + middleware ดัก Portal
- [ ] Role-based redirect / menu
- [ ] หน้า admin จัดการ user & role

---

## 9. Tech Stack (แนะนำ — รอยืนยัน)

| Layer | ตัวเลือก |
|-------|----------|
| Frontend | HTML/CSS/JS → หรือ React / Next.js |
| Backend | Node.js / .NET / PHP |
| Auth | Session cookie หรือ JWT |
| DB | User + Role + PIN hash |

Prototype ปัจจุบัน: **HTML + CSS + Vanilla JS** (เปิดใน browser ได้ทันที)
