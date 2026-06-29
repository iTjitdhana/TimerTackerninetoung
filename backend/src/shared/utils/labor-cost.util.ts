export const DEFAULT_STANDARD_WORK_MINUTES = 8 * 60 + 15;

export function getStandardWorkMinutes(
  envValue: string | undefined = process.env.LABOR_STANDARD_WORK_MINUTES,
): number {
  const parsed = Number.parseInt(envValue ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_STANDARD_WORK_MINUTES;
}

export function calculateHourlyRateFromDailyWage(
  dailyWagePerPerson: number,
  standardWorkMinutes: number = getStandardWorkMinutes(),
): number {
  if (
    !Number.isFinite(dailyWagePerPerson) ||
    dailyWagePerPerson <= 0 ||
    standardWorkMinutes <= 0
  ) {
    return 0;
  }

  return (dailyWagePerPerson * 60) / standardWorkMinutes;
}

export function deriveDailyWageFromHourlyRate(
  hourlyRate: number,
  standardWorkMinutes: number = getStandardWorkMinutes(),
): number | null {
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return null;
  }

  return (hourlyRate * standardWorkMinutes) / 60;
}

export interface ProductionCostMaterialLine {
  name: string;
  code: string;
  qty: number;
  unit: string;
  unitPrice: number;
  cost: number;
}

import type { SavedOutputSnapshot } from "./output-snapshot.util";
import { parseSavedOutputSnapshot } from "./output-snapshot.util";

export interface ProductionCostMaterialDetailsPayload {
  materials: ProductionCostMaterialLine[];
  laborDailyWagePerPerson?: number;
  outputLines?: Array<{
    kind: "sellable" | "scrap";
    label: string;
    qty: number;
    unit: string;
    conversionRate: number;
    weightKg: number;
  }>;
  outputSnapshot?: SavedOutputSnapshot;
}

export function buildProductionCostMaterialDetails(
  materials: ProductionCostMaterialLine[],
  dailyWagePerPerson?: number,
  outputLines?: ProductionCostMaterialDetailsPayload["outputLines"],
  outputSnapshot?: SavedOutputSnapshot,
): ProductionCostMaterialDetailsPayload {
  const payload: ProductionCostMaterialDetailsPayload = { materials };

  if (Number.isFinite(dailyWagePerPerson) && dailyWagePerPerson! > 0) {
    payload.laborDailyWagePerPerson = dailyWagePerPerson;
  }

  if (outputLines && outputLines.length > 0) {
    payload.outputLines = outputLines;
  }

  if (outputSnapshot) {
    payload.outputSnapshot = outputSnapshot;
  }

  return payload;
}

export function parseProductionCostMaterialDetails(value: unknown): {
  materials: ProductionCostMaterialLine[];
  dailyWagePerPerson: number | null;
  outputLines: ProductionCostMaterialDetailsPayload["outputLines"] | null;
  outputSnapshot: SavedOutputSnapshot | null;
} {
  if (Array.isArray(value)) {
    return {
      materials: value as ProductionCostMaterialLine[],
      dailyWagePerPerson: null,
      outputLines: null,
      outputSnapshot: null,
    };
  }

  if (value && typeof value === "object" && "materials" in value) {
    const record = value as ProductionCostMaterialDetailsPayload;
    const materials = Array.isArray(record.materials) ? record.materials : [];
    const wage = Number(record.laborDailyWagePerPerson);

    return {
      materials,
      dailyWagePerPerson: Number.isFinite(wage) && wage > 0 ? wage : null,
      outputLines: Array.isArray(record.outputLines) ? record.outputLines : null,
      outputSnapshot: parseSavedOutputSnapshot(record.outputSnapshot),
    };
  }

  return {
    materials: [],
    dailyWagePerPerson: null,
    outputLines: null,
    outputSnapshot: null,
  };
}

export function calculateLaborCostFromDailyWage(
  dailyWagePerPerson: number,
  operatorsCount: number,
  jobMinutes: number,
  standardWorkMinutes: number = getStandardWorkMinutes(),
): number {
  if (
    !Number.isFinite(dailyWagePerPerson) ||
    dailyWagePerPerson <= 0 ||
    standardWorkMinutes <= 0
  ) {
    return 0;
  }

  const operators = operatorsCount > 0 ? operatorsCount : 1;
  const time = jobMinutes > 0 ? jobMinutes : 0;

  if (time <= 0) {
    return 0;
  }

  return operators * dailyWagePerPerson * (time / standardWorkMinutes);
}

export function resolveLaborPersistence(
  timeUsedMinutes: number,
  operatorsCount: number,
  dailyWagePerPerson: number,
  standardWorkMinutes: number = getStandardWorkMinutes(),
): {
  timeUsedMinutes: number;
  operatorsCount: number;
  laborRatePerHour: number;
  laborCost: number;
} {
  const operators = operatorsCount > 0 ? operatorsCount : 1;
  let time = timeUsedMinutes;

  if (time <= 0) {
    time = 60;
  }

  if (
    !Number.isFinite(dailyWagePerPerson) ||
    dailyWagePerPerson <= 0 ||
    standardWorkMinutes <= 0
  ) {
    return {
      timeUsedMinutes: time,
      operatorsCount: operators,
      laborRatePerHour: 0,
      laborCost: 0,
    };
  }

  const laborRatePerHour = calculateHourlyRateFromDailyWage(
    dailyWagePerPerson,
    standardWorkMinutes,
  );
  const laborCost = calculateLaborCostFromDailyWage(
    dailyWagePerPerson,
    operators,
    time,
    standardWorkMinutes,
  );

  return {
    timeUsedMinutes: time,
    operatorsCount: operators,
    laborRatePerHour,
    laborCost,
  };
}

/** Phase 2: per-operator daily wage and minutes */
export interface LaborOperatorEntry {
  name: string;
  dailyWage: number;
  minutesWorked: number;
}
