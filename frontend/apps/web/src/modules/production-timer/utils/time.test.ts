import { describe, expect, it } from "vitest"
import {
  clockToInputValue,
  finalizeClockForSave,
  mapApiStepToRecord,
  maskClockInput,
  normalizeClockFromApi,
  resolveStepDisplayTimes,
} from "./time"

const BACKEND_TIME_REGEX = /^\d{2}:\d{2}(:\d{2})?$/

describe("normalizeClockFromApi", () => {
  it("preserves seconds when present", () => {
    expect(normalizeClockFromApi("09:15:42")).toBe("09:15:42")
  })

  it("keeps hour-minute when seconds absent", () => {
    expect(normalizeClockFromApi("09:15")).toBe("09:15")
  })
})

describe("mapApiStepToRecord", () => {
  it("maps API step fields including seconds", () => {
    expect(
      mapApiStepToRecord({
        stepName: "ต้ม",
        startTime: "09:15:42",
        endTime: "10:00:05",
        duration: "00:44:23",
        completed: true,
      }),
    ).toEqual({
      stepName: "ต้ม",
      startTime: "09:15:42",
      endTime: "10:00:05",
      duration: "00:44:23",
      completed: true,
    })
  })
})

describe("resolveStepDisplayTimes", () => {
  it("shows live clock with seconds when step is timing", () => {
    const start = new Date("2026-05-27T03:00:15.000Z")
    const now = new Date("2026-05-27T03:01:30.000Z")
    const result = resolveStepDisplayTimes(undefined, {
      isActive: true,
      isRunning: true,
      stepStartTime: start,
      now,
      withSeconds: true,
    })
    expect(result.inProgress).toBe(true)
    expect(result.duration).toBe("00:01:15")
    expect(result.startTime).toMatch(/:\d{2}$/)
    expect(result.startTime).not.toMatch(/:00$/)
  })
})

describe("clockToInputValue", () => {
  it("formats clock as 24h HH:MM:SS matching the table display", () => {
    expect(clockToInputValue("08:59:00")).toBe("08:59:00")
    expect(clockToInputValue("9:48")).toBe("09:48:00")
  })

  it("returns empty string for empty/zero clock values", () => {
    expect(clockToInputValue("")).toBe("")
    expect(clockToInputValue(undefined)).toBe("")
    expect(clockToInputValue("00:00")).toBe("")
    expect(clockToInputValue("00:00:00")).toBe("")
  })
})

describe("maskClockInput", () => {
  it("inserts colons automatically while typing digits", () => {
    expect(maskClockInput("0")).toBe("0")
    expect(maskClockInput("08")).toBe("08")
    expect(maskClockInput("0859")).toBe("08:59")
    expect(maskClockInput("085900")).toBe("08:59:00")
  })

  it("ignores extra/non-digit characters and never produces AM/PM", () => {
    expect(maskClockInput("08:59:00")).toBe("08:59:00")
    expect(maskClockInput("08:59:00 AM")).toBe("08:59:00")
    expect(maskClockInput("0859007")).toBe("08:59:00")
  })
})

describe("finalizeClockForSave", () => {
  it("pads to HH:MM:SS accepted by the backend regex", () => {
    expect(finalizeClockForSave("08:59")).toBe("08:59:00")
    expect(finalizeClockForSave("8:5:3")).toBe("08:05:03")
    expect(BACKEND_TIME_REGEX.test(finalizeClockForSave("08:59"))).toBe(true)
    expect(BACKEND_TIME_REGEX.test(finalizeClockForSave("10:17:00"))).toBe(true)
  })

  it("keeps empty values empty (optional field)", () => {
    expect(finalizeClockForSave("")).toBe("")
  })
})
