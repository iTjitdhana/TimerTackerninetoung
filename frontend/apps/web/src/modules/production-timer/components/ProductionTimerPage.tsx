"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, ChevronDown, ClipboardList, Plus } from "lucide-react"
import { ProductionSummaryForm, normalizeOutputConfig } from "@/modules/production-summary"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import { AppShell } from "@/shared/layout/AppShell"
import { UserAvatar } from "@/shared/components/UserAvatar"
import { getAuthUserName } from "@/shared/lib/auth"
import { usePermissions } from "@/shared/hooks/usePermissions"
import { toast } from "@/shared/hooks/use-toast"
import { DEFAULT_BU_ID, ROGANG_BU_ID } from "@/shared/lib/bu-selection"
import { IngredientsPanel } from "./IngredientsPanel"
import { ProductionJobSelect } from "./ProductionJobSelect"
import { StepTimeline } from "./StepTimeline"
import { TimerControls } from "./TimerControls"
import { useProductionTimerSession } from "../hooks/useProductionTimerSession"
import { getDateDisplay } from "../utils/time"

export default function ProductionTimerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get("jobId")
  const sourceParam = searchParams.get("source")
  const [isIngredientsExpanded, setIsIngredientsExpanded] = useState(false)
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const producedWeightRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!jobId) {
      router.replace("/production-list")
    }
  }, [jobId, router])

  const sessionHook = useProductionTimerSession(jobId ?? "")
  const { canAction, canViewMenu } = usePermissions()
  const canAdminEditTimer = canAction("production_timer.admin_edit")
  const canAdminEditSummary = canAction("production_summary.admin_edit")

  const {
    session,
    productionSteps,
    allStepRecords,
    ingredients,
    batchCount,
    currentStepIndex,
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
  } = sessionHook

  useEffect(() => {
    if (session?.productionDate) {
      setSelectedDate(session.productionDate)
    }
  }, [session?.productionDate, jobId])

  const allStepsCompleted =
    productionSteps.length > 0 && allStepRecords.every((r) => r.completed)

  useEffect(() => {
    if (allStepsCompleted) setIsSummaryExpanded(true)
  }, [allStepsCompleted])

  if (!jobId) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-muted-foreground">กรุณาเลือกงานจากรายการผลิต...</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <AppShell
        title={sourceParam === "all-production" ? "งานผลิตทั้งหมด" : "งานผลิต"}
        shellClassName="bg-transparent"
      >
        <div className="p-6 text-center text-muted-foreground">กำลังโหลด...</div>
      </AppShell>
    )
  }

  if (loadError || !session) {
    return (
      <AppShell
        title={sourceParam === "all-production" ? "งานผลิตทั้งหมด" : "งานผลิต"}
        shellClassName="bg-transparent"
      >
        <div className="p-6 text-center text-destructive">{loadError ?? "ไม่พบข้อมูลงาน"}</div>
      </AppShell>
    )
  }

  const effectiveDate = selectedDate ?? session.productionDate
  const dateDisplay = getDateDisplay(effectiveDate)
  const isRogangJob = session.jobCode?.startsWith("RG") ?? false
  const isAdminViewer = canViewMenu("all_production_list")
  const jobListBuId = isAdminViewer
    ? undefined
    : isRogangJob
      ? ROGANG_BU_ID
      : DEFAULT_BU_ID
  const isViewingOtherDate = effectiveDate !== session.productionDate

  const handleComplete = async () => {
    const isLastStep = await completeStep()
    if (isLastStep) {
      toast({
        title: "จบขั้นตอนการผลิตแล้ว",
        description: "กรุณากรอกผลผลิตและบันทึกข้อมูล",
      })
      setTimeout(() => {
        producedWeightRef.current?.focus()
      }, 100)
    } else {
      toast({
        title: "บันทึกขั้นตอนแล้ว",
        description: "ไปยังขั้นตอนถัดไป",
      })
    }
  }

  const ingredientsBtnClass = (expanded: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors font-bold ${
      expanded
        ? "bg-red-800 border-red-800 text-white hover:bg-red-900"
        : "bg-white border-red-700 text-red-700 hover:bg-red-50"
    }`

  const headerExtra = (
    <div className="space-y-3">
      {/* แถว 1: วันที่ + เลือกงาน + ปุ่มวัตถุดิบ (md+ อยู่บรรทัดเดียวกัน) */}
      <div className="flex gap-2 md:gap-3 lg:gap-4 items-center">
        <div className="relative shrink-0">
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value)
            }}
            aria-label="เลือกวันที่"
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
          />
          <div className="flex flex-col items-center justify-center w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-lg border border-input bg-background cursor-pointer hover:bg-muted/30 transition-colors">
            <span className="text-base md:text-lg lg:text-xl font-bold text-foreground leading-none">
              {dateDisplay.day}
            </span>
            <span className="text-[10px] md:text-xs lg:text-sm text-muted-foreground leading-none mt-0.5">
              {dateDisplay.month}
            </span>
          </div>
        </div>

        <div className="flex-1 rounded-lg border border-input bg-background px-2 py-1 md:px-3 md:py-2 min-w-0">
          <ProductionJobSelect
            currentJobId={jobId}
            currentProductName={session.productName}
            productionDate={effectiveDate}
            buId={jobListBuId}
            sourceParam={sourceParam}
            isOtherDate={isViewingOtherDate}
          />
        </div>

        {/* ปุ่มวัตถุดิบ — md+ อยู่บรรทัดเดียวกัน */}
        {ingredients.length > 0 && !isViewingOtherDate && (
          <button
            onClick={() => setIsIngredientsExpanded(!isIngredientsExpanded)}
            className={`hidden md:flex whitespace-nowrap flex-shrink-0 ${ingredientsBtnClass(isIngredientsExpanded)}`}
          >
            <Plus className="w-4 h-4" />
            น้ำหนักวัตถุดิบก่อนผลิต
          </button>
        )}
      </div>

      {/* ปุ่มวัตถุดิบ — mobile เต็มความกว้าง แถวแยก */}
      {ingredients.length > 0 && !isViewingOtherDate && (
        <button
          onClick={() => setIsIngredientsExpanded(!isIngredientsExpanded)}
          className={`md:hidden w-full justify-center ${ingredientsBtnClass(isIngredientsExpanded)}`}
        >
          <Plus className="w-4 h-4" />
          น้ำหนักวัตถุดิบก่อนผลิต
        </button>
      )}

      {!isViewingOtherDate &&
        (session.operators.length > 0 ||
        session.scheduledStartTime ||
        session.scheduledEndTime ||
        session.notes) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-4 md:gap-y-2 pb-0.5 md:pb-1">
          {session.operators.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs md:text-base font-semibold text-foreground">ผู้ปฏิบัติงาน:</span>
              {session.operators.map((operator) => (
                <div
                  key={operator.employeeId ?? operator.name}
                  className="flex items-center gap-1"
                >
                  <UserAvatar
                    name={operator.name}
                    employeeId={operator.employeeId}
                    hasAvatar={operator.hasAvatar}
                    className="h-5 w-5 md:h-8 md:w-8 rounded-full border border-border"
                  />
                  <span className="text-xs font-medium text-foreground">{operator.name}</span>
                </div>
              ))}
            </div>
          )}
          {session.scheduledStartTime && session.scheduledEndTime && (
            <span className="text-xs md:text-base text-foreground">
              <span className="font-semibold">เวลา:</span> {session.scheduledStartTime}–{session.scheduledEndTime}
            </span>
          )}
          {session.notes && (
            <div className="bg-red-100 border border-red-300 text-red-800 px-2 py-0.5 md:px-3 md:py-1.5 rounded">
              <span className="text-xs md:text-base font-semibold">หมายเหตุ: {session.notes}</span>
            </div>
          )}
        </div>
      )}

      {formulaLoadError && (
        <p className="text-sm text-destructive font-medium">{formulaLoadError}</p>
      )}
    </div>
  )

  return (
    <AppShell
      title={sourceParam === "all-production" ? "งานผลิตทั้งหมด" : "งานผลิต"}
      currentUser={getAuthUserName()}
      headerExtra={headerExtra}
      shellClassName="bg-transparent"
    >
      <div className="p-3 md:p-5 lg:p-6">
        {isViewingOtherDate ? (
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-white/60 px-6 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CalendarDays className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg md:text-xl font-bold text-foreground">
                  คุณกำลังดูวันที่ {dateDisplay.day} {dateDisplay.month}
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  กรุณาเลือกงานที่ต้องการผลิตของวันนี้จากเมนูชื่องานด้านบน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(session.productionDate)}
                className="mt-1 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
              >
                กลับไปงานที่กำลังเปิดอยู่
              </button>
            </div>
          </div>
        ) : (
        <>
        {/* Sheet สำหรับ md+ — ไม่รบกวน grid layout */}
        <Dialog open={isIngredientsExpanded && ingredients.length > 0} onOpenChange={setIsIngredientsExpanded}>
          <DialogContent className="hidden md:flex flex-col max-w-5xl w-full max-h-[90vh] p-0 gap-0">
            <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
              <DialogTitle className="text-base font-semibold">น้ำหนักวัตถุดิบก่อนผลิต</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <IngredientsPanel
                ingredients={ingredients}
                batchCount={batchCount}
                onSaveOperatorWeighing={saveOperatorWeighing}
                isSaving={isSaving}
              />
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[420px_1fr] xl:grid-cols-[480px_1fr] lg:gap-6 lg:items-start max-w-7xl mx-auto pb-32 md:pb-0">
          {/* IngredientsPanel — inline บน mobile เท่านั้น */}
          {isIngredientsExpanded && ingredients.length > 0 && (
            <div className="md:hidden">
              <IngredientsPanel
                ingredients={ingredients}
                batchCount={batchCount}
                onSaveOperatorWeighing={saveOperatorWeighing}
                isSaving={isSaving}
              />
            </div>
          )}

          {/* TimerControls — order 1 (default) / grid col 1 row 1 */}
          <TimerControls
            productionSteps={productionSteps}
            currentStepIndex={currentStepIndex}
            currentRecord={currentRecord}
            isTimingCurrentStep={isTimingCurrentStep}
            stepStartTime={stepStartTime}
            isSaving={isSaving}
            canStartCurrentStep={canStartCurrentStep}
            canCompleteCurrentStep={canCompleteCurrentStep}
            onPreviousStep={() => goToStep(currentStepIndex - 1)}
            onNextStep={() => goToStep(currentStepIndex + 1)}
            onStart={() => void startStep()}
            onComplete={() => void handleComplete()}
          />

          {/* StepTimeline — order 2 on mobile / grid col 2 row 1-2 on desktop */}
          <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 flex flex-col gap-4">
            <StepTimeline
              stepRecords={allStepRecords}
              currentStepIndex={currentStepIndex}
              isTimingCurrentStep={isTimingCurrentStep}
              stepStartTime={stepStartTime}
              onSelectStep={goToStep}
              adminEditMode={canAdminEditTimer}
              isSaving={isSaving}
              onAdminSave={adminCorrectSteps}
            />
          </div>

          {/* SummaryForm — order 3 on mobile / grid col 1 row 2 on desktop */}
          <div className="order-3 lg:order-none">
            {/* mobile: collapsible header */}
            <button
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="md:hidden w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card font-semibold text-sm text-foreground"
            >
              <span className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                บันทึกผลผลิต
                {allStepsCompleted && (
                  <span className="text-xs text-green-600 font-normal">พร้อมบันทึก</span>
                )}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isSummaryExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {/* desktop: always visible / mobile: only when expanded */}
            <div className={isSummaryExpanded ? "mt-2 md:mt-0" : "hidden md:block"}>
              <ProductionSummaryForm
                jobId={jobId}
                stayAfterSave={isRogangJob || canAdminEditTimer}
                adminEditMode={canAdminEditSummary}
                onCancelEntry={() => setIsSummaryExpanded(false)}
                ingredientsRevision={ingredientsRevision}
                initialOutputConfig={
                  session?.outputConfig
                    ? normalizeOutputConfig(session.outputConfig)
                    : undefined
                }
                weightInputRef={producedWeightRef}
                ingredients={ingredients.map((ing) => ({
                  name: ing.name,
                  code: ing.code,
                  measuredWeight: ing.actualWeight,
                  unit: ing.unit,
                }))}
              />
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </AppShell>
  )
}
