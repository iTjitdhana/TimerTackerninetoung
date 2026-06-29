import { describe, expect, it } from "vitest"
import { splitIngredients } from "../components/IngredientsPanel"
import type { TimerIngredient } from "../types"

describe("splitIngredients", () => {
  it("separates formula-weighed items from operator tasks", () => {
    const items: TimerIngredient[] = [
      {
        id: "1",
        code: "235265",
        name: "พริกแกงส้ม",
        quantity: "16",
        actualWeight: "16",
        unit: "กก.",
        editableOnTimer: false,
      },
      {
        id: "2",
        code: "206004",
        name: "น้ำเปl่a",
        quantity: "20",
        baseQuantity: "10",
        actualWeight: "",
        unit: "กก.",
        editableOnTimer: true,
      },
    ]

    const { formulaWeighed, operatorTasks } = splitIngredients(items)

    expect(formulaWeighed).toHaveLength(1)
    expect(formulaWeighed[0]?.code).toBe("235265")
    expect(operatorTasks).toHaveLength(1)
    expect(operatorTasks[0]?.code).toBe("206004")
  })
})
