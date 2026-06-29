import { describe, expect, it } from "vitest"
import { mapIngredients } from "./map-ingredients"

describe("mapIngredients", () => {
  it("maps FormulaWeighingLine fields to timer ingredients", () => {
    const result = mapIngredients({
      ingredients: [
        {
          id: "1",
          productCode: "235265",
          productName: "พริกแกงส้ม สูตร 2",
          plannedQuantity: "16",
          withdrawnQuantity: "16",
          withdrawnUnit: "กก.",
          plannedUnit: "กก.",
        },
      ],
    })

    expect(result).toEqual([
      {
        id: "1",
        code: "235265",
        name: "พริกแกงส้ม สูตร 2",
        quantity: "16",
        baseQuantity: undefined,
        plannedUnit: "กก.",
        actualWeight: "16",
        unit: "กก.",
        operatorWeighable: false,
        editableOnTimer: false,
      },
    ])
  })

  it("marks water as operator-weighable on timer", () => {
    const result = mapIngredients({
      batchCount: 2,
      ingredients: [
        {
          id: "3",
          productCode: "206004",
          productName: "น้ำเปล่า",
          plannedQuantity: "20",
          baseQuantity: "10",
          withdrawnQuantity: "",
          withdrawnUnit: "กก.",
          plannedUnit: "กก.",
        },
      ],
    })

    expect(result[0]?.operatorWeighable).toBe(true)
    expect(result[0]?.editableOnTimer).toBe(true)
    expect(result[0]?.quantity).toBe("20")
    expect(result[0]?.baseQuantity).toBe("10")
  })

  it("returns empty actualWeight when not weighed yet", () => {
    const result = mapIngredients({
      ingredients: [
        {
          id: "2",
          productCode: "501002",
          productName: "ซี่โครงอ่อน S-PURE - CT",
          plannedQuantity: "15",
          withdrawnQuantity: "",
          withdrawnUnit: "",
          plannedUnit: "กก.",
        },
      ],
    })

    expect(result[0]?.actualWeight).toBe("")
    expect(result[0]?.unit).toBe("กก.")
    expect(result[0]?.code).toBe("501002")
  })

  it("returns empty array when no ingredients", () => {
    expect(mapIngredients({ ingredients: [] })).toEqual([])
    expect(mapIngredients({})).toEqual([])
  })
})
