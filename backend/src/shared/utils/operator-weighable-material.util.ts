/** วัตถุดิบที่ผู้ผลิตตวงเองบนหน้าจับเวลา (ไม่ใช่เจ้าหน้าที่ตวงสูตร) */
const OPERATOR_WEIGHABLE_MATERIAL_CODES = new Set([
  "206004", // น้ำเปล่า
]);

const OPERATOR_WEIGHABLE_NAME_PATTERNS = [/น้ำเปล่า/i];

export function isOperatorWeighableMaterial(
  materialCode?: string | null,
  materialName?: string | null,
): boolean {
  const code = materialCode?.trim();
  if (code && OPERATOR_WEIGHABLE_MATERIAL_CODES.has(code)) {
    return true;
  }

  const name = materialName?.trim();
  if (!name) return false;
  return OPERATOR_WEIGHABLE_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function assertOperatorWeighableMaterial(
  materialCode: string,
  materialName?: string | null,
): void {
  if (!isOperatorWeighableMaterial(materialCode, materialName)) {
    throw new Error(
      `Material "${materialCode}" is not configured for operator weighing`,
    );
  }
}
