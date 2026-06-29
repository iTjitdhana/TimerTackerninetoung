const WEIGHING_UNIT_ALIASES: Record<string, string> = {
  "ก.": "กรัม",
};

export function canonicalWeighingUnit(unit: string | null | undefined): string {
  const trimmed = unit?.trim() ?? "";
  if (!trimmed) return "";
  return WEIGHING_UNIT_ALIASES[trimmed] ?? trimmed;
}

const INVALID_WEIGHING_UNITS = new Set([
  "0",
  "O",
  "o",
  "-",
  "—",
  "null",
  "undefined",
  "N/A",
  "n/a",
]);

/** กรองหน่วยที่ไม่ใช่หน่วยจริง (เช่น "0" หรือ "O" จากข้อมูลเก่าใน material / batch) */
export function isValidWeighingUnit(unit: string | null | undefined): boolean {
  const canonical = canonicalWeighingUnit(unit);
  if (!canonical) return false;
  if (INVALID_WEIGHING_UNITS.has(canonical)) return false;
  if (/^\d+(\.\d+)?$/.test(canonical)) return false;
  return true;
}
