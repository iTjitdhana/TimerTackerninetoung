import type { FormulaWeighingLine } from "../types"

export const MOCK_LINES: Record<string, FormulaWeighingLine[]> = {
  "1": [
    {
      id: "1",
      productCode: "A-001",
      productName: "น้ำ",
      plannedQuantity: "500",
      withdrawnQuantity: "",
      withdrawnUnit: "ml",
      plannedUnit: "ml",
    },
    {
      id: "2",
      productCode: "A-002",
      productName: "พริก",
      plannedQuantity: "100",
      withdrawnQuantity: "",
      withdrawnUnit: "กรัม",
      plannedUnit: "กรัม",
    },
  ],
}
