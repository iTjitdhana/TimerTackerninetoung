/** ข้อความ UI หน้าตวงสูตร — ใช้ค่าจากที่นี่เท่านั้น */
export const FORMULA_WEIGHING_LABELS = {
  pageTitle: "ตวงสูตร",
  sectionTitle: "ตวงสูตรวัตถุดิบ",
  columns: {
    productCode: "รหัสสินค้า",
    productName: "ชื่อสินค้า",
    plannedQuantity: "จำนวน",
    withdrawnQuantity: "จำนวนเบิก",
    unitPrice: "ราคา/หน่วย",
    note: "หมายเหตุ",
  },
  addProduct: "เพิ่มสินค้า",
  manualBadge: "เพิ่มเอง",
  withdrawDialogTitle: "บันทึกจำนวนเบิก",
  withdrawDialogSubtitle: "(ผู้ตวงสูตร)",
  plannedQuantityHint: "จำนวนตามสูตร",
  fieldPlannedQuantity: "จำนวน",
  fieldBatchCount: "จำนวน Batch",
  fieldWithdrawnQuantity: "จำนวนเบิก",
  fieldWithdrawnUnit: "หน่วยจำนวนเบิก",
  fieldUnitPrice: "ราคา/หน่วย (บาท)",
  fieldNote: "หมายเหตุ",
  fieldProductCode: "รหัสสินค้า",
  fieldProductName: "ชื่อสินค้า",
  fieldUnit: "หน่วย",
  searchPlaceholder: "ค้นหารหัสหรือชื่อสินค้า...",
  verifyFormula: "ยืนยันสูตร",
  verified: "ยืนยันสูตรแล้ว",
  cancel: "ยกเลิก",
  save: "บันทึก",
  addToList: "เพิ่มในรายการ",
  unitPriceStatus: {
    fallback: "ราคาเดือนก่อน",
    default: "ราคาตั้งต้น",
    noData: "ไม่มีราคา",
  },
  errors: {
    selectJob: "กรุณาเลือกงานจากหน้า Dashboard เพื่อโหลดสูตรจากระบบ",
    productExists: "รหัสสินค้านี้มีในรายการแล้ว",
    productCodeMax: "รหัสสินค้าต้องไม่เกิน 16 ตัวอักษร",
    fillAllFields: "กรุณากรอกรหัสสินค้า ชื่อสินค้า จำนวน และหน่วยให้ครบ",
    enterWithdrawnQty: "กรุณากรอกจำนวนเบิกก่อนบันทึก",
    enterWithdrawnUnit: "กรุณาเลือกหน่วยจำนวนเบิก",
    saveProductFailed: "บันทึกสินค้าลงระบบไม่สำเร็จ",
    saveWithdrawnFailed: "บันทึกจำนวนเบิกไม่สำเร็จ กรุณาลองใหม่",
    removeFailed: "ลบสินค้าไม่สำเร็จ",
    verifyFailed: "ยืนยันสูตรไม่สำเร็จ กรุณาบันทึกจำนวนเบิกให้ครบก่อน",
    noProducts: "ยังไม่มีสินค้า — กด \"เพิ่มสินค้า\" เพื่อเริ่มตวง",
    noFormula: "งานนี้ไม่มีสูตรในระบบ — กด \"เพิ่มสินค้า\" แล้วตวงเองได้",
    addWithdrawLater: "รายการจะถูกบันทึกลงฐานข้อมูลทันที — กด + เพื่อใส่จำนวนเบิกได้ภายหลัง",
  },
} as const

/**
 * แมปชื่อฟิลด์ในโค้ด (FormulaWeighingLine) ↔ JSON API/backend
 * อย่าเปลี่ยนค่าขวา — backend ยังใช้ชื่อเดิม
 */
export const API_FIELD_MAP = {
  productCode: "code",
  productName: "name",
  plannedQuantity: "quantity",
  withdrawnQuantity: "measuredWeight",
  withdrawnUnit: "unit",
  plannedUnit: "formulaUnit",
  baseQuantity: "baseQuantity",
  note: "note",
} as const
