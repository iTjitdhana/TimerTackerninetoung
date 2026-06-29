import { describe, expect, it } from "vitest"
import {
  formatBangkokDateTimeShort,
  formatPriceSourceLabel,
} from "./price-source-label"

describe("price-source-label", () => {
  it("formats Bangkok datetime as d/m/yyyy HH:mm", () => {
    expect(formatBangkokDateTimeShort("2026-06-18T08:10:00.000Z")).toBe(
      "18/6/2026 15:10",
    )
  })

  it("builds plain source label with timestamp", () => {
    expect(
      formatPriceSourceLabel("api", "2026-06-18T08:10:00.000Z"),
    ).toBe("จาก API 18/6/2026 15:10")
    expect(formatPriceSourceLabel("manual")).toBe("คีย์เอง")
  })
})
