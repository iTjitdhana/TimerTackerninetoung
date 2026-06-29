/** คูณจำนวนสูตร BOM ตามจำนวนแบทช์ */
export function scaleBomQuantity(baseQty: number, batchCount: number): number {
  const base = Number.isFinite(baseQty) ? baseQty : 0;
  const count = normalizeBatchCount(batchCount);
  return base * count;
}

/** แปลงค่า batch count เป็น int >= 1 */
export function normalizeBatchCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/** แปลงตัวเลขเป็นสตริงสำหรับ API — ตัด trailing zeros ที่ไม่จำเป็น */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}
