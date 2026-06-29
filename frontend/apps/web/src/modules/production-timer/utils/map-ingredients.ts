import type { FormulaWeighingRecord } from "@/modules/formula-weighing/services/formula-weighing.api"
import { formatWithdrawnQuantityDisplay } from "@/modules/formula-weighing/utils/withdrawn-quantity"
import {
  getPlannedUnitFromLine,
  getWithdrawnUnitFromLine,
} from "@/modules/formula-weighing/utils/weighing-unit-prefs"
import type { TimerIngredient } from "../types"
import { isOperatorWeighableMaterial } from "./operator-weighable-material"

export function mapIngredients(
  payload: Partial<FormulaWeighingRecord>,
): TimerIngredient[] {
  return (payload.ingredients ?? []).map((line) => {
    const operatorWeighable =
      line.operatorWeighable ??
      isOperatorWeighableMaterial(line.productCode, line.productName)

    return {
      id: line.id,
      code: line.productCode,
      name: line.productName,
      quantity: line.plannedQuantity,
      baseQuantity: line.baseQuantity,
      plannedUnit: line.plannedUnit,
      actualWeight: formatWithdrawnQuantityDisplay(line.withdrawnQuantity),
      unit: getWithdrawnUnitFromLine(line) || getPlannedUnitFromLine(line),
      operatorWeighable,
      editableOnTimer: line.editableOnTimer ?? operatorWeighable,
      unitPrice: line.unitPrice,
    }
  })
}
