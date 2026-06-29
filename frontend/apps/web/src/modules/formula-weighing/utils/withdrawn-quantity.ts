/** ค่าที่ถือว่ายังไม่ได้กรอกจำนวนเบิก (รวม "0" จาก DB ก่อนตวง) */
export function isEmptyWithdrawnQuantity(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return true
  const num = Number(trimmed.replace(/,/g, ""))
  return !Number.isFinite(num) || num === 0
}

/** ค่าเริ่มต้นในช่องกรอก — ไม่แสดง 0 ให้พิมพ์ทับ */
export function withdrawnQuantityForInput(value: string | null | undefined): string {
  if (isEmptyWithdrawnQuantity(value)) return ""
  return value!.trim()
}

/** อนุญาตเฉพาะตัวเลขและจุดทศนิยม (คงรูปแบบระหว่างพิมพ์ เช่น 0.14) */
export function sanitizeWithdrawnQuantityInput(raw: string): string {
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.]/g, "")
  const dot = cleaned.indexOf(".")
  if (dot === -1) return cleaned
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "")
}

/** แปลงเป็นตัวเลขก่อนบันทึก — ตัดเลข 0 นำหน้า (06 → 6, 00.14 → 0.14) */
export function normalizeWithdrawnQuantityForSave(raw: string): string {
  const trimmed = sanitizeWithdrawnQuantityInput(raw.trim())
  if (!trimmed || trimmed === ".") return ""
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0) return ""
  if (num === 0) return ""
  return String(num)
}

/** แสดงในตาราง */
export function formatWithdrawnQuantityDisplay(value: string | null | undefined): string {
  if (isEmptyWithdrawnQuantity(value)) return ""
  return normalizeWithdrawnQuantityForSave(value!) || value!.trim()
}
