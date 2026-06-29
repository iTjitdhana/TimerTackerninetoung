import { describe, expect, it } from "vitest"
import { buildStepsPayload } from "./step-payload"
import type { StepRecord } from "../types"

function record(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    stepName: "ขั้นตอน",
    startTime: "00:00",
    endTime: "00:00",
    duration: "00:00",
    completed: false,
    ...overrides,
  }
}

describe("buildStepsPayload", () => {
  it("patches only the target step and preserves completed steps", () => {
    const records = [
      record({
        stepName: "A",
        startTime: "09:00",
        endTime: "09:30",
        duration: "00:30",
        completed: true,
      }),
      record({ stepName: "B" }),
    ]

    const payload = buildStepsPayload(records, 1, {
      startTime: "10:00",
      completed: false,
    })

    expect(payload[0]).toEqual({
      stepName: "A",
      startTime: "09:00",
      endTime: "09:30",
      duration: "00:30",
      completed: true,
    })
    expect(payload[1]).toEqual({
      stepName: "B",
      startTime: "10:00",
      completed: false,
    })
  })
})
