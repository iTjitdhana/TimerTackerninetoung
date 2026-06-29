"use client"

import { CheckCircle2, ChevronLeft, ChevronRight, Play } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Card } from "@/shared/ui/card"
import type { ProductionStep, StepRecord } from "../types"
import { timerTimeTheme } from "../utils/timer-theme"
import {
  isEmptyClockTime,
  resolveStepDisplayTimes,
} from "../utils/time"

interface TimerControlsProps {
  productionSteps: ProductionStep[]
  currentStepIndex: number
  currentRecord?: StepRecord
  isTimingCurrentStep: boolean
  stepStartTime: Date | null
  isSaving: boolean
  canStartCurrentStep: boolean
  canCompleteCurrentStep: boolean
  onPreviousStep: () => void
  onNextStep: () => void
  onStart: () => void
  onComplete: () => void
}

export function TimerControls({
  productionSteps,
  currentStepIndex,
  currentRecord,
  isTimingCurrentStep,
  stepStartTime,
  isSaving,
  canStartCurrentStep,
  canCompleteCurrentStep,
  onPreviousStep,
  onNextStep,
  onStart,
  onComplete,
}: TimerControlsProps) {
  const currentStep = productionSteps[currentStepIndex]
  const isStepCompleted = Boolean(currentRecord?.completed)
  const currentStepTimes = resolveStepDisplayTimes(currentRecord, {
    isActive: true,
    isRunning: isTimingCurrentStep,
    stepStartTime,
    withSeconds: true,
  })

  const actionContent = isStepCompleted ? (
    <div
      role="status"
      className="flex items-center justify-center gap-2 h-11 md:h-16 rounded-lg bg-muted/50 border-2 border-border text-muted-foreground font-semibold text-sm md:text-lg"
    >
      <CheckCircle2 className="w-5 h-5 md:w-7 md:h-7 shrink-0" />
      ขั้นตอนนี้เสร็จสิ้นแล้ว
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-2 md:gap-3">
      <Button
        onClick={onStart}
        disabled={isTimingCurrentStep || !canStartCurrentStep || isSaving}
        className="h-11 md:h-16 text-sm md:text-lg font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
      >
        <Play className="w-4 h-4 md:w-6 md:h-6 mr-1.5 md:mr-2" />
        {isTimingCurrentStep ? "กำลังจับเวลา..." : "เริ่ม"}
      </Button>
      <Button
        onClick={onComplete}
        disabled={!canCompleteCurrentStep || isSaving}
        className="h-11 md:h-16 text-sm md:text-lg font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
      >
        <CheckCircle2 className="w-4 h-4 md:w-6 md:h-6 mr-1.5 md:mr-2" />
        เสร็จสิ้น
      </Button>
    </div>
  )

  return (
    <>
    <Card className="overflow-hidden">
      <div className="p-3 md:p-5">
        {/* หัว: ปุ่มเปลี่ยนขั้นตอน + ชื่อ */}
        <div className="flex items-center gap-2 md:gap-4 mb-3 md:mb-4">
          <Button
            variant="default"
            size="icon"
            onClick={onPreviousStep}
            disabled={currentStepIndex === 0 || isSaving}
            className="h-9 w-9 md:h-12 md:w-12 bg-primary hover:bg-primary/90 shadow-lg disabled:opacity-30 flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4 md:w-6 md:h-6" />
          </Button>

          <div className="flex-1 text-center">
            <h3 className="font-bold text-foreground text-base md:text-2xl leading-tight">
              {currentStep?.name}
            </h3>
            <p className="text-[11px] md:text-sm text-muted-foreground mt-0.5">
              ขั้นตอนที่ {currentStepIndex + 1} จาก {productionSteps.length}
              {isStepCompleted && (
                <span className="hidden md:block text-muted-foreground font-medium">บันทึกเสร็จแล้ว — ดูย้อนหลังได้</span>
              )}
            </p>
          </div>

          <Button
            variant="default"
            size="icon"
            onClick={onNextStep}
            disabled={currentStepIndex >= productionSteps.length - 1 || isSaving}
            className="h-9 w-9 md:h-12 md:w-12 bg-primary hover:bg-primary/90 shadow-lg disabled:opacity-30 flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
          </Button>
        </div>

        {/* กล่องเวลา 3 ช่อง */}
        <div className="grid grid-cols-3 gap-1.5 md:gap-3 mb-3 md:mb-4">
          <div
            className={`p-2 md:p-4 rounded-lg transition-all ${timerTimeTheme.start.box} ${!isEmptyClockTime(currentStepTimes.startTime) ? timerTimeTheme.start.boxActive : ""}`}
          >
            <div className="text-center">
              <span className={`text-[10px] md:text-sm font-semibold block mb-0.5 md:mb-1 ${timerTimeTheme.start.label}`}>
                เวลาเริ่ม
              </span>
              <span className={`text-sm md:text-xl font-bold block font-sans tabular-nums ${timerTimeTheme.start.value}`}>
                {currentStepTimes.startTime}
              </span>
            </div>
          </div>
          <div
            className={`p-2 md:p-4 rounded-lg transition-all ${timerTimeTheme.end.box} ${!isEmptyClockTime(currentStepTimes.endTime) ? timerTimeTheme.end.boxActive : ""}`}
          >
            <div className="text-center">
              <span className={`text-[10px] md:text-sm font-semibold block mb-0.5 md:mb-1 ${timerTimeTheme.end.label}`}>
                เวลาสิ้นสุด
              </span>
              <span className={`text-sm md:text-xl font-bold block font-sans tabular-nums ${timerTimeTheme.end.value}`}>
                {currentStepTimes.endTime}
              </span>
            </div>
          </div>
          <div
            className={`p-2 md:p-4 rounded-lg transition-all ${timerTimeTheme.duration.box} ${currentStepTimes.inProgress || !isEmptyClockTime(currentStepTimes.duration) ? timerTimeTheme.duration.boxActive : ""}`}
          >
            <div className="text-center">
              <span className={`text-[10px] md:text-sm font-semibold block mb-0.5 md:mb-1 ${timerTimeTheme.duration.label}`}>
                เวลาที่ใช้
              </span>
              <span className={`text-sm md:text-xl font-bold block font-sans tabular-nums ${timerTimeTheme.duration.value}`}>
                {currentStepTimes.duration}
              </span>
            </div>
          </div>
        </div>

        {/* ปุ่มการกระทำ */}
        {/* ปุ่ม action — ซ่อนบน mobile (แสดงใน sticky bar แทน) */}
        <div className="hidden md:block">
          {actionContent}
        </div>
      </div>
    </Card>

    {/* Sticky bar — mobile only */}
    <div
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border px-3 pt-2"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <p className="text-[10px] text-center text-muted-foreground mb-1.5 truncate">{currentStep?.name}</p>
      {actionContent}
    </div>
  </>
  )
}
