import { apiClient } from "@/shared/api-client"
import type { ProductionTimerSession, TimerStep } from "../types"

export const productionTimerApi = {
  startSession(jobId: string, startedBy: string) {
    return apiClient.post<ProductionTimerSession>("/production-timer", {
      jobId,
      startedBy,
    })
  },
  updateSession(jobId: string, steps: TimerStep[], completedAt?: string) {
    return apiClient.patch<ProductionTimerSession>(`/production-timer/${jobId}`, {
      steps,
      completedAt,
    })
  },
  adminUpdateSession(jobId: string, steps: TimerStep[], completedAt?: string) {
    return apiClient.patch<ProductionTimerSession>(
      `/production-timer/${jobId}/admin-correction`,
      { steps, completedAt },
    )
  },
  getByJobId(jobId: string) {
    return apiClient.get<ProductionTimerSession>(`/production-timer/${jobId}`)
  },
  saveOperatorWeighing(
    jobId: string,
    materialCode: string,
    measuredWeight: string,
    weighedBy: string,
    unitPrice?: number,
  ) {
    return apiClient.patch<{
      jobId: string
      materialCode: string
      measuredWeight: string
      unit: string
    }>(`/production-timer/${jobId}/operator-weighing`, {
      materialCode,
      measuredWeight,
      weighedBy,
      ...(unitPrice != null ? { unitPrice } : {}),
    })
  },
}
