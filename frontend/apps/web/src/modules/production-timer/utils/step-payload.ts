import type { StepRecord, TimerStep } from "../types"

export function recordToTimerStep(record: StepRecord): TimerStep {
  return {
    stepName: record.stepName,
    startTime: record.startTime !== "00:00" ? record.startTime : undefined,
    endTime: record.endTime !== "00:00" ? record.endTime : undefined,
    duration: record.duration !== "00:00" ? record.duration : undefined,
    completed: record.completed,
  }
}

export function recordsToTimerSteps(records: StepRecord[]): TimerStep[] {
  return records.map(recordToTimerStep)
}

export type StepRecordPatch = Partial<
  Pick<StepRecord, "startTime" | "endTime" | "duration" | "completed">
>

/** Apply a patch to one step; other steps keep their values. */
export function buildStepsPayload(
  records: StepRecord[],
  mutateIndex: number,
  patch: StepRecordPatch,
): TimerStep[] {
  return records.map((record, index) => {
    if (index !== mutateIndex) {
      return recordToTimerStep(record)
    }
    return recordToTimerStep({ ...record, ...patch })
  })
}
