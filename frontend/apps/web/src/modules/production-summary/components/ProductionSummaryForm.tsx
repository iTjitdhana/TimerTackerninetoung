"use client"

import { useMemo, type RefObject } from "react"
import { AlertTriangle, Info } from "lucide-react"
import { Card } from "@/shared/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert"
import {
  calculateProductionBalance,
  calculateYieldPercent,
  calculateHourlyRateFromDailyWage,
  calculateLaborCostFromDailyWage,
  calculateMultiOutputCostBreakdown,
  aggregateOutputLines,
  buildOutputLinesFromFormState,
  calculateInputKgFromIngredients,
  DEFAULT_OUTPUT_CONFIG,
  DEFAULT_STANDARD_WORK_MINUTES,
  isKgUnit,
  resolveConversionRateForUnit,
  type OutputVariant,
  type ProductOutputConfig,
} from "../services/production-summary.api"
import { useProductionSummary } from "../hooks/useProductionSummary"
import { sellableQtyKey } from "../utils/sellable-qty"
import { resolveOutputDisplayState } from "../utils/resolve-output-display"
import { AdminEditPanel } from "./AdminEditPanel"
import { SavedSummaryDisplay } from "./SavedSummaryDisplay"
import { OutputLinesSection } from "./OutputLinesSection"
import { CostPreviewPanel } from "./CostPreviewPanel"
import { SummaryActions } from "./SummaryActions"

interface ProductionSummaryFormProps {
  jobId?: string
  initialOutputConfig?: ProductOutputConfig
  ingredients?: Array<{
    name: string
    code?: string | null
    measuredWeight: string
    unit: string
  }>
  ingredientsRevision?: number
  onCancelPath?: string
  weightInputRef?: RefObject<HTMLInputElement | null>
  stayAfterSave?: boolean
  adminEditMode?: boolean
  onCancelEntry?: () => void
}

export function ProductionSummaryForm({
  jobId,
  initialOutputConfig,
  ingredients = [],
  ingredientsRevision = 0,
  onCancelPath = "/production-list",
  weightInputRef,
  stayAfterSave = false,
  adminEditMode = false,
  onCancelEntry,
}: ProductionSummaryFormProps) {
  const summary = useProductionSummary({
    jobId,
    initialOutputConfig,
    ingredientsRevision,
    adminEditMode,
    stayAfterSave,
    onCancelPath,
  })

  const {
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
  } = summary

  const config = outputConfig ?? DEFAULT_OUTPUT_CONFIG
  const display = useMemo(
    () =>
      resolveOutputDisplayState({
        hasSavedSummary,
        isAdminEditor: isAdminEditor && adminEditing,
        savedSnapshot: savedOutputSnapshot,
        liveConfig: config,
      }),
    [hasSavedSummary, isAdminEditor, adminEditing, savedOutputSnapshot, config],
  )

  const baseVariants =
    display.variants.length > 0
      ? display.variants
      : DEFAULT_OUTPUT_CONFIG.outputVariants
  const baseUnitLabel = display.baseUnit || "กก."
  const hasMultipleOutputVariants = baseVariants.length > 1
  const useAdminSingleField = isAdminEditor && !hasMultipleOutputVariants

  const unitChoices = useMemo(() => {
    const options = new Map<string, number>()
    for (const option of config.unitOptions) {
      options.set(option.unit, option.conversionRate)
    }
    for (const variant of baseVariants) {
      if (!options.has(variant.unit)) {
        options.set(variant.unit, variant.conversionRate)
      }
    }
    return Array.from(options.entries()).map(([unit, conversionRate]) => ({
      unit,
      conversionRate,
    }))
  }, [config.unitOptions, baseVariants])

  const showAdminUnitPicker =
    useAdminSingleField && unitChoices.length > 0 && isKgUnit(config.masterUnit)

  const variants = useMemo<OutputVariant[]>(() => {
    if (!useAdminSingleField) return baseVariants
    const primary = baseVariants[0] ?? DEFAULT_OUTPUT_CONFIG.outputVariants[0]!
    const unit =
      adminSelectedUnit || primary.unit || config.defaultOutputUnit || "กก."
    const conversionRate = resolveConversionRateForUnit(unit, config.unitOptions)
    return [
      {
        ...primary,
        unit,
        conversionRate,
      },
    ]
  }, [
    useAdminSingleField,
    baseVariants,
    adminSelectedUnit,
    config.defaultOutputUnit,
    config.unitOptions,
  ])

  const inputMaterialKg = useMemo(() => {
    if (costPreview) return costPreview.inputMaterialQty
    return calculateInputKgFromIngredients(ingredients, inputUnitConversions)
  }, [costPreview, ingredients, inputUnitConversions])

  const resolveSellableQtyKey = useMemo(
    () =>
      useAdminSingleField
        ? (variant: OutputVariant, index: number) =>
            sellableQtyKey(variant, index, true)
        : undefined,
    [useAdminSingleField],
  )

  const sellableLines = useMemo(
    () =>
      buildOutputLinesFromFormState({
        variants,
        sellableQtys,
        scrapQty: scrapTouched ? scrapQty : "",
        scrapTouched,
        inputMaterialKg,
        resolveSellableQtyKey,
      }).filter((line) => line.kind === "sellable"),
    [
      variants,
      sellableQtys,
      scrapQty,
      scrapTouched,
      inputMaterialKg,
      resolveSellableQtyKey,
    ],
  )

  const outputLines = useMemo(
    () =>
      buildOutputLinesFromFormState({
        variants,
        sellableQtys,
        scrapQty: scrapTouched ? scrapQty : "",
        scrapTouched,
        inputMaterialKg,
        resolveSellableQtyKey,
      }),
    [variants, sellableQtys, scrapQty, scrapTouched, inputMaterialKg, resolveSellableQtyKey],
  )

  const aggregated = useMemo(() => aggregateOutputLines(outputLines), [outputLines])
  const hasSellableOutput = aggregated.sellableKg > 0

  const autoScrap = hasSellableOutput
    ? Math.max(0, inputMaterialKg - aggregated.sellableKg)
    : 0
  const parsedScrapQty = scrapTouched ? parseFloat(scrapQty) || 0 : autoScrap
  const scrapDisplayValue = scrapTouched ? scrapQty : autoScrap.toFixed(2)

  const balance = calculateProductionBalance(
    inputMaterialKg,
    aggregated.sellableKg,
    parsedScrapQty,
  )

  const yieldPercent = calculateYieldPercent(
    inputMaterialKg,
    aggregated.sellableKg,
    parsedScrapQty,
  )

  const materialCost = costPreview?.materialCost ?? 0
  const standardWorkMinutes =
    costPreview?.standardWorkMinutes ?? DEFAULT_STANDARD_WORK_MINUTES
  const parsedDailyWage = parseFloat(dailyWageInput) || 0
  const dailyWagePerPerson = summary.dailyWageTouched ? parsedDailyWage : 0
  const hourlyRate = calculateHourlyRateFromDailyWage(
    dailyWagePerPerson,
    standardWorkMinutes,
  )
  const calculatedLaborCost = costPreview
    ? calculateLaborCostFromDailyWage(
        dailyWagePerPerson,
        costPreview.operatorsCount,
        costPreview.timeUsedMinutes,
        standardWorkMinutes,
      )
    : 0
  const totalCost = materialCost + calculatedLaborCost
  const costBreakdown = hasSellableOutput
    ? calculateMultiOutputCostBreakdown(totalCost, outputLines)
    : null

  const handleSave = () =>
    save({
      outputLines,
      sellableLines,
      parsedScrapQty,
      dailyWagePerPerson,
      variants,
      balance,
    })

  const costPanelVisible =
    canViewCost && (showPreview || hasSavedSummary || hasSellableOutput)
  const costPanelReadOnly = viewMode === "saved"

  const outputFormFields = (
    <>
      <OutputLinesSection
        variants={variants}
        sellableQtys={sellableQtys}
        useAdminSingleField={useAdminSingleField}
        showAdminUnitPicker={showAdminUnitPicker}
        unitChoices={unitChoices}
        baseUnitLabel={baseUnitLabel}
        conversionVerified={display.conversionVerified}
        weightInputRef={weightInputRef}
        isLoading={isLoading}
        hasSellableOutput={hasSellableOutput}
        scrapTouched={scrapTouched}
        scrapDisplayValue={scrapDisplayValue}
        onSellableQtyChange={handleSellableQtyChange}
        onAdminUnitChange={setAdminSelectedUnit}
        onScrapChange={handleScrapChange}
      />
      <CostPreviewPanel
        visible={costPanelVisible}
        balance={balance}
        yieldPercent={yieldPercent}
        costPreview={costPreview}
        materialCost={materialCost}
        dailyWageInput={dailyWageInput}
        onDailyWageChange={handleDailyWageChange}
        isLoading={isLoading}
        dailyWagePerPerson={dailyWagePerPerson}
        hourlyRate={hourlyRate}
        calculatedLaborCost={calculatedLaborCost}
        totalCost={totalCost}
        costBreakdown={costBreakdown}
        baseUnitLabel={baseUnitLabel}
        conversionVerified={display.conversionVerified}
        dailyWageReadOnly={costPanelReadOnly}
      />
    </>
  )

  const handleAdminOpenChange = (open: boolean) => {
    if (open) {
      startAdminEdit()
      return
    }
    cancelAdminEdit()
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-3 md:p-5 space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลสินค้า...</p>
        )}

        {display.conversionWarnings.length > 0 && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950">
            <AlertTriangle className="text-amber-700" />
            <AlertTitle>อัตราแปลงหน่วยยังไม่ยืนยัน</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-0.5">
                {display.conversionWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              {display.fgCode ? (
                <p className="mt-1.5 text-xs">FG: {display.fgCode}</p>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

        {display.conversionInfos.length > 0 &&
          display.conversionWarnings.length === 0 && (
          <Alert className="border-blue-200 bg-blue-50 text-blue-950">
            <Info className="text-blue-700" />
            <AlertDescription>
              {display.conversionInfos.map((info) => (
                <p key={info}>{info}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {display.useSavedSnapshot && viewMode === "saved" && (
          <p className="text-xs text-muted-foreground">
            ใช้อัตราแปลง ณ ตอนบันทึก — ไม่เปลี่ยนตาม FG master ปัจจุบัน
          </p>
        )}

        {viewMode === "entry" && (
          <>
            {outputFormFields}
            <SummaryActions
              viewMode={viewMode}
              onCancel={() => cancelEntry(onCancelEntry)}
              onSave={handleSave}
              isSaving={isSaving}
              isLoading={isLoading}
            />
          </>
        )}

        {viewMode === "saved" && (
          <>
            <SavedSummaryDisplay
              variants={variants}
              sellableQtys={sellableQtys}
              scrapDisplayValue={scrapDisplayValue}
              baseUnitLabel={baseUnitLabel}
              useAdminSingleField={useAdminSingleField}
            />
            <CostPreviewPanel
              visible={costPanelVisible}
              balance={balance}
              yieldPercent={yieldPercent}
              costPreview={costPreview}
              materialCost={materialCost}
              dailyWageInput={dailyWageInput}
              onDailyWageChange={handleDailyWageChange}
              isLoading={isLoading}
              dailyWagePerPerson={dailyWagePerPerson}
              hourlyRate={hourlyRate}
              calculatedLaborCost={calculatedLaborCost}
              totalCost={totalCost}
              costBreakdown={costBreakdown}
              baseUnitLabel={baseUnitLabel}
              conversionVerified={display.conversionVerified}
              dailyWageReadOnly
            />
          </>
        )}

        {viewMode === "adminEditing" && (
          <AdminEditPanel
            open
            onOpenChange={handleAdminOpenChange}
            onSave={handleSave}
            onCancel={cancelAdminEdit}
            isSaving={isSaving}
            isLoading={isLoading}
          >
            {outputFormFields}
          </AdminEditPanel>
        )}
      </div>
    </Card>
  )
}
