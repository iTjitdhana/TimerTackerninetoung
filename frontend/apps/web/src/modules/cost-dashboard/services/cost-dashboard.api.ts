import { apiClient } from "@/shared/api-client"

export interface ProductionDataCompleteness {
  percent: number
  hasMaterialWeighing: boolean
  hasTimerData: boolean
  hasOutputQty: boolean
}

export interface CostDashboardItem {
  id: string
  jobId: string | null
  jobCode: string
  jobName: string
  productionDate: string
  materialCost: number | null
  totalCost: number | null
  outputQty: number | null
  outputUnit: string | null
  yieldPercent: number | null
  timeUsedMinutes: number | null
  operators: string[]
  timerStatus: "ok" | "warn" | "no_data"
  dataCompleteness: ProductionDataCompleteness
}

export interface CompletenessGroup {
  percent: number
  count: number
  ratio: number
}

export interface JobCategoryBreakdown {
  production: number
  repack: number
  vegetable: number
  requisition: number
  formula: number
  other: number
}

export type JobCategory = keyof JobCategoryBreakdown

export interface CompletenessPatternGroup {
  pattern: string
  hasPrice: boolean
  hasTimer: boolean
  hasOutput: boolean
  count: number
  ratio: number
}

export interface CompletenessSummary {
  total: number
  productionCount: number
  byCategory: JobCategoryBreakdown
  dateFrom: string
  dateTo: string
  groupsByPattern: CompletenessPatternGroup[]
  byField: {
    hasMaterialPriced: number
    hasTimerData: number
    hasOutputQty: number
    hasVerifiedConversion: number
  }
  unverifiedConversionCount: number
}

export interface NonProductionPreviewItem {
  id: number
  jobCode: string
  jobName: string | null
  productionDate: string
  category: JobCategory
}

export interface ProductionPatternPreviewItem {
  id: number
  jobCode: string
  jobName: string | null
  productionDate: string
  pattern: string
  hasPrice: boolean
  hasTimer: boolean
  hasOutput: boolean
}

export interface UnverifiedConversionPreviewItem {
  jobId: number
  jobCode: string
  jobName: string | null
  productionDate: string
  fgCode: string | null
  conversionWarnings: string[]
}

export const costDashboardApi = {
  getDaily(date: string) {
    return apiClient.get<CostDashboardItem[]>(`/cost-dashboard/daily?date=${date}`)
  },
  search(q: string) {
    const params = new URLSearchParams({ q })
    return apiClient.get<CostDashboardItem[]>(`/cost-dashboard/search?${params}`)
  },
  getCompletenessSummary(from: string, to: string) {
    const params = new URLSearchParams({ from, to })
    return apiClient.get<CompletenessSummary>(`/cost-dashboard/completeness-summary?${params}`)
  },
  getNonProductionPreview(from: string, to: string) {
    const params = new URLSearchParams({ from, to, limit: "200" })
    return apiClient.get<NonProductionPreviewItem[]>(`/cost-dashboard/non-production-preview?${params}`)
  },
  getProductionPatternPreview(from: string, to: string, pattern: string) {
    const params = new URLSearchParams({ from, to, pattern, limit: "200" })
    return apiClient.get<ProductionPatternPreviewItem[]>(`/cost-dashboard/completeness-pattern-preview?${params}`)
  },
  getUnverifiedConversionPreview(from: string, to: string) {
    const params = new URLSearchParams({ from, to, limit: "200" })
    return apiClient.get<UnverifiedConversionPreviewItem[]>(
      `/cost-dashboard/unverified-conversion?${params}`,
    )
  },
}
