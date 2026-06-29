import { apiClient } from "@/shared/api-client"
import { linesFromApi, linesToApi } from "../mappers/ingredient.mapper"
import { normalizeLineUnits } from "../utils/weighing-unit-prefs"
import type { FormulaWeighingLine, IngredientApi, JobOperatorProfile, MaterialOption } from "../types"

export interface FormulaWeighingJobSetting {
  jobCode: string
  jobName: string
  requiresWeighing: boolean
}

export interface FormulaWeighingJobListItem {
  id: string
  jobCode: string
  productName: string
  scheduledDate: string
  startTime?: string | null
  endTime?: string | null
  status: string
  operators: JobOperatorProfile[]
  notes?: string | null
}

export interface FormulaWeighingRecord {
  jobId?: string
  jobCode?: string
  productName?: string
  batchCount?: number
  ingredients: FormulaWeighingLine[]
  verifiedAt?: string | null
  verifiedAtBangkok?: string
  hasFormula?: boolean
}

export type FormulaWeighingRecordApi = {
  jobId?: string
  jobCode?: string
  productName?: string
  batchCount?: number
  ingredients?: IngredientApi[]
  verifiedAt?: string | null
  verifiedAtBangkok?: string
  hasFormula?: boolean
}

/** แปลง payload จาก API/SSE ให้เป็นรูปแบบ UI (field names + defaults) */
export function normalizeFormulaWeighingRecord(
  data: FormulaWeighingRecordApi | FormulaWeighingRecord,
): FormulaWeighingRecord {
  const raw = data.ingredients ?? []
  const ingredients =
    raw.length > 0 && "code" in raw[0]
      ? linesFromApi(raw as IngredientApi[]).map(normalizeLineUnits)
      : (raw as FormulaWeighingLine[]).map(normalizeLineUnits)

  return {
    jobId: data.jobId,
    jobCode: data.jobCode,
    productName: data.productName,
    batchCount: data.batchCount ?? 1,
    ingredients,
    verifiedAt: data.verifiedAt,
    verifiedAtBangkok: data.verifiedAtBangkok,
    hasFormula: data.hasFormula,
  }
}

export const formulaWeighingApi = {
  getJobs(date: string, buId?: number) {
    const params = new URLSearchParams({ date })
    if (buId != null) params.set("bu_id", String(buId))
    return apiClient.get<FormulaWeighingJobListItem[]>(`/formula-weighing/jobs?${params.toString()}`)
  },
  getJobSettings() {
    return apiClient.get<FormulaWeighingJobSetting[]>("/formula-weighing/settings/jobs")
  },
  updateJobSettings(items: FormulaWeighingJobSetting[]) {
    return apiClient.put<FormulaWeighingJobSetting[]>("/formula-weighing/settings/jobs", { items })
  },
  getPopularUnits(limit = 30) {
    return apiClient.get<string[]>(`/formula-weighing/units?limit=${limit}`)
  },
  searchMaterials(search: string, limit = 30) {
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    params.set("limit", String(limit))
    return apiClient.get<MaterialOption[]>(`/formula-weighing/materials?${params.toString()}`)
  },
  saveRecord(jobId: string, weighedBy: string, lines: FormulaWeighingLine[], batchCount = 1) {
    return apiClient.post("/formula-weighing", {
      jobId,
      weighedBy,
      batchCount,
      ingredients: linesToApi(lines),
    })
  },
  removeManualIngredient(jobId: string, productCode: string) {
    return apiClient.delete(
      `/formula-weighing/${jobId}/ingredients/${encodeURIComponent(productCode)}`,
    )
  },
  verify(jobId: string, verifiedBy: string) {
    return apiClient.post(`/formula-weighing/${jobId}/verify`, { verifiedBy })
  },
  async getByJobId(jobId: string): Promise<FormulaWeighingRecord> {
    const data = await apiClient.get<FormulaWeighingRecordApi>(
      `/formula-weighing/${jobId}`,
    )
    return normalizeFormulaWeighingRecord(data)
  },
}
