# Dashboard Module

หน้าหลักแสดงรายการงานผลิตจาก Jobs API (sync จาก Workplan)

## Routes

- `/` — Dashboard home

## API

- `GET /api/jobs?date=` — ดึงงานตามวันที่ (fallback เป็น mock data ถ้า API ไม่พร้อม)
