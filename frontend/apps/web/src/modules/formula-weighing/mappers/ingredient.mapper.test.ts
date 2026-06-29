import { describe, expect, it } from "vitest"
import { lineFromApi, lineToApi } from "../mappers/ingredient.mapper"

describe("ingredient.mapper unitPrice", () => {
  it("maps unitPrice between API and UI line", () => {
    const api = {
      id: "1",
      code: "235265",
      name: "พริกแกง",
      quantity: "10",
      measuredWeight: "10",
      unit: "กก.",
      unitPrice: 42.5,
      unitPriceStatus: "fallback" as const,
      unitPriceFallbackReason: "ไม่มีราคาใน session ปัจจุบัน",
    }

    const line = lineFromApi(api)
    expect(line.unitPrice).toBe(42.5)
    expect(line.unitPriceStatus).toBe("fallback")
    expect(line.unitPriceFallbackReason).toBe("ไม่มีราคาใน session ปัจจุบัน")

    const back = lineToApi(line)
    expect(back.unitPrice).toBe(42.5)
    expect(back.unitPriceStatus).toBe("fallback")
  })

  it("keeps fields when mapping already-normalized UI lines (double normalize)", () => {
    const uiLine = lineFromApi({
      id: "bom-416002",
      code: "416002",
      name: "กะทิ UHT",
      quantity: "5",
      measuredWeight: "",
      unit: "กก.",
      note: "ทดสอบ",
      unitPrice: 349.3,
    })

    const remapped = lineFromApi(lineToApi(uiLine))
    expect(remapped.productCode).toBe("416002")
    expect(remapped.productName).toBe("กะทิ UHT")
    expect(remapped.plannedQuantity).toBe("5")
    expect(remapped.note).toBe("ทดสอบ")
    expect(remapped.unitPrice).toBe(349.3)
  })
})
