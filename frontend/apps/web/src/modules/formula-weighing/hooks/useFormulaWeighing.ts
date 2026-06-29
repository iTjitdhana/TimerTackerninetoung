"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { openSseConnection } from "@/shared/api-client"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import { getAuthUserName } from "@/shared/lib/auth"
import { FORMULA_WEIGHING_LABELS as L } from "../constants/labels"
import {
  formulaWeighingApi,
  normalizeFormulaWeighingRecord,
  type FormulaWeighingRecord,
  type FormulaWeighingRecordApi,
} from "../services/formula-weighing.api"
import type { FormulaWeighingLine, MaterialOption } from "../types"
import { normalizeLineUnits, recordUnitUsage } from "../utils/weighing-unit-prefs"
import {
  applyBatchCountToBomLines,
  normalizeBatchCountInput,
} from "../utils/planned-quantity-display"
import { normalizeWithdrawnQuantityForSave } from "../utils/withdrawn-quantity"
import { roundUnitPrice } from "../utils/unit-price"
import { nowIso } from "../utils/price-source-label"

export interface CustomLineInput {
  productCode: string
  productName: string
  plannedQuantity: string
  plannedUnit: string
}

export interface WithdrawInput {
  withdrawnQtyInput: string
  withdrawnUnitInput: string
  unitPriceInput: string
  noteInput?: string
  /** true = ผู้ใช้แก้ราคาในช่อง dialog เอง */
  priceEdited?: boolean
}

const MISSING_JOB_ERROR = "กรุณาเลือกงานจากหน้า Dashboard ก่อนบันทึก"

export function useFormulaWeighing(
  jobId: string | null,
  initialProductionLine: string,
) {
  const router = useRouter()

  const [productionLine, setProductionLine] = useState(initialProductionLine)
  const [productCode, setProductCode] = useState<string | null>(null)
  const [lines, setLines] = useState<FormulaWeighingLine[]>([])
  const [batchCount, setBatchCount] = useState(1)
  const [hasFormula, setHasFormula] = useState(true)
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [isSavingWithdrawn, setIsSavingWithdrawn] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSavingLine, setIsSavingLine] = useState(false)

  const hasLocalEditsRef = useRef(false)
  const isMutatingRef = useRef(false)

  useEffect(() => {
    isMutatingRef.current =
      isSaving || isSavingWithdrawn || isSavingLine || isVerifying
  }, [isSaving, isSavingWithdrawn, isSavingLine, isVerifying])

  const applyRecord = useCallback((data: FormulaWeighingRecordApi | FormulaWeighingRecord) => {
    const record = normalizeFormulaWeighingRecord(data)
    if (record.productName) {
      setProductionLine(record.productName)
    }
    setProductCode(record.jobCode ?? null)
    setLines(record.ingredients)
    setBatchCount(normalizeBatchCountInput(record.batchCount ?? 1))
    setHasFormula(record.hasFormula ?? true)
    setVerifiedAt(record.verifiedAt ?? null)
    hasLocalEditsRef.current = false
  }, [])

  const {
    data: record,
    isLoading,
    error: loadFetchError,
  } = useApiQuery(
    () => formulaWeighingApi.getByJobId(jobId as string),
    [jobId],
    { enabled: !!jobId },
  )

  useEffect(() => {
    if (!jobId) {
      setLines([])
      setProductCode(null)
      setLoadError(L.errors.selectJob)
    } else {
      setLoadError(null)
    }
  }, [jobId])

  useEffect(() => {
    if (!record) return
    applyRecord(record)
  }, [record, applyRecord])

  useEffect(() => {
    if (!jobId) return

    let disconnect: (() => void) | null = null

    const open = () => {
      if (disconnect) return
      disconnect = openSseConnection(`/formula-weighing/${jobId}/stream`, {
        onEvent: (event) => {
          if (event.type !== "record" || !event.payload) return
          if (isMutatingRef.current || hasLocalEditsRef.current) return
          applyRecord(event.payload as FormulaWeighingRecordApi)
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
  }, [applyRecord, jobId])

  useEffect(() => {
    if (!loadFetchError) return
    console.error("Failed to load formula:", loadFetchError)
    setLoadError("โหลดข้อมูลงานไม่สำเร็จ")
    setLines([])
    setHasFormula(true)
  }, [loadFetchError])

  const reload = useCallback(async () => {
    if (!jobId) return
    const data = await formulaWeighingApi.getByJobId(jobId)
    applyRecord(data)
  }, [jobId, applyRecord])

  const persistLines = useCallback(
    async (nextLines: FormulaWeighingLine[], nextBatchCount = batchCount) => {
      if (!jobId) {
        setLoadError(MISSING_JOB_ERROR)
        throw new Error("missing jobId")
      }
      await formulaWeighingApi.saveRecord(
        jobId,
        getAuthUserName(),
        nextLines,
        nextBatchCount,
      )
      await reload()
    },
    [jobId, batchCount, reload],
  )

  const handleBatchCountChange = useCallback((rawValue: string) => {
    hasLocalEditsRef.current = true
    const nextBatchCount = normalizeBatchCountInput(rawValue)
    setBatchCount(nextBatchCount)
    setLines(
      (prev) =>
        applyBatchCountToBomLines(prev, nextBatchCount) as FormulaWeighingLine[],
    )
  }, [])

  const updateLineNote = useCallback((lineId: string, note: string) => {
    hasLocalEditsRef.current = true
    setLines((prev) =>
      prev.map((item) => (item.id === lineId ? { ...item, note } : item)),
    )
  }, [])

  const updateLineInline = useCallback(
    (
      lineId: string,
      fields: Partial<
        Pick<
          FormulaWeighingLine,
          | "withdrawnQuantity"
          | "withdrawnUnit"
          | "unitPrice"
          | "unitPriceSource"
          | "unitPriceSourceAt"
        >
      >,
    ) => {
      hasLocalEditsRef.current = true
      const normalized = {
        ...fields,
        ...(fields.unitPrice != null
          ? { unitPrice: roundUnitPrice(fields.unitPrice) }
          : {}),
        ...(fields.unitPriceSource === "manual" && !fields.unitPriceSourceAt
          ? { unitPriceSourceAt: nowIso() }
          : {}),
      }
      setLines((prev) =>
        prev.map((item) => (item.id === lineId ? { ...item, ...normalized } : item)),
      )
    },
    [],
  )

  const addMaterial = useCallback(
    async (material: MaterialOption): Promise<boolean> => {
      if (lines.some((item) => item.productCode === material.code)) {
        setLoadError(L.errors.productExists)
        return false
      }

      const nextLines: FormulaWeighingLine[] = [
        ...lines,
        normalizeLineUnits({
          id: `draft-${material.code}-${Date.now()}`,
          productCode: material.code,
          productName: material.name,
          plannedQuantity: "",
          withdrawnQuantity: "",
          withdrawnUnit: material.unit,
          plannedUnit: material.unit,
          isManual: true,
        }),
      ]

      setIsSavingLine(true)
      setLoadError(null)
      try {
        await persistLines(nextLines)
        return true
      } catch (error) {
        console.error("Failed to save line:", error)
        setLoadError(L.errors.saveProductFailed)
        return false
      } finally {
        setIsSavingLine(false)
      }
    },
    [lines, persistLines],
  )

  const addCustomLine = useCallback(
    async (input: CustomLineInput): Promise<boolean> => {
      const productCode = input.productCode.trim()
      const productName = input.productName.trim()
      const plannedQuantity = input.plannedQuantity.trim()
      const plannedUnit = input.plannedUnit.trim()

      if (!productCode || !productName || !plannedQuantity || !plannedUnit) {
        setLoadError(L.errors.fillAllFields)
        return false
      }
      if (productCode.length > 16) {
        setLoadError(L.errors.productCodeMax)
        return false
      }
      if (lines.some((item) => item.productCode === productCode)) {
        setLoadError(L.errors.productExists)
        return false
      }

      const nextLines: FormulaWeighingLine[] = [
        ...lines,
        normalizeLineUnits({
          id: `draft-${productCode}-${Date.now()}`,
          productCode,
          productName,
          plannedQuantity,
          withdrawnQuantity: "",
          withdrawnUnit: plannedUnit,
          plannedUnit,
          isManual: true,
        }),
      ]

      setIsSavingLine(true)
      setLoadError(null)
      try {
        await persistLines(nextLines)
        recordUnitUsage(plannedUnit)
        return true
      } catch (error) {
        console.error("Failed to save custom line:", error)
        setLoadError(L.errors.saveProductFailed)
        return false
      } finally {
        setIsSavingLine(false)
      }
    },
    [lines, persistLines],
  )

  const removeLine = useCallback(
    async (line: FormulaWeighingLine) => {
      if (!jobId || !line.isManual) return

      const previousLines = lines
      setLines((prev) => prev.filter((item) => item.id !== line.id))
      setLoadError(null)
      try {
        await formulaWeighingApi.removeManualIngredient(jobId, line.productCode)
        await reload()
      } catch (error) {
        console.error("Failed to remove line:", error)
        setLines(previousLines)
        setLoadError(L.errors.removeFailed)
      }
    },
    [jobId, lines, reload],
  )

  const saveWithdrawn = useCallback(
    async (
      selectedLine: FormulaWeighingLine,
      input: WithdrawInput,
    ): Promise<boolean> => {
      if (!jobId) {
        setLoadError(MISSING_JOB_ERROR)
        return false
      }

      const withdrawnQuantity = normalizeWithdrawnQuantityForSave(
        input.withdrawnQtyInput,
      )
      if (!withdrawnQuantity) {
        setLoadError(L.errors.enterWithdrawnQty)
        return false
      }
      const withdrawnUnit = input.withdrawnUnitInput.trim()
      if (!withdrawnUnit) {
        setLoadError(L.errors.enterWithdrawnUnit)
        return false
      }
      const unitPriceRaw = input.unitPriceInput.trim().replace(/,/g, "")
      const unitPrice =
        unitPriceRaw === "" ? undefined : roundUnitPrice(Number.parseFloat(unitPriceRaw))
      if (
        unitPriceRaw !== "" &&
        (!Number.isFinite(unitPrice as number) || (unitPrice as number) < 0)
      ) {
        setLoadError("กรุณากรอกราคาต่อหน่วยให้ถูกต้อง")
        return false
      }

      const note = input.noteInput !== undefined ? input.noteInput.trim() || undefined : selectedLine.note
      const unitPriceSource: "api" | "manual" | undefined = input.priceEdited
        ? "manual"
        : (selectedLine.unitPriceSource ?? (unitPrice != null ? "api" : undefined))
      const unitPriceSourceAt = input.priceEdited
        ? nowIso()
        : selectedLine.unitPriceSourceAt

      const previousLines = lines
      const updatedLines = lines.map((item) =>
        item.id === selectedLine.id
          ? {
              ...item,
              withdrawnQuantity,
              withdrawnUnit,
              unitPrice,
              note,
              unitPriceSource,
              unitPriceSourceAt,
            }
          : item,
      )

      setLines(updatedLines)
      setIsSavingWithdrawn(true)
      setLoadError(null)
      try {
        await persistLines(updatedLines)
        recordUnitUsage(withdrawnUnit)
        return true
      } catch (error) {
        console.error("Failed to save withdrawn quantity:", error)
        setLines(previousLines)
        setLoadError(L.errors.saveWithdrawnFailed)
        return false
      } finally {
        setIsSavingWithdrawn(false)
      }
    },
    [jobId, lines, persistLines],
  )

  const verify = useCallback(async () => {
    if (!jobId) return
    setIsVerifying(true)
    try {
      await formulaWeighingApi.saveRecord(
        jobId,
        getAuthUserName(),
        lines,
        batchCount,
      )
      await formulaWeighingApi.verify(jobId, getAuthUserName())
      setVerifiedAt(new Date().toISOString())
      router.push("/formula-weighing-list")
    } catch (error) {
      console.error("Failed to verify formula:", error)
      setLoadError(L.errors.verifyFailed)
    } finally {
      setIsVerifying(false)
    }
  }, [jobId, lines, batchCount, router])

  const save = useCallback(async () => {
    if (!jobId) {
      setLoadError(MISSING_JOB_ERROR)
      return
    }
    setIsSaving(true)
    try {
      await formulaWeighingApi.saveRecord(
        jobId,
        getAuthUserName(),
        lines,
        batchCount,
      )
      router.push("/formula-weighing-list")
    } catch (error) {
      console.error("Failed to save weighing record:", error)
      setLoadError("บันทึกไม่สำเร็จ กรุณาลองใหม่")
    } finally {
      setIsSaving(false)
    }
  }, [jobId, lines, batchCount, router])

  return {
    productionLine,
    productCode,
    lines,
    batchCount,
    hasFormula,
    verifiedAt,
    loadError,
    isLoading,
    isSaving,
    isSavingWithdrawn,
    isVerifying,
    isSavingLine,
    setLoadError,
    handleBatchCountChange,
    updateLineNote,
    updateLineInline,
    addMaterial,
    addCustomLine,
    removeLine,
    saveWithdrawn,
    verify,
    save,
  }
}
