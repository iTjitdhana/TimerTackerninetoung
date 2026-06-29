import { describe, expect, it } from "vitest"
import {
  formatUnitPriceInput,
  limitUnitPriceInput,
  roundUnitPrice,
} from "./unit-price"

describe("unit-price", () => {
  it("rounds to 2 decimal places", () => {
    expect(roundUnitPrice(31.517647)).toBe(31.52)
    expect(roundUnitPrice(125.777)).toBe(125.78)
  })

  it("formats input with 2 decimals", () => {
    expect(formatUnitPriceInput(31.5)).toBe("31.50")
    expect(formatUnitPriceInput(31.517647)).toBe("31.52")
  })

  it("limits typing to 2 decimal places", () => {
    expect(limitUnitPriceInput("31.517647")).toBe("31.51")
    expect(limitUnitPriceInput("125.7")).toBe("125.7")
  })
})
