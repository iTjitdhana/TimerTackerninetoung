/**
 * รายการในหน้าตวงสูตร — ชื่อฟิลด์ตรงหัวคอลัมน์ UI
 * @see FORMULA_WEIGHING_LABELS.columns
 * @see API_FIELD_MAP สำหรับชื่อ JSON ที่ส่งไป backend
 */
export interface FormulaWeighingLine {
  id: string
  /** รหัสสินค้า (API: code) */
  productCode: string
  /** ชื่อสินค้า (API: name) */
  productName: string
  /** จำนวนตามสูตร BOM (API: quantity) */
  plannedQuantity: string
  /** จำนวนเบิกที่ตวงจริง (API: measuredWeight) */
  withdrawnQuantity: string
  /** หน่วยจำนวนเบิก — บันทึกใน batch_material_usage (API: unit) */
  withdrawnUnit: string
  /** หน่วยจำนวนตามสูตร (API: formulaUnit) */
  plannedUnit?: string
  /** จำนวนต่อ 1 แบทช์ — BOM เท่านั้น (API: baseQuantity) */
  baseQuantity?: string
  isManual?: boolean
  operatorWeighable?: boolean
  editableOnTimer?: boolean
  /** ราคาต่อหน่วย (บาท) */
  unitPrice?: number
  unitPriceStatus?: "found" | "fallback" | "default" | "no_data"
  unitPriceFallbackReason?: string
  /** หมายเหตุต่อวัตถุดิบ */
  note?: string
  /** 'api' = ดึงจาก onhand API | 'manual' = ผู้ใช้คีย์เอง */
  unitPriceSource?: "api" | "manual"
  /** เวลาที่ทราบที่มาของราคา (ISO UTC) */
  unitPriceSourceAt?: string
}

/** รูปแบบ JSON จาก API/backend — ชื่อฟิลด์คงเดิม */
export interface IngredientApi {
  id: string
  code: string
  name: string
  quantity: string
  measuredWeight: string
  unit: string
  formulaUnit?: string
  baseQuantity?: string
  isManual?: boolean
  operatorWeighable?: boolean
  editableOnTimer?: boolean
  unitPrice?: number
  unitPriceStatus?: "found" | "fallback" | "default" | "no_data"
  unitPriceFallbackReason?: string
  note?: string
  unitPriceSource?: "api" | "manual"
  unitPriceSourceAt?: string
}

/** @deprecated ใช้ IngredientApi สำหรับ API หรือ FormulaWeighingLine ใน UI */
export type Ingredient = IngredientApi

export interface MaterialOption {
  code: string
  name: string
  unit: string
}

export interface JobOperatorProfile {
  name: string
  employeeId?: string
  hasAvatar?: boolean
}

export interface ProductionJob {
  id: string
  workplanRef?: string | null
  jobCode?: string
  productName: string
  scheduledDate: string
  startTime?: string | null
  endTime?: string | null
  status: string
  operators: JobOperatorProfile[]
  notes?: string | null
  buId?: number
  buCode?: string
  buName?: string
}
