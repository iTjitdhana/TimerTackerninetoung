# Formula Weighing Module

เจ้าหน้าที่ตวงสูตรบันทึกน้ำหนักวัตถุดิบตามสูตร

## Actor

เจ้าหน้าที่ตวงสูตร

## Input

- Production jobs จาก Workplan/Jobs API
- รายการวัตถุดิบตามสูตร

## Output

- WeighingRecord (JSON ingredients with planned/actual weights)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/formula-weighing` | Save weighing record |
| POST | `/api/formula-weighing/:jobId/verify` | Operator verifies |
| GET | `/api/formula-weighing/:jobId` | Get record |

## Frontend Routes

- `/formula-weighing` — Weighing form
- `/formula-weighing-list` — Job list

## Status Transition

`pending` → `weighing` → `weighed`
