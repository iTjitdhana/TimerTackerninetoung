import { describe, expect, it } from "vitest"
import {
  formatMinutesAsThaiDuration,
  parseDurationClockToSeconds,
} from "./duration-format"

describe("duration-format", () => {
  it("formats minutes as Thai duration", () => {
    expect(formatMinutesAsThaiDuration(270)).toBe("4 ชม. 30 นาที")
    expect(formatMinutesAsThaiDuration(520)).toBe("8 ชม. 40 นาที")
  })

  it("parses HH:mm:ss duration clock", () => {
    expect(parseDurationClockToSeconds("01:23:00")).toBe(4980)
    expect(parseDurationClockToSeconds("03:25:00")).toBe(12300)
  })
})
