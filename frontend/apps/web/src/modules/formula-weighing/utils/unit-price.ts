const UNIT_PRICE_DECIMALS = 2

export function roundUnitPrice(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined
  const factor = 10 ** UNIT_PRICE_DECIMALS
  return Math.round(value * factor) / factor
}

export function formatUnitPriceDisplay(value: number | undefined): string {
  const rounded = roundUnitPrice(value)
  if (rounded == null) return "—"
  return rounded.toLocaleString("th-TH", {
    minimumFractionDigits: UNIT_PRICE_DECIMALS,
    maximumFractionDigits: UNIT_PRICE_DECIMALS,
  })
}

export function formatUnitPriceInput(value: number | undefined): string {
  const rounded = roundUnitPrice(value)
  if (rounded == null) return ""
  return rounded.toFixed(UNIT_PRICE_DECIMALS)
}

/** จำกัดทศนิยมขณะพิมพ์ (สูงสุด 2 ตำแหน่ง) */
export function limitUnitPriceInput(raw: string): string {
  const normalized = raw.replace(/,/g, "")
  const parts = normalized.split(".")
  if (parts.length <= 1) return normalized
  return `${parts[0]}.${parts.slice(1).join("").slice(0, UNIT_PRICE_DECIMALS)}`
}
