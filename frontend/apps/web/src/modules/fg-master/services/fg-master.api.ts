import { apiClient } from "@/shared/api-client"
import type {
  FgMasterDetail,
  FgMasterListItem,
  FgMasterListResponse,
  UpdateFgMasterPayload,
} from "../types"

export type { FgMasterDetail, FgMasterListItem } from "../types"

export const fgMasterApi = {
  list(q?: string, limit = 50) {
    const params = new URLSearchParams()
    if (q?.trim()) params.set("q", q.trim())
    params.set("limit", String(limit))
    const query = params.toString()
    return apiClient.get<FgMasterListResponse>(
      `/fg-master${query ? `?${query}` : ""}`,
    )
  },

  getByCode(fgCode: string) {
    return apiClient.get<FgMasterDetail>(
      `/fg-master/${encodeURIComponent(fgCode)}`,
    )
  },

  update(fgCode: string, payload: UpdateFgMasterPayload) {
    return apiClient.patch<FgMasterDetail>(
      `/fg-master/${encodeURIComponent(fgCode)}`,
      payload,
    )
  },
}
