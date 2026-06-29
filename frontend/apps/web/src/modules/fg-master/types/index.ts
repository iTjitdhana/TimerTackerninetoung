import type { ProductOutputConfig } from "@/modules/production-summary/services/production-summary.api"

export interface FgMasterListItem {
  fgCode: string
  fgName: string
  fgUnit: string
  fgSize: string
  conversionRate: number
  baseUnit: string | null
  conversionVerified: boolean
}

export interface FgMasterDetail extends FgMasterListItem {
  conversionDescription: string | null
  outputConfig: ProductOutputConfig
}

export interface FgMasterListResponse {
  items: FgMasterListItem[]
  total: number
}

export interface UpdateFgMasterPayload {
  fgUnit?: string
  fgSize?: string
  conversionRate?: number
  baseUnit?: string
  conversionDescription?: string | null
}
