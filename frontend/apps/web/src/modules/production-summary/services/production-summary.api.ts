import { apiClient } from "@/shared/api-client"

export interface OutputUnitOption {
  unit: string
  conversionRate: number
}

export interface OutputVariant {
  label: string
  unit: string
  conversionRate: number
  packSize?: string | null
}

export type ConversionSource =
  | "fg_size"
  | "master"
  | "description"
  | "default"

export interface ProductOutputConfig {
  defaultOutputUnit: string
  baseUnit: string
  packSize: string | null
  unitOptions: OutputUnitOption[]
  outputVariants: OutputVariant[]
  masterUnit: string
  /** @deprecated use masterUnit */
  outputUnit: string
  conversionRate: number
  conversionVerified: boolean
  conversionWarnings: string[]
  conversionInfos: string[]
  conversionSource: ConversionSource
  fgCode: string | null
}

export interface InputMaterialConversion {
  materialCode: string | null
  fromUnit: string
  conversionRate: number
}

export interface CostPreview {
  inputMaterialQty: number
  inputMaterialUnit: string
  inputUnitConversions?: InputMaterialConversion[]
  materialCost: number
  timeUsedMinutes: number
  operatorsCount: number
  standardWorkMinutes: number
  dailyWagePerPerson: number | null
  calculatedLaborCost: number | null
}

export type OutputLineKind = "sellable" | "scrap"

export interface ProductionOutputLineInput {
  kind: OutputLineKind
  label: string
  qty: number
  unit: string
  conversionRate: number
}

export interface ProductionOutputLine extends ProductionOutputLineInput {
  weightKg: number
}

export interface OutputLineCost {
  label: string
  unit: string
  qty: number
  weightKg: number
  lineTotalCost: number
  costPerUnit: number | null
}

export interface MultiOutputCostBreakdown {
  totalCost: number
  sellableKg: number
  scrapKg: number
  costPerSellableKg: number | null
  sellableLineCosts: OutputLineCost[]
  scrapCost: number
}

/** Phase 2: per-operator daily wage and minutes */
export interface LaborOperatorEntry {
  name: string
  dailyWage: number
  minutesWorked: number
}

export const DEFAULT_STANDARD_WORK_MINUTES = 8 * 60 + 15

export { formatMinutesAsThaiDuration } from "@/shared/lib/duration-format"

export interface ProductionBalance {
  totalInput: number
  weightKg: number
  scrap: number
}

export interface SavedOutputSnapshot {
  conversionVerified: boolean
  conversionWarnings: string[]
  conversionInfos: string[]
  masterUnit: string
  baseUnit: string
  fgCode: string | null
  outputVariants: OutputVariant[]
}

export interface ProductionSummaryContext {
  jobId: string
  batchId: number | null
  summary: {
    good_qty: string | number
    good_secondary_qty: string | number | null
    good_secondary_unit: string | null
    defect_qty: string | number
    outputLines?: ProductionOutputLine[] | null
  } | null
  outputConfig: ProductOutputConfig
  savedOutputSnapshot: SavedOutputSnapshot | null
  costPreview: CostPreview | null
}

export const DEFAULT_FORM_OUTPUT_UNIT = "กก."

export const DEFAULT_OUTPUT_CONFIG: ProductOutputConfig = {
  defaultOutputUnit: DEFAULT_FORM_OUTPUT_UNIT,
  baseUnit: "กก.",
  packSize: null,
  unitOptions: [{ unit: "กก.", conversionRate: 1 }],
  outputVariants: [
    {
      label: "กก.",
      unit: "กก.",
      conversionRate: 1,
      packSize: null,
    },
  ],
  masterUnit: "กก.",
  outputUnit: "กก.",
  conversionRate: 1,
  conversionVerified: true,
  conversionWarnings: [],
  conversionInfos: [],
  conversionSource: "default",
  fgCode: null,
}

function normalizeVariant(candidate: unknown): OutputVariant | null {
  if (!candidate || typeof candidate !== "object") return null

  const record = candidate as Record<string, unknown>
  const unit = String(record.unit ?? "").trim()
  const label = String(record.label ?? unit).trim()
  const conversionRate = Number(record.conversionRate)

  if (!label || !unit || !Number.isFinite(conversionRate) || conversionRate <= 0) {
    return null
  }

  return {
    label,
    unit,
    conversionRate,
    packSize:
      typeof record.packSize === "string" && record.packSize.trim()
        ? record.packSize.trim()
        : null,
  }
}

export function parseOutputVariantsFromDescription(
  conversionDescription: string | null | undefined,
): OutputVariant[] | null {
  if (!conversionDescription?.trim()) return null

  try {
    const parsed = JSON.parse(conversionDescription) as unknown
    if (!Array.isArray(parsed)) return null

    const variants = parsed
      .map(normalizeVariant)
      .filter((variant): variant is OutputVariant => variant != null)

    return variants.length > 0 ? variants : null
  } catch {
    return null
  }
}

function buildDefaultOutputVariants(
  config?: Partial<ProductOutputConfig> | null,
): OutputVariant[] {
  const masterUnit =
    config?.masterUnit?.trim() ||
    config?.outputUnit?.trim() ||
    DEFAULT_OUTPUT_CONFIG.masterUnit
  const conversionRate = Number(config?.conversionRate)

  return [
    {
      label: config?.packSize?.trim() || masterUnit,
      unit: masterUnit,
      conversionRate:
        Number.isFinite(conversionRate) && conversionRate > 0 ? conversionRate : 1,
      packSize: config?.packSize ?? null,
    },
  ]
}

export function buildUnitOptionsFromPartial(
  config?: Partial<ProductOutputConfig> | null,
): OutputUnitOption[] {
  const options: OutputUnitOption[] = [{ unit: "กก.", conversionRate: 1 }]
  const seen = new Set(["กก."])

  const addOption = (unit?: string | null, rate?: number) => {
    const trimmed = unit?.trim()
    if (!trimmed || seen.has(trimmed) || isKgUnit(trimmed)) return
    const conversionRate =
      Number.isFinite(Number(rate)) && Number(rate) > 0 ? Number(rate) : 1
    options.push({ unit: trimmed, conversionRate })
    seen.add(trimmed)
  }

  for (const variant of config?.outputVariants ?? []) {
    addOption(variant.unit, variant.conversionRate)
  }

  for (const option of config?.unitOptions ?? []) {
    addOption(option.unit, option.conversionRate)
  }

  addOption(config?.masterUnit || config?.outputUnit, config?.conversionRate)

  return options
}

export function resolveDefaultOutputUnit(
  config: ProductOutputConfig,
): string {
  if (!isKgUnit(config.masterUnit)) return config.masterUnit
  return config.defaultOutputUnit || DEFAULT_FORM_OUTPUT_UNIT
}

export function normalizeOutputConfig(
  config?: Partial<ProductOutputConfig> | null,
): ProductOutputConfig {
  const unitOptions = buildUnitOptionsFromPartial(config)
  const conversionRate = Number(config?.conversionRate)
  const outputVariants =
    config?.outputVariants && config.outputVariants.length > 0
      ? config.outputVariants
      : buildDefaultOutputVariants(config)
  const primaryVariant = outputVariants[0]

  const masterUnit =
    config?.masterUnit?.trim() ||
    config?.outputUnit?.trim() ||
    DEFAULT_OUTPUT_CONFIG.masterUnit

  const normalized: ProductOutputConfig = {
    defaultOutputUnit:
      config?.defaultOutputUnit?.trim() || DEFAULT_FORM_OUTPUT_UNIT,
    baseUnit: config?.baseUnit?.trim() || DEFAULT_OUTPUT_CONFIG.baseUnit,
    packSize: primaryVariant?.packSize ?? config?.packSize ?? null,
    unitOptions,
    outputVariants,
    masterUnit,
    outputUnit:
      config?.outputUnit?.trim() ||
      config?.masterUnit?.trim() ||
      DEFAULT_OUTPUT_CONFIG.outputUnit,
    conversionRate:
      Number.isFinite(conversionRate) && conversionRate > 0 ? conversionRate : 1,
    conversionVerified: config?.conversionVerified ?? true,
    conversionWarnings: config?.conversionWarnings ?? [],
    conversionInfos: config?.conversionInfos ?? [],
    conversionSource: config?.conversionSource ?? "default",
    fgCode: config?.fgCode ?? null,
  }

  return {
    ...normalized,
    defaultOutputUnit: resolveDefaultOutputUnit(normalized),
  }
}

export function normalizeSavedOutputSnapshot(
  snapshot?: Partial<SavedOutputSnapshot> | null,
): SavedOutputSnapshot | null {
  if (!snapshot) return null

  const variants = Array.isArray(snapshot.outputVariants)
    ? snapshot.outputVariants
        .map((variant) => normalizeVariant(variant))
        .filter((variant): variant is OutputVariant => variant != null)
    : []

  if (variants.length === 0) return null

  return {
    conversionVerified: snapshot.conversionVerified === true,
    conversionWarnings: Array.isArray(snapshot.conversionWarnings)
      ? snapshot.conversionWarnings.map(String)
      : [],
    conversionInfos: Array.isArray(snapshot.conversionInfos)
      ? snapshot.conversionInfos.map(String)
      : [],
    masterUnit: snapshot.masterUnit?.trim() || variants[0]?.unit || "",
    baseUnit: snapshot.baseUnit?.trim() || "กก.",
    fgCode:
      typeof snapshot.fgCode === "string" && snapshot.fgCode.trim()
        ? snapshot.fgCode.trim()
        : null,
    outputVariants: variants,
  }
}

const KG_UNITS = new Set(["กก.", "kg", "KG", "กิโลกรัม"])

export function isKgUnit(unit: string | null | undefined): boolean {
  if (!unit) return false
  const trimmed = unit.trim()
  return KG_UNITS.has(trimmed) || trimmed.toLowerCase() === "kg"
}

export function resolveConversionRateForUnit(
  unit: string,
  unitOptions: OutputUnitOption[],
): number {
  if (isKgUnit(unit)) return 1
  const match = unitOptions.find((option) => option.unit === unit)
  return match?.conversionRate ?? 1
}

export function lineWeightKg(
  qty: number,
  unit: string,
  conversionRate: number,
): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0
  if (isKgUnit(unit)) return qty
  const rate =
    Number.isFinite(conversionRate) && conversionRate > 0 ? conversionRate : 1
  return qty * rate
}

export function normalizeOutputLine(
  input: ProductionOutputLineInput,
): ProductionOutputLine {
  const conversionRate =
    input.kind === "scrap" && isKgUnit(input.unit)
      ? 1
      : Number.isFinite(input.conversionRate) && input.conversionRate > 0
        ? input.conversionRate
        : 1

  return {
    ...input,
    conversionRate,
    weightKg: lineWeightKg(input.qty, input.unit, conversionRate),
  }
}

export function aggregateOutputLines(lines: ProductionOutputLineInput[]) {
  const normalized = lines.map(normalizeOutputLine)
  const sellableLines = normalized.filter((line) => line.kind === "sellable")
  const scrapLines = normalized.filter((line) => line.kind === "scrap")
  const sellableKg = sellableLines.reduce((sum, line) => sum + line.weightKg, 0)
  const scrapKg = scrapLines.reduce((sum, line) => sum + line.weightKg, 0)

  return {
    sellableLines,
    scrapLine: scrapLines[0] ?? null,
    sellableKg,
    scrapKg,
    totalOutputKg: sellableKg + scrapKg,
  }
}

export function buildOutputLinesFromFormState(params: {
  variants: OutputVariant[]
  sellableQtys: Record<string, string>
  scrapQty: string
  scrapTouched: boolean
  inputMaterialKg: number
  resolveSellableQtyKey?: (variant: OutputVariant, index: number) => string
}): ProductionOutputLineInput[] {
  const lines: ProductionOutputLineInput[] = []

  for (const [index, variant] of params.variants.entries()) {
    const key =
      params.resolveSellableQtyKey?.(variant, index) ??
      `${variant.label}-${variant.unit}-${index}`
    const qty = parseFloat(params.sellableQtys[key] || "") || 0
    if (qty <= 0) continue

    lines.push({
      kind: "sellable",
      label: variant.label,
      qty,
      unit: variant.unit,
      conversionRate: isKgUnit(variant.unit) ? 1 : variant.conversionRate,
    })
  }

  const aggregated = aggregateOutputLines(lines)
  const scrapKg = params.scrapTouched
    ? parseFloat(params.scrapQty) || 0
    : Math.max(0, params.inputMaterialKg - aggregated.sellableKg)

  if (scrapKg > 0) {
    lines.push({
      kind: "scrap",
      label: "เศษ",
      qty: scrapKg,
      unit: "กก.",
      conversionRate: 1,
    })
  }

  return lines
}

export function calculateMultiOutputCostBreakdown(
  totalCost: number,
  lines: ProductionOutputLineInput[],
): MultiOutputCostBreakdown {
  const aggregated = aggregateOutputLines(lines)
  const { sellableKg, scrapKg, sellableLines } = aggregated

  if (totalCost <= 0 || sellableKg <= 0) {
    return {
      totalCost,
      sellableKg,
      scrapKg,
      costPerSellableKg: null,
      sellableLineCosts: [],
      scrapCost: 0,
    }
  }

  const costPerSellableKg = totalCost / sellableKg
  const sellableLineCosts = sellableLines.map((line) => {
    const lineTotalCost = costPerSellableKg * line.weightKg
    return {
      label: line.label,
      unit: line.unit,
      qty: line.qty,
      weightKg: line.weightKg,
      lineTotalCost,
      costPerUnit: line.qty > 0 ? lineTotalCost / line.qty : null,
    }
  })
  const scrapCost = costPerSellableKg * scrapKg

  return {
    totalCost,
    sellableKg,
    scrapKg,
    costPerSellableKg,
    sellableLineCosts,
    scrapCost,
  }
}

export function convertOutputToKg(
  qty: number,
  conversionRate: number | null | undefined,
  outputUnit: string,
  baseUnit: string,
): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0
  if (isKgUnit(outputUnit) && isKgUnit(baseUnit)) return qty
  const rate = Number(conversionRate)
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1
  return qty * safeRate
}

export function convertSelectedOutputToKg(
  qty: number,
  selectedUnit: string,
  config: ProductOutputConfig,
): number {
  const rate = resolveConversionRateForUnit(selectedUnit, config.unitOptions)
  return convertOutputToKg(qty, rate, selectedUnit, config.baseUnit)
}

export function calculateProductionBalance(
  inputMaterialKg: number,
  weightKg: number,
  scrapKg?: number,
): ProductionBalance {
  const scrap = scrapKg ?? Math.max(0, inputMaterialKg - weightKg)
  return {
    totalInput: inputMaterialKg,
    weightKg,
    scrap,
  }
}

export function calculateYieldPercent(
  inputMaterialKg: number,
  weightKg: number,
  scrapKg: number,
): number | null {
  if (inputMaterialKg <= 0) return null
  return ((weightKg + scrapKg) / inputMaterialKg) * 100
}

export function calculateInputKgFromIngredients(
  ingredients: Array<{
    measuredWeight: string
    unit: string
    code?: string | null
  }>,
  unitConversions: InputMaterialConversion[] = [],
): number {
  const lookup = new Map<string, number>()
  for (const row of unitConversions) {
    lookup.set(
      `${row.materialCode?.trim() || "*"}|${row.fromUnit.trim()}`,
      row.conversionRate,
    )
  }

  return ingredients.reduce((sum, ing) => {
    const qty = parseFloat(ing.measuredWeight) || 0
    if (qty <= 0) return sum

    const unit = ing.unit.trim()
    if (isKgUnit(unit)) return sum + qty

    const gramUnits = new Set(["กรัม", "ก.", "g", "G"])
    if (gramUnits.has(unit)) return sum + qty / 1000

    const specific = lookup.get(`${ing.code?.trim() || "*"}|${unit}`)
    if (specific != null && specific > 0) return sum + qty * specific

    const generic = lookup.get(`*|${unit}`)
    if (generic != null && generic > 0) return sum + qty * generic

    return sum
  }, 0)
}

export function calculateHourlyRateFromDailyWage(
  dailyWagePerPerson: number,
  standardWorkMinutes: number = DEFAULT_STANDARD_WORK_MINUTES,
): number {
  if (
    !Number.isFinite(dailyWagePerPerson) ||
    dailyWagePerPerson <= 0 ||
    standardWorkMinutes <= 0
  ) {
    return 0
  }

  return (dailyWagePerPerson * 60) / standardWorkMinutes
}

export function calculateLaborCostFromDailyWage(
  dailyWagePerPerson: number,
  operatorsCount: number,
  jobMinutes: number,
  standardWorkMinutes: number = DEFAULT_STANDARD_WORK_MINUTES,
): number {
  if (
    !Number.isFinite(dailyWagePerPerson) ||
    dailyWagePerPerson <= 0 ||
    standardWorkMinutes <= 0
  ) {
    return 0
  }

  const operators = operatorsCount > 0 ? operatorsCount : 1
  const time = jobMinutes > 0 ? jobMinutes : 0

  if (time <= 0) {
    return 0
  }

  return operators * dailyWagePerPerson * (time / standardWorkMinutes)
}

export const productionSummaryApi = {
  create(data: {
    jobId: string
    outputQty: number
    outputUnit?: string
    scrapQty?: number
    outputLines?: ProductionOutputLineInput[]
    dailyWagePerPerson: number
  }) {
    return apiClient.post("/production-summary", data)
  },
  async getByJobId(jobId: string): Promise<ProductionSummaryContext> {
    const data = await apiClient.get<Partial<ProductionSummaryContext>>(
      `/production-summary/${jobId}`,
    )

    return {
      jobId: data.jobId ?? jobId,
      batchId: data.batchId ?? null,
      summary: data.summary ?? null,
      outputConfig: normalizeOutputConfig(data.outputConfig),
      savedOutputSnapshot: normalizeSavedOutputSnapshot(data.savedOutputSnapshot),
      costPreview: data.costPreview ?? null,
    }
  },
}

/** @deprecated Use calculateProductionBalance */
export function calculateMaterialBalance(
  ingredients: Array<{ name: string; measuredWeight: string; unit: string }>,
  producedWeight: number,
) {
  const totalInput = calculateInputKgFromIngredients(ingredients)
  const balance = calculateProductionBalance(totalInput, producedWeight)
  return {
    totalInput: balance.totalInput,
    producedWeight: balance.weightKg,
    waste: balance.scrap,
    scrap: balance.scrap,
    weightKg: balance.weightKg,
    ingredients: ingredients.map((ing) => ({
      name: ing.name,
      input: parseFloat(ing.measuredWeight) || 0,
      unit: ing.unit,
    })),
  }
}
