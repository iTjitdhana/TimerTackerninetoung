/** วัตถุดิบที่ผู้ผลิตตวงบนหน้าจับเวลา — mirror backend config */
const OPERATOR_WEIGHABLE_MATERIAL_CODES = new Set(["206004"])

const OPERATOR_WEIGHABLE_NAME_PATTERNS = [/น้ำเปล่า/i]

export function isOperatorWeighableMaterial(
  materialCode?: string | null,
  materialName?: string | null,
): boolean {
  const code = materialCode?.trim()
  if (code && OPERATOR_WEIGHABLE_MATERIAL_CODES.has(code)) {
    return true
  }

  const name = materialName?.trim()
  if (!name) return false
  return OPERATOR_WEIGHABLE_NAME_PATTERNS.some((pattern) => pattern.test(name))
}
