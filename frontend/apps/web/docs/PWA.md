# Progressive Web App (PWA) — ระบบครัวกลาง

## ภาพรวม

ระบบนี้รองรับ PWA ทำให้พนักงานสามารถติดตั้งลงบนหน้าจอหลักของมือถือและใช้งานได้เหมือนแอปพลิเคชันปกติ (ไม่มี browser chrome บนหน้าจอ)

## Phase Roadmap

| Phase | สถานะ | รายละเอียด |
|-------|--------|------------|
| **Phase 1 — Installable** | ✅ เสร็จแล้ว | manifest.json, icons, service worker พื้นฐาน |
| **Phase 2 — Offline** | 🔜 แผนต่อไป | cache strategy, offline fallback page |
| **Phase 3 — Advanced** | 🔜 อนาคต | Push notifications, Background sync |

---

## Phase 1 — สิ่งที่ implement แล้ว

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|------|---------|
| `public/manifest.json` | Web App Manifest — ชื่อ app, icons, display mode |
| `public/icons/icon-192.png` | Icon สำหรับ Android home screen |
| `public/icons/icon-512.png` | Icon ขนาดใหญ่สำหรับ splash screen |
| `public/icons/icon-maskable-192.png` | Icon แบบ maskable (safe zone padding สำหรับ Android) |
| `app/layout.tsx` | `viewport` export + `manifest`, `appleWebApp` metadata |
| `next.config.mjs` | ครอบด้วย `withPWA` จาก `@ducanh2912/next-pwa` |
| `scripts/generate-pwa-icons.mjs` | Script สร้าง PNG icons จาก `public/icon.svg` |

### ข้อมูล Manifest

```json
{
  "name": "ระบบควบคุมการผลิต",
  "short_name": "ครัวกลาง",
  "start_url": "/dashboard",
  "display": "standalone",
  "theme_color": "#3b82f6"
}
```

---

## การทดสอบ

### ทดสอบบน Chrome DevTools (Desktop)

1. Build และ start production server:
   ```bash
   pnpm --filter web build
   pnpm --filter web start
   ```
2. เปิด `http://localhost:3000`
3. กด `F12` → แท็บ **Application**
4. ตรวจ **Manifest** → ต้องเห็น name, icons, display: standalone
5. ตรวจ **Service Workers** → ต้องเห็น `sw.js` สถานะ activated
6. แถบ URL ด้านบนขวา → ปุ่ม **Install** (⊕) ต้องปรากฏ

> **หมายเหตุ:** Service Worker จะ generate เฉพาะตอน `pnpm build` เท่านั้น ใน `pnpm dev` SW ถูก disable เพื่อป้องกันปัญหา cache

### ติดตั้งบน Android

1. เปิด Chrome บน Android แล้วไปที่ URL ของระบบ
2. กดที่ปุ่ม Menu (⋮) → **"Add to Home screen"**
3. ยืนยันชื่อ → กด **Add**
4. กด icon จาก Home screen → เปิดในโหมด standalone (ไม่มี browser bar)

### ติดตั้งบน iOS (Safari)

1. เปิด Safari แล้วไปที่ URL ของระบบ
2. กดปุ่ม **Share** (กล่องที่มีลูกศรชี้ขึ้น)
3. เลื่อนลงแล้วกด **"Add to Home Screen"**
4. ยืนยันชื่อ → กด **Add**

> **iOS Note:** Safari ไม่รองรับ Push Notifications และ Background Sync (Phase 3)

---

## ข้อควรระวัง

### Service Worker และ Authentication

- **Auth routes (`/api/auth/*`) ต้องผ่าน network เสมอ** — SW ไม่ควร cache เส้นทาง login/register/verify-pin เพราะ PIN ต้องตรวจสอบกับ backend จริง
- JWT token เก็บใน `localStorage` — ปลอดภัยจาก SW (SW ไม่มีสิทธิ์เข้าถึง localStorage)
- ใน Phase 2 เมื่อเพิ่ม cache strategy ต้องเพิ่ม `runtimeCaching` ที่ exclude `/api/auth/*` ด้วย `NetworkOnly`

### HTTPS Requirement

- PWA (service worker) ต้องใช้ **HTTPS** ใน production
- `localhost` ใช้ได้ในการ development โดยไม่ต้อง HTTPS
- ถ้า deploy บน LAN (192.168.x.x) อาจต้องการ self-signed certificate

### Regenerate Icons

ถ้าเปลี่ยน `public/icon.svg` ให้รัน script ใหม่:
```bash
node frontend/apps/web/scripts/generate-pwa-icons.mjs
```

---

## Phase 2 — Offline Support (แผนต่อไป)

เมื่อพร้อมทำ Phase 2 ให้เพิ่ม `runtimeCaching` ใน `next.config.mjs`:

```js
withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*\/api\/auth\/.*/,
      handler: "NetworkOnly",  // auth ต้อง online เสมอ
    },
    {
      urlPattern: /^https?:\/\/.*\/api\/jobs.*/,
      handler: "StaleWhileRevalidate",  // แสดงงานเก่าก่อน แล้ว refresh
      options: {
        cacheName: "jobs-cache",
        expiration: { maxAgeSeconds: 60 * 60 * 24 },  // 1 วัน
      },
    },
  ],
})
```

และสร้าง `app/offline/page.tsx` เป็น fallback page เมื่อไม่มีเน็ต
