"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Timer } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Card } from "@/shared/ui/card"
import { Input } from "@/shared/ui/input"
import { AdminCollapsiblePanel } from "@/shared/ui/admin-collapsible-panel"
import {
  formatMinutesAsThaiDuration,
} from "@/shared/lib/duration-format"
import type { StepRecord, TimerStep } from "../types"
import { canSelectStep, isViewOnlyStep } from "../utils/step-navigation"
import { timerTimeTheme } from "../utils/timer-theme"
import {
  clockToInputValue,
  finalizeClockForSave,
  isEmptyClockTime,
  maskClockInput,
  resolveStepDisplayTimes,
  resolveWallClockSpanMinutesFromDisplayTimes,
} from "../utils/time"

interface AdminStepDraft {
  stepName: string
  startTime: string
  endTime: string
  completed: boolean
}

interface StepTimelineProps {
  stepRecords: StepRecord[]
  currentStepIndex: number
  isTimingCurrentStep: boolean
  stepStartTime: Date | null
  onSelectStep: (index: number) => void
  adminEditMode?: boolean
  isSaving?: boolean
  onAdminSave?: (steps: TimerStep[], completedAt?: string) => Promise<void>
}

function recordToDraft(record: StepRecord): AdminStepDraft {
  return {
    stepName: record.stepName,
    startTime: clockToInputValue(record.startTime),
    endTime: clockToInputValue(record.endTime),
    completed: record.completed,
  }
}

export function StepTimeline({
  stepRecords,
  currentStepIndex,
  isTimingCurrentStep,
  stepStartTime,
  onSelectStep,
  adminEditMode = false,
  isSaving = false,
  onAdminSave,
}: StepTimelineProps) {
  const [drafts, setDrafts] = useState<AdminStepDraft[]>([])

  useEffect(() => {
    if (adminEditMode) {
      setDrafts(stepRecords.map(recordToDraft))
    }
  }, [adminEditMode, stepRecords])

  const totalDurationLabel = useMemo(() => {
    const displayTimesList = stepRecords.map((record, index) =>
      resolveStepDisplayTimes(record, {
        isActive: index === currentStepIndex,
        isRunning: index === currentStepIndex && isTimingCurrentStep,
        stepStartTime: index === currentStepIndex ? stepStartTime : null,
        withSeconds: true,
      }),
    )

    const totalMinutes = resolveWallClockSpanMinutesFromDisplayTimes(displayTimesList)
    return formatMinutesAsThaiDuration(totalMinutes)
  }, [
    stepRecords,
    currentStepIndex,
    isTimingCurrentStep,
    stepStartTime,
  ])

  const updateDraft = (
    index: number,
    patch: Partial<Pick<AdminStepDraft, "startTime" | "endTime" | "completed">>,
  ) => {
    setDrafts((prev) =>
      prev.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    )
  }

  const handleAdminSave = async () => {
    if (!onAdminSave) return
    const steps: TimerStep[] = drafts.map((draft) => ({
      stepName: draft.stepName,
      startTime: finalizeClockForSave(draft.startTime),
      endTime: finalizeClockForSave(draft.endTime),
      completed: draft.completed,
    }))
    const allCompleted =
      steps.length > 0 && steps.every((step) => step.completed)
    await onAdminSave(steps, allCompleted ? new Date().toISOString() : undefined)
  }

  return (
    <Card className="overflow-hidden flex-1">
      <div className="p-3 md:p-5">
        <h3 className="text-base md:text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0">
            <Timer className="w-3 h-3 text-white" />
          </span>
          ขั้นตอน-เวลาการผลิต
        </h3>
        <div className="rounded-xl border border-gray-400 overflow-hidden">
          {/* Mobile: card layout */}
          <div className="md:hidden divide-y divide-border/30 bg-card">
            {stepRecords.map((record, index) => {
              const selectable = canSelectStep(index, stepRecords)
              const viewOnly = isViewOnlyStep(index, stepRecords)
              const displayTimes = resolveStepDisplayTimes(record, {
                isActive: index === currentStepIndex,
                isRunning: index === currentStepIndex && isTimingCurrentStep,
                stepStartTime: index === currentStepIndex ? stepStartTime : null,
                withSeconds: true,
              })

              const rowBg = index === currentStepIndex
                ? viewOnly ? "bg-muted/40" : "bg-primary/10"
                : record.completed
                  ? "bg-success/5"
                  : displayTimes.inProgress
                    ? "bg-amber-50"
                    : "bg-background"

              return (
                <div
                  key={`m-${record.stepName}-${index}`}
                  onClick={() => selectable && onSelectStep(index)}
                  className={`p-3 transition-all cursor-pointer hover:bg-muted/50 ${rowBg}`}
                >
                  {/* ชื่อขั้นตอน */}
                  <div className="flex items-center gap-2 mb-2">
                    {record.completed && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                    {displayTimes.inProgress && !record.completed && <Timer className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                    <span className="font-semibold text-sm text-foreground leading-snug">{record.stepName}</span>
                  </div>
                  {/* เวลา */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className={`rounded-lg py-1.5 px-1 text-center ${timerTimeTheme.start.cell}`}>
                      <p className={`text-[9px] font-semibold leading-none mb-1 ${timerTimeTheme.start.label}`}>เริ่ม</p>
                      <p className={`text-xs font-bold tabular-nums font-sans ${!isEmptyClockTime(displayTimes.startTime) ? timerTimeTheme.start.value : "text-muted-foreground"}`}>
                        {displayTimes.startTime}
                      </p>
                    </div>
                    <div className={`rounded-lg py-1.5 px-1 text-center ${timerTimeTheme.end.cell}`}>
                      <p className={`text-[9px] font-semibold leading-none mb-1 ${timerTimeTheme.end.label}`}>สิ้นสุด</p>
                      <p className={`text-xs font-bold tabular-nums font-sans ${!isEmptyClockTime(displayTimes.endTime) ? timerTimeTheme.end.value : "text-muted-foreground"}`}>
                        {displayTimes.endTime}
                      </p>
                    </div>
                    <div className={`rounded-lg py-1.5 px-1 text-center ${timerTimeTheme.duration.cell}`}>
                      <p className={`text-[9px] font-semibold leading-none mb-1 ${timerTimeTheme.duration.label}`}>ใช้เวลา</p>
                      <p className={`text-xs font-bold tabular-nums font-sans ${displayTimes.inProgress || !isEmptyClockTime(displayTimes.duration) ? timerTimeTheme.duration.value : "text-muted-foreground"}`}>
                        {displayTimes.duration || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table layout (unchanged) */}
          <div className="hidden md:block">
            <div
              className="grid bg-muted/30 border-b border-border/40 text-xs font-semibold"
              style={{ gridTemplateColumns: "55% 15% 15% 15%" }}
            >
              <div className="p-3 border-r border-border/30 text-foreground">ขั้นตอน</div>
              <div className={`p-3 text-center border-r border-border/30 ${timerTimeTheme.start.label} ${timerTimeTheme.start.cell}`}>เริ่ม</div>
              <div className={`p-3 text-center border-r border-border/30 ${timerTimeTheme.end.label} ${timerTimeTheme.end.cell}`}>สิ้นสุด</div>
              <div className={`p-3 text-center ${timerTimeTheme.duration.label} ${timerTimeTheme.duration.cell}`}>ใช้เวลา</div>
            </div>
            <div className="bg-card">
              {stepRecords.map((record, index) => {
                const selectable = canSelectStep(index, stepRecords)
                const viewOnly = isViewOnlyStep(index, stepRecords)
                const displayTimes = resolveStepDisplayTimes(record, {
                  isActive: index === currentStepIndex,
                  isRunning: index === currentStepIndex && isTimingCurrentStep,
                  stepStartTime: index === currentStepIndex ? stepStartTime : null,
                  withSeconds: true,
                })

                return (
                  <div
                    key={`d-${record.stepName}-${index}`}
                    onClick={() => selectable && onSelectStep(index)}
                    className={`grid gap-0 transition-all cursor-pointer hover:bg-muted/50 ${
                      index === currentStepIndex
                        ? viewOnly ? "bg-muted/40 ring-1 ring-border" : "bg-primary/10"
                        : record.completed
                          ? "bg-success/5"
                          : displayTimes.inProgress ? "bg-amber-50" : "bg-background"
                    } ${index !== stepRecords.length - 1 ? "border-b border-border/30" : ""}`}
                    style={{ gridTemplateColumns: "55% 15% 15% 15%" }}
                  >
                    <div className="p-4 font-semibold text-base text-foreground border-r border-border/30 flex items-center gap-2">
                      {record.completed && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                      {displayTimes.inProgress && !record.completed && <Timer className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                      {record.stepName}
                    </div>
                    <div className={`p-4 border-r border-border/30 ${timerTimeTheme.start.cell}`}>
                      <div className={`text-base font-bold font-sans text-center tabular-nums ${!isEmptyClockTime(displayTimes.startTime) ? timerTimeTheme.start.value : "text-muted-foreground"}`}>
                        {displayTimes.startTime}
                      </div>
                    </div>
                    <div className={`p-4 border-r border-border/30 ${timerTimeTheme.end.cell}`}>
                      <div className={`text-base font-bold font-sans text-center tabular-nums ${!isEmptyClockTime(displayTimes.endTime) ? timerTimeTheme.end.value : "text-muted-foreground"}`}>
                        {displayTimes.endTime}
                      </div>
                    </div>
                    <div className={`p-4 ${timerTimeTheme.duration.cell}`}>
                      <div className={`text-base font-bold font-sans text-center tabular-nums ${displayTimes.inProgress || !isEmptyClockTime(displayTimes.duration) ? timerTimeTheme.duration.value : "text-muted-foreground"}`}>
                        {displayTimes.duration || "-"}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <p className="mt-3 text-base md:text-lg font-semibold text-foreground">
          เวลารวมที่ใช้{" "}
          <span className={`text-lg md:text-xl font-bold ${timerTimeTheme.duration.value}`}>
            {totalDurationLabel}
          </span>
        </p>

        {adminEditMode && onAdminSave && stepRecords.length > 0 && (
          <AdminCollapsiblePanel
            className="mt-2"
            description="แก้เวลาแล้วกดบันทึก — ไม่เปลี่ยนผู้ปฏิบัติงาน"
            defaultOpen={false}
          >
            <div className="space-y-2">
              {drafts.map((draft, index) => (
                <div
                  key={draft.stepName}
                  className="rounded-lg border border-amber-300/80 bg-white p-2.5 space-y-2"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {index + 1}. {draft.stepName}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">เริ่ม</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="ชม:นาที:วิ"
                        maxLength={8}
                        pattern="\d{2}:\d{2}:\d{2}"
                        value={draft.startTime}
                        onChange={(event) =>
                          updateDraft(index, { startTime: maskClockInput(event.target.value) })
                        }
                        className="h-9 font-sans tabular-nums text-center"
                        disabled={isSaving}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">สิ้นสุด</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="ชม:นาที:วิ"
                        maxLength={8}
                        pattern="\d{2}:\d{2}:\d{2}"
                        value={draft.endTime}
                        onChange={(event) =>
                          updateDraft(index, { endTime: maskClockInput(event.target.value) })
                        }
                        className="h-9 font-sans tabular-nums text-center"
                        disabled={isSaving}
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.completed}
                      onChange={(event) =>
                        updateDraft(index, { completed: event.target.checked })
                      }
                      disabled={isSaving}
                      className="rounded border-input"
                    />
                    <span>เสร็จสิ้นแล้ว</span>
                  </label>
                </div>
              ))}
            </div>

            <Button
              className="w-full h-9 text-sm font-semibold bg-amber-700 hover:bg-amber-800 text-white"
              onClick={() => void handleAdminSave()}
              disabled={isSaving}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไขเวลา"}
            </Button>
          </AdminCollapsiblePanel>
        )}
      </div>
    </Card>
  )
}
