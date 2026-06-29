import { apiClient } from "@/shared/api-client"
import type { AuthSession, AuthSessionData } from "@/shared/lib/permissions.constants"
import type { ProductionJob } from "@/modules/formula-weighing/types"

export interface BusinessUnit {
  id: number
  code: string
  name: string
}

function buildJobsQuery(date?: string, buId?: number) {
  const params = new URLSearchParams()
  if (date) params.set("date", date)
  if (buId != null) params.set("bu_id", String(buId))
  const query = params.toString()
  return query ? `?${query}` : ""
}

export const businessUnitsApi = {
  list() {
    return apiClient.get<BusinessUnit[]>("/business-units")
  },
}

export const jobsApi = {
  getJobs(date?: string, buId?: number) {
    return apiClient.get<ProductionJob[]>(`/jobs${buildJobsQuery(date, buId)}`)
  },
  getJob(id: string) {
    return apiClient.get<ProductionJob>(`/jobs/${id}`)
  },
}

export const workplanApi = {
  getJobs(date?: string, buId?: number) {
    return apiClient.get(`/workplan/jobs${buildJobsQuery(date, buId)}`)
  },
}

export const authApi = {
  verifyPin(pin: string) {
    return apiClient.post<AuthSession>("/auth/verify-pin", { pin })
  },
  registerPin(newPin: string) {
    return apiClient.post<AuthSession>("/auth/register-pin", { newPin })
  },
  me() {
    return apiClient.get<AuthSessionData>("/auth/me")
  },
  changePin(currentPin: string, newPin: string) {
    return apiClient.patch<AuthSession>("/auth/change-pin", { currentPin, newPin })
  },
  uploadProfileAvatar(imageData: string, contentType: string) {
    return apiClient.post<AuthSessionData>("/auth/profile-avatar", {
      imageData,
      contentType,
    })
  },
}
