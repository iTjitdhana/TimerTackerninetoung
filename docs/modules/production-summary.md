# Production Summary Module

บันทึกผลผลิต คำนวณเศษ/% yield และ upsert ต้นทุนการผลิตลง `production_costs`

## Actor

ผู้ปฏิบัติงาน

## Input

- `jobId` — งานผลิตที่จบขั้นตอน Timer แล้ว
- `outputLines` (optional) — ผลผลิตหลายบรรทัด (sellable + scrap)
- `outputQty` / `outputUnit` / `scrapQty` — backward compat สำหรับสินค้า output เดียว
- `dailyWagePerPerson` — ค่าแรงทั้งวันต่อคน (บาท)

### Output variants (`fg.conversion_description`)

ถ้าเป็น JSON array ระบบจะแสดงหลายบรรทัดผลผลิต:

```json
[
  {"label":"แพ็ค 450g","unit":"แพ็ค","conversionRate":0.45,"packSize":"450 กรัม"},
  {"label":"แพ็ค 1 กก.","unit":"แพ็ค","conversionRate":1.0,"packSize":"1 กก."}
]
```

- **sellable** = สินค้าขายได้แต่ละขนาด (ไม่ใช่เศษ)
- **scrap** = เศษจริง (กก.) เท่านั้น

## Output

- `batch_production_results` — ผลผลิต + เศษ
- `production_costs` — ต้นทุน/yield รวมจากวัตถุดิบ + ค่าแรงที่ผู้ใช้ใส่
- `production_batches` / `work_plans` — สถานะ completed
- `batch_material_usage.total_cost` — ต้นทุนต่อบรรทัด (MySQL generated column จาก `actual_qty × unit_price`)

## Data mapping (`batch_production_results`)

| Column | ความหมาย |
|--------|----------|
| `good_qty` | จำนวนผลิตได้ของบรรทัดหลัก (sellable ที่มีน้ำหนักมากสุด) |
| `good_secondary_unit` | หน่วยของบรรทัดหลัก |
| `good_secondary_qty` | น้ำหนักสินค้าดีรวม (กก.) |
| `defect_qty` | เศษจริง (กก.) |

รายละเอียดทุกบรรทัดเก็บใน `production_costs.material_details.outputLines`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/production-summary` | บันทึกสรุป + upsert production_costs |
| GET | `/api/production-summary/:jobId` | โหลด outputConfig, summary, costPreview |

### POST body

```json
{
  "jobId": "123",
  "dailyWagePerPerson": 450,
  "outputLines": [
    {"kind":"sellable","label":"แพ็ค 450g","qty":150,"unit":"แพ็ค","conversionRate":0.45},
    {"kind":"sellable","label":"แพ็ค 1 กก.","qty":28,"unit":"แพ็ค","conversionRate":1},
    {"kind":"scrap","label":"เศษ","qty":0.5,"unit":"กก.","conversionRate":1}
  ]
}
```

### GET response (ส่วนสำคัญ)

```json
{
  "outputConfig": {
    "defaultOutputUnit": "กก.",
    "masterUnit": "แพ็ค",
    "conversionRate": 0.45,
    "baseUnit": "กก.",
    "packSize": "450 กรัม",
    "outputVariants": [
      { "label": "แพ็ค 450g", "unit": "แพ็ค", "conversionRate": 0.45, "packSize": "450 กรัม" },
      { "label": "แพ็ค 1 กก.", "unit": "แพ็ค", "conversionRate": 1, "packSize": "1 กก." }
    ],
    "unitOptions": [
      { "unit": "กก.", "conversionRate": 1 },
      { "unit": "แพ็ค", "conversionRate": 0.45 }
    ]
  },
  "costPreview": {
    "inputMaterialQty": 25.5,
    "materialCost": 1200,
    "timeUsedMinutes": 520,
    "operatorsCount": 2,
    "standardWorkMinutes": 495,
    "dailyWagePerPerson": null,
    "calculatedLaborCost": null
  }
}
```

`dailyWagePerPerson` / `calculatedLaborCost` ใน GET จะเป็น `null` จนกว่าจะบันทึกสรุปผลแล้ว (`dailyWagePerPerson` อ่านจาก `material_details.laborDailyWagePerPerson`, fallback derive จาก `labor_rate_per_hour`)

## Frontend Routes

- `/production-summary` — Standalone summary form
- Embedded in Production Timer page (`ProductionSummaryForm`)

## สูตรคำนวณ

### น้ำหนักผลิตได้ (กก.)

```
sellableKg = Σ (qty × conversionRate) ของบรรทัด kind=sellable
scrapKg = บรรทัด kind=scrap หรือ max(0, inputMaterialKg - sellableKg)
```

### % Yield

```
yieldPercent = ((sellableKg + scrapKg) / inputMaterialKg) × 100
```

### ต้นทุนต่อหน่วย (multi-output)

```
costPerSellableKg = totalCost / sellableKg
costPerLine = (line.weightKg / sellableKg) × totalCost / line.qty
scrapCost = costPerSellableKg × scrapKg
```

`yield_percent` ใน `production_costs` เป็น MySQL generated column — DB คำนวณเองจาก input/output

Phase นี้ `inputMaterialKg` รวมเฉพาะวัตถุดิบหน่วย กก. จาก `batch_material_usage`

### ต้นทุน (`production_costs`)

```
materialCost = SUM(actual_qty × unit_price)
hourlyRate = dailyWagePerPerson × 60 / standardWorkMinutes
laborCost = operatorsCount × dailyWagePerPerson × (timeUsedMinutes / standardWorkMinutes)
labor_rate_per_hour = hourlyRate  (persist ลง DB — ทศนิยม 2 ตำแหน่ง)
laborDailyWagePerPerson เก็บใน material_details JSON เพื่อโหลดกลับค่าแรง/คนได้ตรง
labor_cost (DB generated) = (time_used_minutes / 60) × operators_count × labor_rate_per_hour
totalCost = materialCost + laborCost
outputUnitCost = totalCost / outputQty
```

`standardWorkMinutes` อ่านจาก env `LABOR_STANDARD_WORK_MINUTES` (default 495 = 8 ชม. 15 นาที)

Generated columns ใน MySQL (ห้ามเขียนตรง): `yield_percent`, `labor_cost`

### ราคาวัตถุดิบต่อรอบ (`batch_material_usage.unit_price`)

```
unit_price = userInput ?? existing.unit_price ?? materials.price ?? 0
total_cost = actual_qty × unit_price  (คำนวณโดย MySQL generated column)
```

ผู้ใช้ override ราคาได้ตอนตวงสูตรหรือตวงบนหน้าจับเวลา แล้วเก็บเป็น snapshot ต่อ batch

แหล่งข้อมูล:

- วัตถุดิบ → `batch_material_usage` (จาก Formula Weighing / Operator Weighing)
- เวลา/จำนวนคน → จาก Timer (`process_executions` หรือ fallback `logs`) โดยใช้ **wall-clock** จากเวลาเริ่มแรกถึงเวลาสิ้นสุดล่าสุด (ไม่รวม duration ทีละขั้น เพราะขั้นตอนอาจทำพร้อมกัน)
- ค่าแรง → ผู้ใช้ใส่ **ค่าแรงทั้งวัน/คน** ใน `ProductionSummaryForm` แล้วระบบคำนวณต้นทุนแรงงานอัตโนมัติ

## ข้อจำกัด Phase นี้

- Yield input รวมเฉพาะวัตถุดิบหน่วย กก. (ยังไม่ใช้ `unit_conversions`)
- `production_costs_history` ยังไม่เขียน
- ไม่มี global labor rate — ใช้ค่าแรงทั้งวัน/คนที่ใส่ต่อรอบ (Phase 2: แยกรายคน)
- ข้อมูลเก่าที่ `good_qty` เก็บเป็น กก. โดยตรง อาจไม่สอดคล้อง semantics ใหม่
