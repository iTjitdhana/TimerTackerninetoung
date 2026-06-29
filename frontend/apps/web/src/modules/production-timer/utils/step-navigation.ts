import type { StepRecord } from "../types"
import { isStepInProgress } from "./time"

/** First incomplete step, or last step when all are completed. */
export function getActiveStepIndex(records: StepRecord[]): number {
  if (records.length === 0) return 0
  const firstIncomplete = records.findIndex((record) => !record.completed)
  if (firstIncomplete === -1) return records.length - 1
  return firstIncomplete
}

/** View any step. */
export function canSelectStep(index: number, records: StepRecord[]): boolean {
  return index >= 0 && index < records.length
}

/** เริ่มได้ทุกขั้นที่ยังไม่ completed และยังไม่มีเวลาเริ่ม */
export function canStartStep(index: number, records: StepRecord[]): boolean {
  if (!canSelectStep(index, records)) return false
  const record = records[index]
  return !record.completed && !isStepInProgress(record)
}

/** เสร็จได้เมื่อขั้นนั้นเริ่มแล้วแต่ยังไม่จบ */
export function canCompleteStep(index: number, records: StepRecord[]): boolean {
  if (!canSelectStep(index, records)) return false
  const record = records[index]
  return !record.completed && isStepInProgress(record)
}

/** ดูอย่างเดียวเมื่อจบแล้ว */
export function isViewOnlyStep(index: number, records: StepRecord[]): boolean {
  if (!canSelectStep(index, records)) return true
  return records[index].completed
}
