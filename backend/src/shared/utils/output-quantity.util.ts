import {
  deriveKgPerUnitFromFgSize,
  isDefaultConversionRate,
} from "./fg-size-conversion.util";

export interface OutputUnitOption {
  unit: string;
  conversionRate: number;
}

export interface OutputVariant {
  label: string;
  unit: string;
  conversionRate: number;
  packSize?: string | null;
}

export type ConversionSource =
  | "fg_size"
  | "master"
  | "description"
  | "default";

export interface ProductOutputConfig {
  defaultOutputUnit: string;
  baseUnit: string;
  packSize: string | null;
  unitOptions: OutputUnitOption[];
  outputVariants: OutputVariant[];
  /** หน่วยขายมาตรฐานจาก master (fg.FG_Unit) */
  masterUnit: string;
  /** @deprecated ใช้ masterUnit แทน */
  outputUnit: string;
  conversionRate: number;
  /** อัตราแปลงน่าเชื่อถือสำหรับคำนวณ yield */
  conversionVerified: boolean;
  conversionWarnings: string[];
  /** ข้อความแจ้งเมื่อ derive จาก FG_Size สำเร็จ */
  conversionInfos: string[];
  conversionSource: ConversionSource;
  /** FG_Code ที่ resolve ได้ (null ถ้าไม่พบ) */
  fgCode: string | null;
}

export const DEFAULT_FORM_OUTPUT_UNIT = "กก.";

const KG_UNITS = new Set(["กก.", "kg", "KG", "กิโลกรัม"]);

export function isKgUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  const trimmed = unit.trim();
  return KG_UNITS.has(trimmed) || trimmed.toLowerCase() === "kg";
}

function parseConversionRate(
  value: { toNumber?: () => number } | number | null | undefined,
): number {
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    const rate = value.toNumber();
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  }
  const rate = Number(value ?? 1);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
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

export function parseOutputVariantsFromDescription(
  conversionDescription: string | null | undefined,
): OutputVariant[] | null {
  if (!conversionDescription?.trim()) return null;

  try {
    const parsed = JSON.parse(conversionDescription) as unknown;
    if (!Array.isArray(parsed)) return null;

    const variants = parsed
      .map(normalizeVariant)
      .filter((variant): variant is OutputVariant => variant != null);

    return variants.length > 0 ? variants : null;
  } catch {
    return null;
  }
}

export function buildOutputUnitOptions(
  fg: {
    FG_Unit: string;
    conversion_rate: { toNumber?: () => number } | number | null;
  } | null,
  productUnit?: string | null,
  outputVariants?: OutputVariant[],
): OutputUnitOption[] {
  const options: OutputUnitOption[] = [{ unit: "กก.", conversionRate: 1 }];
  const seen = new Set(["กก."]);

  const addOption = (unit?: string | null, rate?: number) => {
    const trimmed = unit?.trim();
    if (!trimmed || seen.has(trimmed) || isKgUnit(trimmed)) return;
    const conversionRate =
      Number.isFinite(Number(rate)) && Number(rate) > 0 ? Number(rate) : 1;
    options.push({ unit: trimmed, conversionRate });
    seen.add(trimmed);
  };

  for (const variant of outputVariants ?? []) {
    addOption(variant.unit, variant.conversionRate);
  }

  const masterUnit = fg?.FG_Unit?.trim() || productUnit?.trim();
  if (masterUnit && !isKgUnit(masterUnit)) {
    addOption(masterUnit, parseConversionRate(fg?.conversion_rate));
  }

  return options;
}

export function resolveConversionRateForUnit(
  unit: string,
  unitOptions: OutputUnitOption[],
): number {
  if (isKgUnit(unit)) return 1;
  const match = unitOptions.find((option) => option.unit === unit);
  return match?.conversionRate ?? 1;
}

function buildDefaultOutputVariants(
  fg: {
    FG_Unit: string;
    conversion_rate: { toNumber?: () => number } | number | null;
    FG_Size: string;
  } | null,
  productUnit?: string | null,
  effectiveConversionRate?: number,
): OutputVariant[] {
  const masterUnit = fg?.FG_Unit?.trim() || productUnit?.trim() || "กก.";
  const conversionRate =
    effectiveConversionRate ??
    (fg ? parseConversionRate(fg.conversion_rate) : 1);

  return [
    {
      label: fg?.FG_Size?.trim() || masterUnit,
      unit: masterUnit,
      conversionRate: isKgUnit(masterUnit) ? 1 : conversionRate,
      packSize: fg?.FG_Size || null,
    },
  ];
}

export interface DetectConversionWarningsParams {
  fg: {
    FG_Unit: string;
    conversion_rate: { toNumber?: () => number } | number | null;
    FG_Size: string;
  } | null;
  fgCode: string | null;
  masterUnit: string;
  masterConversionRate: number;
  outputVariants: OutputVariant[];
  conversionSource: ConversionSource;
  hasParsedVariants: boolean;
}

export function detectConversionWarnings(
  params: DetectConversionWarningsParams,
): {
  conversionVerified: boolean;
  conversionWarnings: string[];
  conversionInfos: string[];
} {
  const warnings: string[] = [];
  const infos: string[] = [];

  if (params.conversionSource === "fg_size" && params.fg?.FG_Size?.trim()) {
    infos.push(
      `อัตราแปลงคำนวณจากขนาดมาตรฐาน ${params.fg.FG_Size.trim()}`,
    );
  }

  if (!params.fg && !isKgUnit(params.masterUnit)) {
    warnings.push("ไม่พบข้อมูล FG — อัตราแปลงอาจไม่ถูกต้อง");
  }

  if (
    params.fg &&
    !isKgUnit(params.masterUnit) &&
    isDefaultConversionRate(params.masterConversionRate) &&
    params.conversionSource === "default"
  ) {
    warnings.push("ยังไม่มีน้ำหนักต่อแพ็คในระบบ (ใช้ 1:1 ชั่วคราว)");
  }

  if (params.conversionSource === "default" && !params.hasParsedVariants) {
    for (const variant of params.outputVariants) {
      if (!isKgUnit(variant.unit) && isDefaultConversionRate(variant.conversionRate)) {
        warnings.push(`ขนาด ${variant.label} ยังไม่มีอัตราแปลง`);
      }
    }
  }

  const uniqueWarnings = [...new Set(warnings)];
  return {
    conversionVerified: uniqueWarnings.length === 0,
    conversionWarnings: uniqueWarnings,
    conversionInfos: infos,
  };
}

function resolveEffectiveConversion(
  fg: {
    FG_Unit: string;
    conversion_rate: { toNumber?: () => number } | number | null;
    FG_Size: string;
    conversion_description?: string | null;
  } | null,
): { rate: number; source: ConversionSource; hasParsedVariants: boolean } {
  const parsedVariants = parseOutputVariantsFromDescription(
    fg?.conversion_description,
  );
  if (parsedVariants) {
    return {
      rate: parseConversionRate(fg?.conversion_rate),
      source: "description",
      hasParsedVariants: true,
    };
  }

  if (!fg) {
    return { rate: 1, source: "default", hasParsedVariants: false };
  }

  const dbRate = parseConversionRate(fg.conversion_rate);
  if (!isDefaultConversionRate(dbRate)) {
    return { rate: dbRate, source: "master", hasParsedVariants: false };
  }

  const derived = deriveKgPerUnitFromFgSize(fg.FG_Size);
  if (derived != null) {
    return { rate: derived, source: "fg_size", hasParsedVariants: false };
  }

  return { rate: dbRate, source: "default", hasParsedVariants: false };
}

export function resolveProductOutput(
  fg: {
    FG_Unit: string;
    conversion_rate: { toNumber?: () => number } | number | null;
    base_unit: string | null;
    FG_Size: string;
    conversion_description?: string | null;
  } | null,
  productUnit?: string | null,
  options?: { fgCode?: string | null },
): ProductOutputConfig {
  const fgCode = options?.fgCode ?? null;
  const { rate: effectiveRate, source: conversionSource, hasParsedVariants } =
    resolveEffectiveConversion(fg);

  const parsedVariants = parseOutputVariantsFromDescription(
    fg?.conversion_description,
  );
  const outputVariants =
    parsedVariants ??
    buildDefaultOutputVariants(fg, productUnit, effectiveRate);
  const unitOptions = buildOutputUnitOptions(fg, productUnit, outputVariants);
  const masterUnit = fg?.FG_Unit?.trim() || productUnit?.trim() || "กก.";
  const conversionRate = fg ? effectiveRate : 1;
  const primaryVariant = outputVariants[0];

  const baseConfig = {
    defaultOutputUnit: isKgUnit(masterUnit)
      ? DEFAULT_FORM_OUTPUT_UNIT
      : masterUnit,
    baseUnit: fg?.base_unit ?? "กก.",
    packSize: primaryVariant?.packSize ?? fg?.FG_Size ?? null,
    unitOptions,
    outputVariants,
    masterUnit,
    outputUnit: masterUnit,
    conversionRate,
    conversionSource,
    fgCode,
  };

  const { conversionVerified, conversionWarnings, conversionInfos } =
    detectConversionWarnings({
      fg,
      fgCode,
      masterUnit,
      masterConversionRate: conversionRate,
      outputVariants,
      conversionSource,
      hasParsedVariants,
    });

  return {
    ...baseConfig,
    conversionVerified,
    conversionWarnings,
    conversionInfos,
  };
}

/** แปลงจำนวนผลิตเป็นหน่วย base (กก.) ตาม conversion_rate */
export function convertOutputToKg(
  qty: number,
  conversionRate: number,
  outputUnit: string,
  baseUnit: string,
): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (isKgUnit(outputUnit) && isKgUnit(baseUnit)) return qty;

  const rate =
    Number.isFinite(conversionRate) && conversionRate > 0 ? conversionRate : 1;
  return qty * rate;
}

export function convertSelectedOutputToKg(
  qty: number,
  selectedUnit: string,
  config: ProductOutputConfig,
): number {
  const rate = resolveConversionRateForUnit(selectedUnit, config.unitOptions);
  return convertOutputToKg(qty, rate, selectedUnit, config.baseUnit);
}
