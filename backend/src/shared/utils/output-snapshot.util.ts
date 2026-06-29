import { isDefaultConversionRate } from "./fg-size-conversion.util";
import {
  isKgUnit,
  type OutputVariant,
  type ProductOutputConfig,
} from "./output-quantity.util";
import {
  buildOutputLinesFromLegacy,
  normalizeOutputLine,
  type ProductionOutputLine,
} from "./production-output.util";

export interface SavedOutputSnapshot {
  conversionVerified: boolean;
  conversionWarnings: string[];
  conversionInfos: string[];
  masterUnit: string;
  baseUnit: string;
  fgCode: string | null;
  outputVariants: OutputVariant[];
}

export interface SavedConversionStatus {
  conversionVerified: boolean;
  conversionWarnings: string[];
  fgCode: string | null;
}

export interface BatchProductionResultLike {
  good_qty: { toNumber?: () => number } | number | string;
  good_secondary_qty: { toNumber?: () => number } | number | string | null;
  good_secondary_unit: string | null;
  defect_qty: { toNumber?: () => number } | number | string;
}

export interface PersistedOutputLineLike {
  kind: "sellable" | "scrap";
  label: string;
  qty: number;
  unit: string;
  conversionRate: number;
  weightKg?: number;
}

function toNumber(
  value: { toNumber?: () => number } | number | string | null | undefined,
): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return 0;
}

function normalizeVariant(candidate: unknown): OutputVariant | null {
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  const unit = String(record.unit ?? "").trim();
  const label = String(record.label ?? unit).trim();
  const conversionRate = Number(record.conversionRate);
  if (!label || !unit || !Number.isFinite(conversionRate) || conversionRate <= 0) {
    return null;
  }
  return {
    label,
    unit,
    conversionRate,
    packSize:
      typeof record.packSize === "string" && record.packSize.trim()
        ? record.packSize.trim()
        : null,
  };
}

export function parseSavedOutputSnapshot(value: unknown): SavedOutputSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const variants = Array.isArray(record.outputVariants)
    ? record.outputVariants
        .map(normalizeVariant)
        .filter((variant): variant is OutputVariant => variant != null)
    : [];

  if (variants.length === 0) return null;

  return {
    conversionVerified: record.conversionVerified === true,
    conversionWarnings: Array.isArray(record.conversionWarnings)
      ? record.conversionWarnings.map(String)
      : [],
    conversionInfos: Array.isArray(record.conversionInfos)
      ? record.conversionInfos.map(String)
      : [],
    masterUnit: String(record.masterUnit ?? variants[0]?.unit ?? ""),
    baseUnit: String(record.baseUnit ?? "กก."),
    fgCode:
      typeof record.fgCode === "string" && record.fgCode.trim()
        ? record.fgCode.trim()
        : null,
    outputVariants: variants,
  };
}

export function variantsFromOutputLines(
  lines: PersistedOutputLineLike[],
): OutputVariant[] {
  return lines
    .filter((line) => line.kind === "sellable")
    .map((line) => ({
      label: line.label,
      unit: line.unit,
      conversionRate: isKgUnit(line.unit) ? 1 : line.conversionRate,
      packSize: null,
    }));
}

function deriveConversionVerifiedFromLines(
  lines: PersistedOutputLineLike[],
): boolean {
  const sellableLines = lines.filter((line) => line.kind === "sellable");
  if (sellableLines.length === 0) return false;

  return sellableLines.every((line) => {
    if (isKgUnit(line.unit)) return true;
    const rate = Number(line.conversionRate);
    if (!Number.isFinite(rate) || rate <= 0) return false;
    return !isDefaultConversionRate(rate);
  });
}

export function deriveSnapshotFromOutputLines(
  lines: PersistedOutputLineLike[],
  hints?: {
    conversionVerified?: boolean;
    conversionWarnings?: string[];
    conversionInfos?: string[];
    masterUnit?: string;
    baseUnit?: string;
    fgCode?: string | null;
  },
): SavedOutputSnapshot | null {
  const variants = variantsFromOutputLines(lines);
  if (variants.length === 0) return null;

  return {
    conversionVerified:
      hints?.conversionVerified ?? deriveConversionVerifiedFromLines(lines),
    conversionWarnings: hints?.conversionWarnings ?? [],
    conversionInfos: hints?.conversionInfos ?? [],
    masterUnit: hints?.masterUnit ?? variants[0]?.unit ?? "",
    baseUnit: hints?.baseUnit ?? "กก.",
    fgCode: hints?.fgCode ?? null,
    outputVariants: variants,
  };
}

export function buildOutputSnapshot(
  outputConfig: ProductOutputConfig,
  outputLines: ProductionOutputLine[],
): SavedOutputSnapshot {
  const sellableLines = outputLines.filter((line) => line.kind === "sellable");
  const variants =
    sellableLines.length > 0
      ? sellableLines.map((line) => ({
          label: line.label,
          unit: line.unit,
          conversionRate: line.conversionRate,
          packSize: null,
        }))
      : outputConfig.outputVariants;

  return {
    conversionVerified: outputConfig.conversionVerified,
    conversionWarnings: [...outputConfig.conversionWarnings],
    conversionInfos: [...outputConfig.conversionInfos],
    masterUnit: outputConfig.masterUnit,
    baseUnit: outputConfig.baseUnit,
    fgCode: outputConfig.fgCode,
    outputVariants: variants,
  };
}

export function buildLegacyOutputLinesFromBatchResult(
  summary: BatchProductionResultLike,
): ProductionOutputLine[] {
  const outputUnit = summary.good_secondary_unit?.trim() || "กก.";
  const outputQty = toNumber(summary.good_qty);
  const weightKg = toNumber(summary.good_secondary_qty);
  const scrapQty = toNumber(summary.defect_qty);

  let conversionRate = 1;
  if (!isKgUnit(outputUnit)) {
    if (outputQty > 0 && weightKg > 0) {
      conversionRate = weightKg / outputQty;
    } else {
      conversionRate = 1;
    }
  }

  return buildOutputLinesFromLegacy({
    outputQty,
    outputUnit,
    conversionRate,
    label: outputUnit,
    scrapQty,
  }).map((line) => {
    const normalized = normalizeOutputLine(line);
    if (line.kind === "sellable" && weightKg > 0) {
      return { ...normalized, weightKg };
    }
    return normalized;
  });
}

export function resolveSavedConversionStatus(params: {
  outputSnapshot?: SavedOutputSnapshot | null;
  outputLines?: PersistedOutputLineLike[] | null;
  batchSummary?: BatchProductionResultLike | null;
}): SavedConversionStatus {
  if (params.outputSnapshot) {
    return {
      conversionVerified: params.outputSnapshot.conversionVerified,
      conversionWarnings: [...params.outputSnapshot.conversionWarnings],
      fgCode: params.outputSnapshot.fgCode,
    };
  }

  if (params.outputLines?.length) {
    const snapshot = deriveSnapshotFromOutputLines(params.outputLines);
    return {
      conversionVerified: snapshot?.conversionVerified ?? false,
      conversionWarnings: [],
      fgCode: snapshot?.fgCode ?? null,
    };
  }

  if (params.batchSummary) {
    const legacyLines = buildLegacyOutputLinesFromBatchResult(params.batchSummary);
    const sellable = legacyLines.find((line) => line.kind === "sellable");
    const outputQty = toNumber(params.batchSummary.good_qty);
    const weightKg = toNumber(params.batchSummary.good_secondary_qty);
    const unit = params.batchSummary.good_secondary_unit?.trim() ?? "";

    if (sellable && outputQty > 0 && weightKg > 0) {
      const verified =
        isKgUnit(unit) ||
        (!isDefaultConversionRate(sellable.conversionRate) &&
          sellable.conversionRate > 0);
      return {
        conversionVerified: verified,
        conversionWarnings: verified
          ? []
          : ["ไม่พบ snapshot อัตราแปลง — ตรวจสอบจากข้อมูลที่บันทึก"],
        fgCode: null,
      };
    }
  }

  return {
    conversionVerified: false,
    conversionWarnings: ["ไม่พบข้อมูลผลผลิตที่บันทึก"],
    fgCode: null,
  };
}

export function resolveSavedOutputSnapshot(params: {
  storedSnapshot?: SavedOutputSnapshot | null;
  outputLines?: PersistedOutputLineLike[] | null;
  batchSummary?: BatchProductionResultLike | null;
  outputConfig?: ProductOutputConfig | null;
}): SavedOutputSnapshot | null {
  if (params.storedSnapshot) {
    return params.storedSnapshot;
  }

  if (params.outputLines?.length) {
    return deriveSnapshotFromOutputLines(params.outputLines, {
      masterUnit: params.outputConfig?.masterUnit,
      baseUnit: params.outputConfig?.baseUnit,
      fgCode: params.outputConfig?.fgCode ?? null,
      conversionVerified: params.outputConfig?.conversionVerified,
      conversionWarnings: params.outputConfig?.conversionWarnings,
      conversionInfos: params.outputConfig?.conversionInfos,
    });
  }

  if (params.batchSummary) {
    const legacyLines = buildLegacyOutputLinesFromBatchResult(params.batchSummary);
    return deriveSnapshotFromOutputLines(legacyLines, {
      masterUnit:
        params.batchSummary.good_secondary_unit?.trim() ??
        params.outputConfig?.masterUnit,
      baseUnit: params.outputConfig?.baseUnit,
      fgCode: params.outputConfig?.fgCode ?? null,
    });
  }

  return null;
}
