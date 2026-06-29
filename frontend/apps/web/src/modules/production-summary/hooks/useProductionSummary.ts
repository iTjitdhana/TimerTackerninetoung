"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import { getPermissions } from "@/shared/lib/auth"
import { toast } from "@/shared/hooks/use-toast"
import {
  DEFAULT_OUTPUT_CONFIG,
  normalizeOutputConfig,
  productionSummaryApi,
  resolveDefaultOutputUnit,
  type CostPreview,
  type InputMaterialConversion,
  type OutputVariant,
  type ProductOutputConfig,
  type ProductionBalance,
  type ProductionOutputLineInput,
  type SavedOutputSnapshot,
  type ProductionSummaryContext,
} from "../services/production-summary.api"
import { buildInitialSellableQtys } from "../utils/sellable-qty"
import { resolveOutputDisplayState } from "../utils/resolve-output-display"
import { resolveSummaryViewMode } from "../utils/resolve-summary-view-mode"

export interface SaveSummaryPayload {
  outputLines: ProductionOutputLineInput[]
  sellableLines: Array<{ qty: number; unit?: string }>
  parsedScrapQty: number
  dailyWagePerPerson: number
  variants: OutputVariant[]
  balance: ProductionBalance
}

interface AdminDraftSnapshot {
  sellableQtys: Record<string, string>
  scrapQty: string
  scrapTouched: boolean
  dailyWageInput: string
  dailyWageTouched: boolean
  adminSelectedUnit: string
}

interface UseProductionSummaryOptions {
  jobId?: string
  initialOutputConfig?: ProductOutputConfig
  ingredientsRevision?: number
  adminEditMode: boolean
  stayAfterSave: boolean
  onCancelPath: string
}

function applySummaryContext(
  context: ProductionSummaryContext,
  loadAsAdmin: boolean,
  setters: {
    setOutputConfig: (config: ProductOutputConfig) => void
    setCostPreview: (preview: CostPreview | null) => void
    setInputUnitConversions: (rows: InputMaterialConversion[]) => void
    setSellableQtys: (value: Record<string, string>) => void
    setHasSavedSummary: (value: boolean) => void
    setSavedOutputSnapshot: (value: SavedOutputSnapshot | null) => void
    setAdminSelectedUnit: (unit: string) => void
    setDailyWageInput: (value: string) => void
    setDailyWageTouched: (value: boolean) => void
    setScrapQty: (value: string) => void
    setScrapTouched: (value: boolean) => void
  },
) {
  const fromApi = normalizeOutputConfig(context.outputConfig)
  setters.setOutputConfig(fromApi)
  setters.setCostPreview(context.costPreview)
  setters.setInputUnitConversions(context.costPreview?.inputUnitConversions ?? [])

  const display = resolveOutputDisplayState({
    hasSavedSummary: Boolean(context.summary),
    isAdminEditor: loadAsAdmin,
    savedSnapshot: context.savedOutputSnapshot,
    liveConfig: fromApi,
  })
  const displayVariants =
    display.variants.length > 0 ? display.variants : fromApi.outputVariants

  const initialSellableQtys = buildInitialSellableQtys(
    displayVariants,
    context.summary?.outputLines,
  )
  setters.setSellableQtys(
    !loadAsAdmin || displayVariants.length > 1
      ? initialSellableQtys
      : { "admin-sellable-0": Object.values(initialSellableQtys)[0] ?? "" },
  )
  setters.setHasSavedSummary(Boolean(context.summary))
  setters.setSavedOutputSnapshot(context.savedOutputSnapshot ?? null)

  const savedSellable = context.summary?.outputLines?.find(
    (line) => line.kind === "sellable",
  )
  if (savedSellable?.unit) {
    setters.setAdminSelectedUnit(savedSellable.unit)
  } else {
    setters.setAdminSelectedUnit(resolveDefaultOutputUnit(fromApi))
  }

  if (context.costPreview?.dailyWagePerPerson != null) {
    setters.setDailyWageInput(String(context.costPreview.dailyWagePerPerson))
    setters.setDailyWageTouched(true)
  } else {
    setters.setDailyWageInput("")
    setters.setDailyWageTouched(false)
  }

  const savedScrap = context.summary?.outputLines?.find(
    (line) => line.kind === "scrap",
  )
  if (savedScrap) {
    setters.setScrapQty(String(savedScrap.qty || ""))
    setters.setScrapTouched(true)
  } else if (context.summary) {
    setters.setScrapQty(String(Number(context.summary.defect_qty) || ""))
    setters.setScrapTouched(true)
  } else {
    setters.setScrapQty("")
    setters.setScrapTouched(false)
  }
}

export function useProductionSummary({
  jobId,
  initialOutputConfig,
  ingredientsRevision = 0,
  adminEditMode,
  stayAfterSave,
  onCancelPath,
}: UseProductionSummaryOptions) {
  const router = useRouter()
  const { canAction } = usePermissions()
  const isAdminEditor = adminEditMode || canAction("production_summary.admin_edit")
  const canViewCost = canAction("production_summary.view_cost")

  const [outputConfig, setOutputConfig] =
    useState<ProductOutputConfig>(DEFAULT_OUTPUT_CONFIG)
  const [sellableQtys, setSellableQtys] = useState<Record<string, string>>({})
  const [scrapQty, setScrapQty] = useState("")
  const [scrapTouched, setScrapTouched] = useState(false)
  const [costPreview, setCostPreview] = useState<CostPreview | null>(null)
  const [inputUnitConversions, setInputUnitConversions] = useState<
    InputMaterialConversion[]
  >([])
  const [dailyWageInput, setDailyWageInput] = useState("")
  const [dailyWageTouched, setDailyWageTouched] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [hasSavedSummary, setHasSavedSummary] = useState(false)
  const [savedOutputSnapshot, setSavedOutputSnapshot] =
    useState<SavedOutputSnapshot | null>(null)
  const [adminSelectedUnit, setAdminSelectedUnit] = useState("")
  const [adminEditing, setAdminEditing] = useState(false)
  const [adminDraftSnapshot, setAdminDraftSnapshot] =
    useState<AdminDraftSnapshot | null>(null)

  const adminEditModeRef = useRef(adminEditMode)
  useEffect(() => {
    adminEditModeRef.current = adminEditMode
  }, [adminEditMode])

  const contextSetters = useMemo(
    () => ({
      setOutputConfig,
      setCostPreview,
      setInputUnitConversions,
      setSellableQtys,
      setHasSavedSummary,
      setSavedOutputSnapshot,
      setAdminSelectedUnit,
      setDailyWageInput,
      setDailyWageTouched,
      setScrapQty,
      setScrapTouched,
    }),
    [],
  )

  useEffect(() => {
    if (initialOutputConfig) {
      const config = normalizeOutputConfig(initialOutputConfig)
      setOutputConfig(config)
      setSellableQtys((prev) =>
        Object.keys(prev).length > 0
          ? prev
          : buildInitialSellableQtys(config.outputVariants),
      )
    }
  }, [initialOutputConfig])

  const {
    data: context,
    isLoading,
    error: loadError,
  } = useApiQuery(
    () => productionSummaryApi.getByJobId(jobId as string),
    [jobId, ingredientsRevision],
    { enabled: !!jobId },
  )

  useEffect(() => {
    if (!context) return
    const cachedPerms = getPermissions()
    const loadAsAdmin = Boolean(
      adminEditModeRef.current ||
        cachedPerms?.actions.includes("production_summary.admin_edit"),
    )
    applySummaryContext(context, loadAsAdmin, contextSetters)
    setAdminEditing(false)
    setAdminDraftSnapshot(null)
  }, [context, contextSetters])

  useEffect(() => {
    if (!loadError) return
    console.error("Failed to load production summary context:", loadError)
    toast({
      variant: "destructive",
      title: "โหลดข้อมูลสรุปผลผลิตไม่สำเร็จ",
      description: "กรุณาลองใหม่อีกครั้ง หรือตรวจสอบการเชื่อมต่อ",
    })
  }, [loadError])

  const viewMode = resolveSummaryViewMode({
    hasSavedSummary,
    isAdminEditor,
    adminEditing,
  })

  const handleSellableQtyChange = useCallback(
    (key: string, value: string) => {
      setSellableQtys((prev) => ({ ...prev, [key]: value }))
      if (!scrapTouched) {
        setScrapQty("")
      }
    },
    [scrapTouched],
  )

  const handleScrapChange = useCallback((value: string) => {
    setScrapTouched(true)
    setScrapQty(value)
  }, [])

  const handleDailyWageChange = useCallback((value: string) => {
    setDailyWageTouched(true)
    setDailyWageInput(value)
  }, [])

  const startAdminEdit = useCallback(() => {
    setAdminDraftSnapshot({
      sellableQtys: { ...sellableQtys },
      scrapQty,
      scrapTouched,
      dailyWageInput,
      dailyWageTouched,
      adminSelectedUnit,
    })
    setAdminEditing(true)
  }, [
    sellableQtys,
    scrapQty,
    scrapTouched,
    dailyWageInput,
    dailyWageTouched,
    adminSelectedUnit,
  ])

  const cancelAdminEdit = useCallback(() => {
    if (adminDraftSnapshot) {
      setSellableQtys(adminDraftSnapshot.sellableQtys)
      setScrapQty(adminDraftSnapshot.scrapQty)
      setScrapTouched(adminDraftSnapshot.scrapTouched)
      setDailyWageInput(adminDraftSnapshot.dailyWageInput)
      setDailyWageTouched(adminDraftSnapshot.dailyWageTouched)
      setAdminSelectedUnit(adminDraftSnapshot.adminSelectedUnit)
    }
    setAdminEditing(false)
    setAdminDraftSnapshot(null)
  }, [adminDraftSnapshot])

  const cancelEntry = useCallback(
    (onCancelEntry?: () => void) => {
      if (onCancelEntry) {
        onCancelEntry()
        return
      }
      router.push(onCancelPath)
    },
    [router, onCancelPath],
  )

  const save = useCallback(
    async (payload: SaveSummaryPayload) => {
      if (canViewCost) {
        setShowPreview(true)
      }

      if (!jobId) {
        console.log("Summary saved locally:", {
          outputLines: payload.outputLines,
          balance: payload.balance,
        })
        return
      }

      const wasResave = hasSavedSummary
      const conversionNote = outputConfig.conversionVerified
        ? ""
        : " — อัตราแปลงหน่วยยังไม่ยืนยัน yield อาจไม่แม่นยำ"

      setIsSaving(true)
      try {
        await productionSummaryApi.create({
          jobId,
          outputLines: payload.outputLines,
          outputQty: payload.sellableLines[0]?.qty ?? 0,
          outputUnit: payload.sellableLines[0]?.unit,
          scrapQty: payload.parsedScrapQty,
          dailyWagePerPerson: canViewCost ? payload.dailyWagePerPerson : 0,
        })

        const shouldReload = wasResave || stayAfterSave || isAdminEditor
        if (shouldReload) {
          const refreshed = await productionSummaryApi.getByJobId(jobId)
          applySummaryContext(refreshed, isAdminEditor, contextSetters)
        } else {
          setHasSavedSummary(true)
        }

        setShowPreview(false)

        if (wasResave) {
          setAdminEditing(false)
          setAdminDraftSnapshot(null)
          toast({
            title: "บันทึกการแก้ไขแล้ว",
            description: `อัปเดตจำนวนผลิตแล้ว (ผู้ปฏิบัติงานเดิมไม่เปลี่ยน)${conversionNote}`,
          })
          return
        }

        if (stayAfterSave || isAdminEditor) {
          toast({
            title: "บันทึกการผลิตแล้ว",
            description: isAdminEditor
              ? `บันทึกสำเร็จ${conversionNote}`
              : `เลือกเมนูถัดไปจากรายการด้านบน${conversionNote}`,
          })
          return
        }

        toast({
          title: "บันทึกการผลิตแล้ว",
          description: conversionNote
            ? `บันทึกสำเร็จ${conversionNote}`
            : undefined,
        })
        router.push(onCancelPath)
      } catch (error) {
        console.error("Failed to save production summary:", error)
        toast({
          variant: "destructive",
          title: "บันทึกสรุปผลผลิตไม่สำเร็จ",
          description:
            error instanceof Error && error.message
              ? error.message
              : "กรุณาลองใหม่อีกครั้ง",
        })
      } finally {
        setIsSaving(false)
      }
    },
    [
      jobId,
      canViewCost,
      hasSavedSummary,
      isAdminEditor,
      stayAfterSave,
      onCancelPath,
      router,
      outputConfig.conversionVerified,
      contextSetters,
    ],
  )

  return useMemo(
    () => ({
      isAdminEditor,
      canViewCost,
      viewMode,
      outputConfig,
      sellableQtys,
      scrapQty,
      scrapTouched,
      costPreview,
      inputUnitConversions,
      dailyWageInput,
      dailyWageTouched,
      isLoading,
      isSaving,
      showPreview,
      hasSavedSummary,
      savedOutputSnapshot,
      adminSelectedUnit,
      adminEditing,
      setAdminSelectedUnit,
      handleSellableQtyChange,
      handleScrapChange,
      handleDailyWageChange,
      startAdminEdit,
      cancelAdminEdit,
      cancelEntry,
      save,
    }),
    [
      isAdminEditor,
      canViewCost,
      viewMode,
      outputConfig,
      sellableQtys,
      scrapQty,
      scrapTouched,
      costPreview,
      inputUnitConversions,
      dailyWageInput,
      dailyWageTouched,
      isLoading,
      isSaving,
      showPreview,
      hasSavedSummary,
      savedOutputSnapshot,
      adminSelectedUnit,
      adminEditing,
      handleSellableQtyChange,
      handleScrapChange,
      handleDailyWageChange,
      startAdminEdit,
      cancelAdminEdit,
      cancelEntry,
      save,
    ],
  )
}
