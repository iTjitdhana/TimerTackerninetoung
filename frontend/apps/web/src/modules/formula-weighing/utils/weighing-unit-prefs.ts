import {
  DEFAULT_WEIGHING_UNITS,
  WEIGHING_UNIT_ALIASES,
  WEIGHING_UNIT_USAGE_STORAGE_KEY,
} from "../constants/weighing-units"
import type { FormulaWeighingLine } from "../types"

export type UnitUsageCounts = Record<string, number>

const INVALID_WEIGHING_UNITS = new Set(["0", "O", "o", "-", "—", "null", "undefined", "N/A", "n/a"])

export function canonicalWeighingUnit(unit: string | null | undefined): string {
  const trimmed = unit?.trim() ?? ""
  if (!trimmed) return ""
  return WEIGHING_UNIT_ALIASES[trimmed] ?? trimmed
}

/** กรองหน่วยที่ไม่ใช่หน่วยจริง (เช่น "0" หรือ "O" จากข้อมูลเก่าใน DB) */
export function isValidWeighingUnit(unit: string | null | undefined): boolean {
  const canonical = canonicalWeighingUnit(unit)
  if (!canonical) return false
  if (INVALID_WEIGHING_UNITS.has(canonical)) return false
  if (/^\d+(\.\d+)?$/.test(canonical)) return false
  return true
}

export function getUnitUsageCounts(): UnitUsageCounts {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(WEIGHING_UNIT_USAGE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as UnitUsageCounts
    if (typeof parsed !== "object" || parsed === null) return {}
    const merged: UnitUsageCounts = {}
    for (const [unit, count] of Object.entries(parsed)) {
      const canonical = canonicalWeighingUnit(unit)
      if (!isValidWeighingUnit(canonical)) continue
      merged[canonical] = (merged[canonical] ?? 0) + count
    }
    return merged
  } catch {
    return {}
  }
}

/** หน่วยคอลัมน์「จำนวน」(สูตร BOM) */
export function getPlannedUnitFromLine(line: Pick<FormulaWeighingLine, "plannedUnit">): string {
  const fromBom = canonicalWeighingUnit(line.plannedUnit)
  if (isValidWeighingUnit(fromBom)) return fromBom
  return ""
}

/** หน่วยคอลัมน์「จำนวนเบิก」 */
export function getWithdrawnUnitFromLine(
  line: Pick<FormulaWeighingLine, "withdrawnUnit" | "plannedUnit">,
): string {
  const saved = canonicalWeighingUnit(line.withdrawnUnit)
  if (isValidWeighingUnit(saved)) return saved
  return getPlannedUnitFromLine(line)
}

export function normalizeLineUnits<T extends FormulaWeighingLine>(line: T): T {
  const plannedUnit = getPlannedUnitFromLine(line)
  const withdrawnUnit = getWithdrawnUnitFromLine({ ...line, plannedUnit })
  return { ...line, plannedUnit, withdrawnUnit }
}

export function recordUnitUsage(unit: string) {
  const canonical = canonicalWeighingUnit(unit)
  if (!isValidWeighingUnit(canonical) || typeof window === "undefined") return

  const counts = getUnitUsageCounts()
  counts[canonical] = (counts[canonical] ?? 0) + 1
  localStorage.setItem(WEIGHING_UNIT_USAGE_STORAGE_KEY, JSON.stringify(counts))
}

export function buildSortedWeighingUnits(options: {
  serverPopular?: string[]
  usageCounts?: UnitUsageCounts
  extraUnits?: string[]
  currentUnit?: string
}): string[] {
  const serverPopular = options.serverPopular ?? []
  const usageCounts = options.usageCounts ?? {}
  const extraUnits = options.extraUnits ?? []
  const currentUnit = canonicalWeighingUnit(options.currentUnit)

  const candidates = new Set<string>()
  for (const unit of DEFAULT_WEIGHING_UNITS) candidates.add(unit)
  for (const unit of serverPopular) {
    const canonical = canonicalWeighingUnit(unit)
    if (isValidWeighingUnit(canonical)) candidates.add(canonical)
  }
  for (const unit of extraUnits) {
    const canonical = canonicalWeighingUnit(unit)
    if (isValidWeighingUnit(canonical)) candidates.add(canonical)
  }
  if (isValidWeighingUnit(currentUnit)) candidates.add(currentUnit)

  const defaultIndex = new Map<string, number>(
    DEFAULT_WEIGHING_UNITS.map((unit, index) => [unit, index]),
  )
  const serverIndex = new Map(
    serverPopular
      .map((unit) => unit.trim())
      .filter(isValidWeighingUnit)
      .map((unit, index) => [unit, index]),
  )

  return [...candidates].sort((a, b) => {
    const score = (unit: string) => {
      let value = 0
      if (unit === currentUnit) value += 1000
      value += (usageCounts[unit] ?? 0) * 10
      const serverRank = serverIndex.get(unit)
      if (serverRank !== undefined) value += (serverPopular.length - serverRank) * 3
      const defaultRank = defaultIndex.get(unit)
      if (defaultRank !== undefined) value += DEFAULT_WEIGHING_UNITS.length - defaultRank
      return value
    }
    return score(b) - score(a) || a.localeCompare(b, "th")
  })
}
