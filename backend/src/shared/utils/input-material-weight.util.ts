import { isKgUnit } from "./output-quantity.util";

export interface UnitConversionRow {
  from_unit: string;
  to_unit: string;
  conversion_rate: number;
  material_code?: string | null;
}

const GRAM_UNITS = new Set(["กรัม", "ก.", "g", "G", "gram", "grams"]);

export function conversionLookupKey(
  materialCode: string | null | undefined,
  fromUnit: string,
): string {
  const code = materialCode?.trim() || "*";
  return `${code}|${fromUnit.trim()}`;
}

export function buildUnitConversionLookup(
  rows: UnitConversionRow[],
): Map<string, number> {
  const map = new Map<string, number>();

  for (const row of rows) {
    if (row.to_unit.trim() !== "กก.") continue;
    if (!Number.isFinite(row.conversion_rate) || row.conversion_rate <= 0) {
      continue;
    }

    map.set(
      conversionLookupKey(row.material_code, row.from_unit),
      row.conversion_rate,
    );
  }

  return map;
}

export function resolveConversionRateToKg(
  unit: string,
  materialCode: string | null | undefined,
  lookup: Map<string, number>,
): number | null {
  const trimmedUnit = unit.trim();
  if (isKgUnit(trimmedUnit)) return 1;
  if (GRAM_UNITS.has(trimmedUnit)) return 0.001;

  const specific = lookup.get(conversionLookupKey(materialCode, trimmedUnit));
  if (specific != null && specific > 0) return specific;

  const generic = lookup.get(conversionLookupKey(null, trimmedUnit));
  if (generic != null && generic > 0) return generic;

  return null;
}

export function convertQtyToKg(
  qty: number,
  unit: string,
  materialCode: string | null | undefined,
  lookup: Map<string, number>,
): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;

  const rate = resolveConversionRateToKg(unit, materialCode, lookup);
  if (rate == null) return 0;

  return qty * rate;
}

export function sumInputMaterialKg(
  rows: Array<{ qty: number; unit: string; materialCode?: string | null }>,
  lookup: Map<string, number>,
): number {
  return rows.reduce(
    (sum, row) =>
      sum + convertQtyToKg(row.qty, row.unit, row.materialCode, lookup),
    0,
  );
}
