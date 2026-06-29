import type { FormulaWeighingLine, IngredientApi } from "../types"
import { withdrawnQuantityForInput } from "../utils/withdrawn-quantity"
import { roundUnitPrice } from "../utils/unit-price"

/** รองรับทั้ง JSON จาก API (code/name) และรูปแบบ UI (productCode/productName) */
type IngredientLike = IngredientApi & Partial<FormulaWeighingLine>

export function lineFromApi(raw: IngredientLike): FormulaWeighingLine {
  const withdrawnRaw = raw.measuredWeight ?? raw.withdrawnQuantity

  return {
    id: raw.id ?? "",
    productCode: raw.code ?? raw.productCode ?? "",
    productName: raw.name ?? raw.productName ?? "",
    plannedQuantity: raw.quantity ?? raw.plannedQuantity ?? "",
    withdrawnQuantity: withdrawnQuantityForInput(withdrawnRaw ?? ""),
    withdrawnUnit: raw.unit ?? raw.withdrawnUnit ?? "",
    plannedUnit: raw.formulaUnit ?? raw.plannedUnit,
    baseQuantity: raw.baseQuantity,
    isManual: raw.isManual,
    operatorWeighable: raw.operatorWeighable,
    editableOnTimer: raw.editableOnTimer,
    unitPrice: roundUnitPrice(raw.unitPrice),
    unitPriceStatus: raw.unitPriceStatus,
    unitPriceFallbackReason: raw.unitPriceFallbackReason,
    note: raw.note,
    unitPriceSource: raw.unitPriceSource,
    unitPriceSourceAt: raw.unitPriceSourceAt,
  }
}

export function lineToApi(line: FormulaWeighingLine): IngredientApi {
  return {
    id: line.id,
    code: line.productCode,
    name: line.productName,
    quantity: line.plannedQuantity,
    measuredWeight: line.withdrawnQuantity,
    unit: line.withdrawnUnit,
    formulaUnit: line.plannedUnit,
    baseQuantity: line.baseQuantity,
    isManual: line.isManual,
    operatorWeighable: line.operatorWeighable,
    editableOnTimer: line.editableOnTimer,
    unitPrice: roundUnitPrice(line.unitPrice),
    unitPriceStatus: line.unitPriceStatus,
    unitPriceFallbackReason: line.unitPriceFallbackReason,
    note: line.note,
    unitPriceSource: line.unitPriceSource,
    unitPriceSourceAt: line.unitPriceSourceAt,
  }
}

export function linesFromApi(rows: IngredientLike[]): FormulaWeighingLine[] {
  return rows.map(lineFromApi)
}

export function linesToApi(lines: FormulaWeighingLine[]): IngredientApi[] {
  return lines.map(lineToApi)
}
