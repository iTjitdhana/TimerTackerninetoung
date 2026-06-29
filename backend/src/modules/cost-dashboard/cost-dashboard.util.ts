export interface ProcessExecutionRow {
  process_number: number;
  status: string | null;
  start_time: Date | null;
  end_time: Date | null;
}

export type TimerStatus = "ok" | "warn" | "no_data";

export interface StepLogTimingLike {
  completed: boolean;
}

/** ให้ตรงกับ Production Timer (`mapExecutionToStep`) */
export function isExecutionStepComplete(
  execution: ProcessExecutionRow,
  logTiming?: StepLogTimingLike,
): boolean {
  return (
    execution.status === "completed" ||
    Boolean(logTiming?.completed) ||
    (execution.start_time != null && execution.end_time != null)
  );
}

export function resolveTimerStatusForCost(params: {
  batchExecutions?: ProcessExecutionRow[];
  workPlanExecutions?: ProcessExecutionRow[];
  logTimings?: Map<number, StepLogTimingLike>;
  timeUsedMinutes?: number | null;
}): TimerStatus {
  const workPlanExecutions = params.workPlanExecutions ?? [];
  const batchExecutions = params.batchExecutions ?? [];
  // Production Timer อ่าน executions จาก work_plan_id เป็นหลัก
  const primaryExecutions =
    workPlanExecutions.length > 0 ? workPlanExecutions : batchExecutions;

  if (primaryExecutions.length > 0) {
    const allComplete = primaryExecutions.every((execution) =>
      isExecutionStepComplete(
        execution,
        params.logTimings?.get(execution.process_number),
      ),
    );
    return allComplete ? "ok" : "warn";
  }

  const logTimings = params.logTimings;
  if (logTimings && logTimings.size > 0) {
    const allLogsComplete = [...logTimings.values()].every(
      (timing) => timing.completed,
    );
    return allLogsComplete ? "ok" : "warn";
  }

  if ((params.timeUsedMinutes ?? 0) > 0) return "warn";
  return "no_data";
}

export interface ProductionDataCompleteness {
  percent: number;
  hasMaterialWeighing: boolean;
  hasTimerData: boolean;
  hasOutputQty: boolean;
}

export function hasMaterialWeighingData(params: {
  inputMaterialQty?:
    | { toNumber?: () => number }
    | number
    | string
    | null
    | undefined;
  materialCost?:
    | { toNumber?: () => number }
    | number
    | string
    | null
    | undefined;
  batchHasWeighingRecords?: boolean;
}): boolean {
  if (toDecimalNumber(params.inputMaterialQty) > 0) return true;
  if (toDecimalNumber(params.materialCost) > 0) return true;
  return Boolean(params.batchHasWeighingRecords);
}

export function hasOutputQuantityData(params: {
  outputQty?:
    | { toNumber?: () => number }
    | number
    | string
    | null
    | undefined;
  batchResult?: BatchYieldSource | null;
}): boolean {
  if (toDecimalNumber(params.outputQty) > 0) return true;
  if (!params.batchResult) return false;

  const sellableKg = resolveSellableKgFromBatch(params.batchResult);
  if (sellableKg != null && sellableKg > 0) return true;

  return toDecimalNumber(params.batchResult.good_qty) > 0;
}

export function resolveProductionDataCompleteness(params: {
  inputMaterialQty?:
    | { toNumber?: () => number }
    | number
    | string
    | null
    | undefined;
  materialCost?:
    | { toNumber?: () => number }
    | number
    | string
    | null
    | undefined;
  batchHasWeighingRecords?: boolean;
  outputQty?:
    | { toNumber?: () => number }
    | number
    | string
    | null
    | undefined;
  batchResult?: BatchYieldSource | null;
  timerStatus: TimerStatus;
}): ProductionDataCompleteness {
  const hasMaterialWeighing = hasMaterialWeighingData({
    inputMaterialQty: params.inputMaterialQty,
    materialCost: params.materialCost,
    batchHasWeighingRecords: params.batchHasWeighingRecords,
  });
  const hasTimerData = params.timerStatus === "ok";
  const hasOutputQty = hasOutputQuantityData({
    outputQty: params.outputQty,
    batchResult: params.batchResult,
  });

  const completedCount = [hasMaterialWeighing, hasTimerData, hasOutputQty].filter(
    Boolean,
  ).length;

  return {
    percent: Math.round((completedCount / 3) * 100),
    hasMaterialWeighing,
    hasTimerData,
    hasOutputQty,
  };
}

export function toDecimalNumber(
  value: { toNumber?: () => number } | number | string | null | undefined,
): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value.toNumber === "function") {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function calculateYieldPercent(
  inputMaterialKg: number,
  sellableKg: number,
  scrapKg: number,
): number | null {
  if (inputMaterialKg <= 0) return null;
  return ((sellableKg + scrapKg) / inputMaterialKg) * 100;
}

export interface BatchYieldSource {
  good_qty: { toNumber?: () => number } | number | string;
  good_secondary_qty:
    | { toNumber?: () => number }
    | number
    | string
    | null;
  defect_qty: { toNumber?: () => number } | number | string;
}

export function resolveSellableKgFromBatch(
  batchResult: BatchYieldSource,
): number | null {
  const secondaryKg = toDecimalNumber(batchResult.good_secondary_qty);
  if (secondaryKg > 0) return secondaryKg;

  // legacy rows may store sellable weight directly in good_qty (kg)
  if (batchResult.good_secondary_qty == null) {
    const legacyKg = toDecimalNumber(batchResult.good_qty);
    return legacyKg > 0 ? legacyKg : null;
  }

  return null;
}

export function resolveYieldPercentFromBatch(
  inputMaterialQty: { toNumber?: () => number } | number | string | null | undefined,
  batchResult: BatchYieldSource | null | undefined,
): number | null {
  const inputKg = toDecimalNumber(inputMaterialQty);
  if (inputKg <= 0 || !batchResult) return null;

  const sellableKg = resolveSellableKgFromBatch(batchResult);
  if (sellableKg == null) return null;

  const scrapKg = toDecimalNumber(batchResult.defect_qty);
  return calculateYieldPercent(inputKg, sellableKg, scrapKg);
}
