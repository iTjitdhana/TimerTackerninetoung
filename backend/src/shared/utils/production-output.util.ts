import { isKgUnit } from "./output-quantity.util";

export type OutputLineKind = "sellable" | "scrap";

export interface ProductionOutputLineInput {
  kind: OutputLineKind;
  label: string;
  qty: number;
  unit: string;
  conversionRate: number;
}

export interface ProductionOutputLine extends ProductionOutputLineInput {
  weightKg: number;
}

export interface AggregatedOutputLines {
  sellableLines: ProductionOutputLine[];
  scrapLine: ProductionOutputLine | null;
  sellableKg: number;
  scrapKg: number;
  totalOutputKg: number;
}

export interface OutputLineCost {
  label: string;
  unit: string;
  qty: number;
  weightKg: number;
  lineTotalCost: number;
  costPerUnit: number | null;
}

export interface MultiOutputCostBreakdown {
  totalCost: number;
  sellableKg: number;
  scrapKg: number;
  costPerSellableKg: number | null;
  sellableLineCosts: OutputLineCost[];
  scrapCost: number;
}

export function lineWeightKg(
  qty: number,
  unit: string,
  conversionRate: number,
): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (isKgUnit(unit)) return qty;
  const rate =
    Number.isFinite(conversionRate) && conversionRate > 0 ? conversionRate : 1;
  return qty * rate;
}

export function normalizeOutputLine(
  input: ProductionOutputLineInput,
): ProductionOutputLine {
  const conversionRate =
    input.kind === "scrap" && isKgUnit(input.unit)
      ? 1
      : Number.isFinite(input.conversionRate) && input.conversionRate > 0
        ? input.conversionRate
        : 1;

  return {
    ...input,
    conversionRate,
    weightKg: lineWeightKg(input.qty, input.unit, conversionRate),
  };
}

export function aggregateOutputLines(
  lines: ProductionOutputLineInput[],
): AggregatedOutputLines {
  const normalized = lines.map(normalizeOutputLine);
  const sellableLines = normalized.filter((line) => line.kind === "sellable");
  const scrapLines = normalized.filter((line) => line.kind === "scrap");
  const sellableKg = sellableLines.reduce((sum, line) => sum + line.weightKg, 0);
  const scrapKg = scrapLines.reduce((sum, line) => sum + line.weightKg, 0);

  return {
    sellableLines,
    scrapLine: scrapLines[0] ?? null,
    sellableKg,
    scrapKg,
    totalOutputKg: sellableKg + scrapKg,
  };
}

export function resolvePrimarySellableLine(
  sellableLines: ProductionOutputLine[],
): ProductionOutputLine | null {
  if (sellableLines.length === 0) return null;

  return sellableLines.reduce((primary, line) =>
    line.weightKg > primary.weightKg ? line : primary,
  );
}

export function buildOutputLinesFromLegacy(params: {
  outputQty: number;
  outputUnit: string;
  conversionRate: number;
  label?: string;
  scrapQty?: number;
}): ProductionOutputLineInput[] {
  const lines: ProductionOutputLineInput[] = [];

  if (params.outputQty > 0) {
    lines.push({
      kind: "sellable",
      label: params.label?.trim() || params.outputUnit,
      qty: params.outputQty,
      unit: params.outputUnit,
      conversionRate: isKgUnit(params.outputUnit) ? 1 : params.conversionRate,
    });
  }

  if (params.scrapQty != null && params.scrapQty > 0) {
    lines.push({
      kind: "scrap",
      label: "เศษ",
      qty: params.scrapQty,
      unit: "กก.",
      conversionRate: 1,
    });
  }

  return lines;
}

export function calculateMultiOutputCostBreakdown(
  totalCost: number,
  lines: ProductionOutputLineInput[],
): MultiOutputCostBreakdown {
  const aggregated = aggregateOutputLines(lines);
  const { sellableKg, scrapKg, sellableLines } = aggregated;

  if (totalCost <= 0 || sellableKg <= 0) {
    return {
      totalCost,
      sellableKg,
      scrapKg,
      costPerSellableKg: null,
      sellableLineCosts: [],
      scrapCost: 0,
    };
  }

  const costPerSellableKg = totalCost / sellableKg;
  const sellableLineCosts = sellableLines.map((line) => {
    const lineTotalCost = costPerSellableKg * line.weightKg;
    return {
      label: line.label,
      unit: line.unit,
      qty: line.qty,
      weightKg: line.weightKg,
      lineTotalCost,
      costPerUnit: line.qty > 0 ? lineTotalCost / line.qty : null,
    };
  });
  const scrapCost = costPerSellableKg * scrapKg;

  return {
    totalCost,
    sellableKg,
    scrapKg,
    costPerSellableKg,
    sellableLineCosts,
    scrapCost,
  };
}

export function resolveScrapKg(params: {
  inputMaterialKg: number;
  sellableKg: number;
  scrapQty?: number;
  scrapTouched?: boolean;
}): number {
  if (params.scrapTouched && params.scrapQty != null) {
    return Math.max(0, params.scrapQty);
  }

  return Math.max(0, params.inputMaterialKg - params.sellableKg);
}
