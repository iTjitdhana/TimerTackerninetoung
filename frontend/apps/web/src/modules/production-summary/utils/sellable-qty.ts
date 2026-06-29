import type {
  OutputVariant,
  ProductionOutputLineInput,
} from "../services/production-summary.api"

export function variantKey(variant: OutputVariant, index: number): string {
  return `${variant.label}-${variant.unit}-${index}`
}

export function sellableQtyKey(
  variant: OutputVariant,
  index: number,
  adminMode: boolean,
): string {
  return adminMode ? `admin-sellable-${index}` : variantKey(variant, index)
}

function findVariantIndexForLine(
  variants: OutputVariant[],
  line: ProductionOutputLineInput,
): number {
  const exactIndex = variants.findIndex(
    (variant) =>
      variant.label === line.label &&
      variant.unit === line.unit &&
      variant.conversionRate === line.conversionRate,
  )
  if (exactIndex >= 0) return exactIndex

  const labelUnitIndex = variants.findIndex(
    (variant) => variant.label === line.label && variant.unit === line.unit,
  )
  if (labelUnitIndex >= 0) return labelUnitIndex

  const unitIndex = variants.findIndex((variant) => variant.unit === line.unit)
  if (unitIndex >= 0) return unitIndex

  return 0
}

export function buildInitialSellableQtys(
  variants: OutputVariant[],
  outputLines?: Array<ProductionOutputLineInput & { weightKg?: number }> | null,
): Record<string, string> {
  const initial: Record<string, string> = {}
  for (const [index, variant] of variants.entries()) {
    initial[variantKey(variant, index)] = ""
  }

  if (!outputLines?.length) return initial

  for (const line of outputLines) {
    if (line.kind !== "sellable") continue
    const index = findVariantIndexForLine(variants, line)
    const key = variantKey(variants[index] ?? variants[0]!, index)
    initial[key] = String(line.qty || "")
  }

  return initial
}
