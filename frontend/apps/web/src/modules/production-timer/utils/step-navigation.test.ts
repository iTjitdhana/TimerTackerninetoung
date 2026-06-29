import { describe, expect, it } from "vitest"
import {
  canCompleteStep,
  canSelectStep,
  canStartStep,
  getActiveStepIndex,
  isViewOnlyStep,
} from "./step-navigation"
import type { StepRecord } from "../types"

function record(
  completed: boolean,
  startTime = "00:00",
  endTime = "00:00",
): StepRecord {
  return {
    stepName: "step",
    startTime,
    endTime,
    duration: "00:00",
    completed,
  }
}

describe("getActiveStepIndex", () => {
  it("returns 0 when no records", () => {
    expect(getActiveStepIndex([])).toBe(0)
  })

  it("returns first incomplete step", () => {
    const records = [record(true), record(true), record(false), record(false)]
    expect(getActiveStepIndex(records)).toBe(2)
  })

  it("returns last index when all completed", () => {
    const records = [record(true), record(true), record(true)]
    expect(getActiveStepIndex(records)).toBe(2)
  })
})

describe("canStartStep", () => {
  it("allows starting any not-started incomplete step", () => {
    const records = [
      record(false, "09:00", "00:00"),
      record(false),
      record(false),
    ]
    expect(canStartStep(0, records)).toBe(false)
    expect(canStartStep(1, records)).toBe(true)
    expect(canStartStep(2, records)).toBe(true)
  })
})

describe("canCompleteStep", () => {
  it("allows completing any in-progress step", () => {
    const records = [
      record(false, "09:00", "00:00"),
      record(false, "10:00", "00:00"),
      record(false),
    ]
    expect(canCompleteStep(0, records)).toBe(true)
    expect(canCompleteStep(1, records)).toBe(true)
    expect(canCompleteStep(2, records)).toBe(false)
  })
})

describe("isViewOnlyStep", () => {
  it("is view-only only when completed", () => {
    const records = [
      record(true),
      record(false, "09:00", "00:00"),
      record(false),
    ]
    expect(isViewOnlyStep(0, records)).toBe(true)
    expect(isViewOnlyStep(1, records)).toBe(false)
    expect(isViewOnlyStep(2, records)).toBe(false)
  })
})

describe("canSelectStep", () => {
  it("allows any valid step index for viewing", () => {
    const records = [record(true), record(false), record(false)]
    expect(canSelectStep(0, records)).toBe(true)
    expect(canSelectStep(2, records)).toBe(true)
  })
})
