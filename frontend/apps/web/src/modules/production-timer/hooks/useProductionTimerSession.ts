"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { formulaWeighingApi } from "@/modules/formula-weighing/services/formula-weighing.api"
import { ApiError, openSseConnection } from "@/shared/api-client"
import { getAuthUserName } from "@/shared/lib/auth"
import { toast } from "@/shared/hooks/use-toast"
import { productionTimerApi } from "../services/production-timer.api"
import type {
  ProductionStep,
  ProductionTimerSession,
  StepRecord,
  TimerIngredient,
  TimerStep,
} from "../types"
import { mapIngredients } from "../utils/map-ingredients"
import { buildStepsPayload, recordsToTimerSteps } from "../utils/step-payload"
import {
  canCompleteStep,
  canSelectStep,
  canStartStep,
  getActiveStepIndex,
} from "../utils/step-navigation"
import {
  formatClockHms,
  formatDurationWithSeconds,
  isStepInProgress,
  mapApiStepToRecord,
  parseClockToBangkokDate,
} from "../utils/time"

function mapStepsFromSession(session: ProductionTimerSession): {
  productionSteps: ProductionStep[]
  stepRecords: StepRecord[]
} {
  const productionSteps = session.steps.map((step, index) => ({
    id: index + 1,
    name: step.stepName,
  }))
  const stepRecords = session.steps.map(mapApiStepToRecord)
  return { productionSteps, stepRecords }
}

type ApplySessionOptions = {
  /** Initial page load — focus first incomplete step */
  initialLoad?: boolean
  /** Keep UI on this step after save (e.g. parallel steps) */
  focusStepIndex?: number
  stepStartTime?: Date | null
}

function parseApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError) || !error.message) {
    return fallback
  }

  try {
    const parsed = JSON.parse(error.message) as { message?: string }
    if (typeof parsed.message === "string" && parsed.message.length > 0) {
      return parsed.message
    }
  } catch {
    // plain-text API message
  }

  return error.message
}

export function useProductionTimerSession(jobId: string) {
  const [session, setSession] = useState<ProductionTimerSession | null>(null)
  const [productionSteps, setProductionSteps] = useState<ProductionStep[]>([])
  const [allStepRecords, setAllStepRecords] = useState<StepRecord[]>([])
  const [ingredients, setIngredients] = useState<TimerIngredient[]>([])
  const [batchCount, setBatchCount] = useState(1)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [stepStartTime, setStepStartTime] = useState<Date | null>(null)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formulaVerifiedAt, setFormulaVerifiedAt] = useState<string | null>(null)
  const [formulaLoadError, setFormulaLoadError] = useState<string | null>(null)
  const [ingredientsRevision, setIngredientsRevision] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [, setLiveTick] = useState(0)
  const isSavingRef = useRef(false)

  useEffect(() => {
    isSavingRef.current = isSaving
  }, [isSaving])

  const applySession = useCallback(
    (payload: ProductionTimerSession, options?: ApplySessionOptions) => {
      const mapped = mapStepsFromSession(payload)
      setSession(payload)
      setProductionSteps(mapped.productionSteps)
      setAllStepRecords(mapped.stepRecords)
      setSessionStarted(Boolean(payload.started))

      if (options?.initialLoad) {
        setCurrentStepIndex(getActiveStepIndex(mapped.stepRecords))
        setStepStartTime(null)
        return
      }

      if (options?.focusStepIndex != null) {
        setCurrentStepIndex(options.focusStepIndex)
        if (options.stepStartTime !== undefined) {
          setStepStartTime(options.stepStartTime)
        }
        return
      }

      setCurrentStepIndex((prev) =>
        prev >= 0 && prev < mapped.stepRecords.length
          ? prev
          : getActiveStepIndex(mapped.stepRecords),
      )
    },
    [],
  )

  const syncTimerSession = useCallback(
    async (steps: TimerStep[], completedAt?: string) => {
      return productionTimerApi.updateSession(jobId, steps, completedAt)
    },
    [jobId],
  )

  useEffect(() => {
    if (!jobId) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadSession() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const timerData = await productionTimerApi.getByJobId(jobId)
        if (cancelled) return

        applySession(timerData, { initialLoad: true })

        setFormulaLoadError(null)
        try {
          const formulaRecord = await formulaWeighingApi.getByJobId(jobId)
          if (cancelled) return
          setIngredients(mapIngredients(formulaRecord))
          setBatchCount(formulaRecord.batchCount ?? 1)
          setFormulaVerifiedAt(formulaRecord.verifiedAt ?? null)
        } catch {
          if (!cancelled) {
            setIngredients([])
            setFormulaVerifiedAt(null)
            setFormulaLoadError("โหลดข้อมูลตวงสูตรไม่สำเร็จ")
          }
        }
      } catch {
        if (!cancelled) {
          setLoadError("โหลดข้อมูลงานผลิตไม่สำเร็จ")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      cancelled = true
    }
  }, [applySession, jobId])

  // Real-time: รับ session ที่เปลี่ยนแปลงผ่าน SSE (push เฉพาะตอนเปลี่ยน ไม่ใช่ polling รายนาที)
  // ปิด connection เมื่อสลับงาน/ออกจากหน้า/แท็บถูกซ่อน เพื่อกัน connection ค้างเกินจำเป็น
  useEffect(() => {
    if (!jobId) return

    let disconnect: (() => void) | null = null

    const open = () => {
      if (disconnect) return
      disconnect = openSseConnection(`/production-timer/${jobId}/stream`, {
        onEvent: (event) => {
          if (event.type !== "session" || !event.payload) return
          // ระหว่างกำลังบันทึกของผู้ใช้คนนี้ ปล่อยให้ response ของ mutation จัดการ state เอง
          if (isSavingRef.current) return
          applySession(event.payload as ProductionTimerSession)
        },
      })
    }

    const close = () => {
      disconnect?.()
      disconnect = null
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") open()
      else close()
    }

    if (document.visibilityState === "visible") open()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      close()
    }
  }, [applySession, jobId])

  const activeStepIndex = getActiveStepIndex(allStepRecords)
  const currentRecord = allStepRecords[currentStepIndex]
  const isTimingCurrentStep =
    Boolean(stepStartTime) || isStepInProgress(currentRecord)
  const canStartCurrentStep = canStartStep(currentStepIndex, allStepRecords)
  const canCompleteCurrentStep =
    canCompleteStep(currentStepIndex, allStepRecords) ||
    Boolean(stepStartTime)

  const hasInProgressStep = allStepRecords.some(isStepInProgress)
  const needsLiveClock =
    hasInProgressStep ||
    (currentStepIndex === activeStepIndex && stepStartTime != null)

  useEffect(() => {
    if (!needsLiveClock) return

    const liveInterval = setInterval(() => {
      setLiveTick((tick) => tick + 1)
    }, 1000)

    return () => clearInterval(liveInterval)
  }, [needsLiveClock])

  const goToStep = useCallback(
    (index: number) => {
      if (!canSelectStep(index, allStepRecords)) return
      setCurrentStepIndex(index)
      const record = allStepRecords[index]
      if (isStepInProgress(record)) {
        setStepStartTime(parseClockToBangkokDate(record.startTime))
      } else {
        setStepStartTime(null)
      }
    },
    [allStepRecords],
  )

  const startStep = useCallback(async () => {
    if (!canStartCurrentStep || isSaving) return

    let records = allStepRecords
    let stepIndex = currentStepIndex

    if (!sessionStarted) {
      const isRogangJob = session?.jobCode?.startsWith("RG") ?? false
      if (!formulaVerifiedAt && !isRogangJob) {
        toast({
          title: "ไม่สามารถเริ่มงานได้",
          description: "งานยังไม่ได้รับการยืนยันสูตร กรุณาติดต่อเจ้าหน้าที่ตวงสูตร",
          variant: "destructive",
        })
        return
      }

      setIsSaving(true)
      try {
        const started = await productionTimerApi.startSession(jobId, getAuthUserName())
        const mapped = mapStepsFromSession(started)
        records = mapped.stepRecords
        stepIndex = currentStepIndex
        applySession(started, { focusStepIndex: stepIndex })
      } catch {
        toast({
          title: "ไม่สามารถเริ่มงานได้",
          description: "กรุณาตรวจสอบว่างานได้รับการยืนยันสูตรแล้ว",
          variant: "destructive",
        })
        return
      } finally {
        setIsSaving(false)
      }
    }

    const record = records[stepIndex]
    if (isStepInProgress(record)) {
      setStepStartTime(parseClockToBangkokDate(record.startTime))
      return
    }

    if (stepStartTime) return

    const startTime = new Date()
    const startTimeStr = formatClockHms(startTime)

    setIsSaving(true)
    try {
      const updated = await syncTimerSession(
        buildStepsPayload(records, stepIndex, {
          startTime: startTimeStr,
          completed: false,
        }),
      )
      applySession(updated, {
        focusStepIndex: stepIndex,
        stepStartTime: startTime,
      })
    } catch {
      toast({
        title: "บันทึกเวลาเริ่มไม่สำเร็จ",
        description: "กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [
    allStepRecords,
    applySession,
    canStartCurrentStep,
    currentStepIndex,
    formulaVerifiedAt,
    isSaving,
    jobId,
    sessionStarted,
    session?.jobCode,
    stepStartTime,
    syncTimerSession,
  ])

  const completeStep = useCallback(async () => {
    if (!canCompleteCurrentStep || isSaving) return false

    const record = allStepRecords[currentStepIndex]
    const effectiveStartTime =
      stepStartTime ??
      (isStepInProgress(record) ? parseClockToBangkokDate(record.startTime) : null)

    if (!effectiveStartTime) {
      toast({
        title: "ไม่สามารถบันทึกได้",
        description: "กรุณากดเริ่มก่อนบันทึกขั้นตอน",
        variant: "destructive",
      })
      return false
    }

    const endTime = new Date()
    const durationSeconds = Math.floor(
      (endTime.getTime() - effectiveStartTime.getTime()) / 1000,
    )

    const nextAllStepRecords = [...allStepRecords]
    nextAllStepRecords[currentStepIndex] = {
      stepName: productionSteps[currentStepIndex].name,
      startTime: formatClockHms(effectiveStartTime),
      endTime: formatClockHms(endTime),
      duration: formatDurationWithSeconds(durationSeconds),
      completed: true,
    }

    const isLastStep = nextAllStepRecords.every((step) => step.completed)

    setIsSaving(true)
    try {
      const updated = await syncTimerSession(
        recordsToTimerSteps(nextAllStepRecords),
        isLastStep ? new Date().toISOString() : undefined,
      )
      const mapped = mapStepsFromSession(updated)
      applySession(updated, {
        focusStepIndex: getActiveStepIndex(mapped.stepRecords),
        stepStartTime: null,
      })
      return isLastStep
    } catch {
      toast({
        title: "บันทึกขั้นตอนไม่สำเร็จ",
        description: "กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }, [
    allStepRecords,
    applySession,
    canCompleteCurrentStep,
    currentStepIndex,
    isSaving,
    productionSteps,
    stepStartTime,
    syncTimerSession,
  ])

  const reloadIngredients = useCallback(async () => {
    const formulaRecord = await formulaWeighingApi.getByJobId(jobId)
    setIngredients(mapIngredients(formulaRecord))
    setBatchCount(formulaRecord.batchCount ?? 1)
    setIngredientsRevision((value) => value + 1)
  }, [jobId])

  const saveOperatorWeighing = useCallback(
    async (materialCode: string, measuredWeight: string, unitPrice?: number) => {
      try {
        await productionTimerApi.saveOperatorWeighing(
          jobId,
          materialCode,
          measuredWeight,
          getAuthUserName(),
          unitPrice,
        )
        await reloadIngredients()
        toast({
          title: "บันทึกจำนวนเบิกแล้ว",
          description: "อัปเดตน้ำหนักวัตถุดิบก่อนผลิตเรียบร้อย",
        })
      } catch (error) {
        console.error("Failed to save operator weighing:", error)
        toast({
          variant: "destructive",
          title: "บันทึกจำนวนเบิกไม่สำเร็จ",
          description:
            error instanceof Error && error.message
              ? error.message
              : "กรุณาลองใหม่อีกครั้ง",
        })
        throw error
      }
    },
    [jobId, reloadIngredients],
  )

  const adminCorrectSteps = useCallback(
    async (steps: TimerStep[], completedAt?: string) => {
      setIsSaving(true)
      try {
        const updated = await productionTimerApi.adminUpdateSession(
          jobId,
          steps,
          completedAt,
        )
        applySession(updated)
        toast({
          title: "บันทึกการแก้ไขแล้ว",
          description: "อัปเดตเวลาและสถานะขั้นตอนเรียบร้อย (ผู้ปฏิบัติงานเดิมไม่เปลี่ยน)",
        })
      } catch (error) {
        console.error("Admin correction failed:", error)
        toast({
          title: "บันทึกการแก้ไขไม่สำเร็จ",
          description: parseApiErrorMessage(
            error,
            "กรุณาตรวจสอบเวลาแล้วลองใหม่",
          ),
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
    },
    [applySession, jobId],
  )

  return {
    session,
    productionSteps,
    allStepRecords,
    ingredients,
    batchCount,
    currentStepIndex,
    activeStepIndex,
    currentRecord,
    isTimingCurrentStep,
    stepStartTime,
    isLoading,
    loadError,
    formulaLoadError,
    isSaving,
    canStartCurrentStep,
    canCompleteCurrentStep,
    startStep,
    completeStep,
    goToStep,
    saveOperatorWeighing,
    adminCorrectSteps,
    ingredientsRevision,
  }
}
