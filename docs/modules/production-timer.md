# Production Timer Module

ผู้ปฏิบัติงานตรวจสอบวัตถุดิบและจับเวลาตามขั้นตอนการผลิต

## Actor

ผู้ปฏิบัติงาน

## Input

- Verified WeighingRecord (ต้อง `verifiedAt` ก่อนเริ่ม session)
- Production steps configuration

## Output

- ProductionSession (step timers: green/red/blue)
- Production summary (น้ำหนักผลผลิต) บันทึกในหน้าเดียวกันหลังจบขั้นตอนสุดท้าย

## Flow

1. เปิด `/production-timer?jobId={id}` — โฟกัสขั้นแรกที่ยังไม่เสร็จอัตโนมัติ
2. กด **เริ่ม** — สร้าง session (ครั้งแรก) และบันทึก `startTime` ของขั้นปัจจุบันลง server ทันที
3. กด **เสร็จสิ้น** — บันทึก `endTime` + duration; ไปขั้นถัดไป (strict: แก้ได้เฉพาะขั้นปัจจุบัน)
4. จบขั้นสุดท้าย — กรอกผลผลิตใน `ProductionSummaryForm`

## กฎการนำทาง (strict)

- ดูขั้นตอนที่ทำแล้วและขั้นปัจจุบันได้
- ข้ามไปขั้นที่ยังไม่ถึงไม่ได้
- ปุ่ม เริ่ม/เสร็จสิ้น ใช้ได้เฉพาะขั้นที่ยังไม่ `completed`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/production-timer` | Start session (`jobId`, `startedBy`) |
| PATCH | `/api/production-timer/:jobId` | Update steps (match ด้วย `stepName`) |
| GET | `/api/production-timer/:jobId` | Get session |

## Frontend Routes

- `/production-timer` — Timer interface
- `/production-list` — Job list
- `/all-production` — All production view

## Status Transition

`weighed` → `in_production` → `completed`
