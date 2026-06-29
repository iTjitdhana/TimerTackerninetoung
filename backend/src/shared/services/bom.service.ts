import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";
import { canonicalWeighingUnit, isValidWeighingUnit } from "../utils/weighing-unit.util";
import {
  formatQuantity,
  normalizeBatchCount,
  scaleBomQuantity,
} from "../utils/batch-quantity.util";
import { isOperatorWeighableMaterial } from "../utils/operator-weighable-material.util";
import { resolveIngredientUnitPrice } from "../utils/material-cost-price.util";
import { roundUnitPrice } from "../utils/material-unit-price.util";
import {
  OnhandCostPriceService,
  type OnhandCostPriceStatus,
} from "./onhand-cost-price.service";
import {
  BOM_SOURCE_PROVIDER,
  type BomSourceProvider,
} from "./bom-source/bom-source.interface";
import { nowUtc, toIsoUtc } from "../utils/datetime.util";

function resolveUnit(...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    const canonical = canonicalWeighingUnit(candidate);
    if (isValidWeighingUnit(canonical)) return canonical;
  }
  return "";
}

/** ไม่ส่ง "0" กลับ UI เมื่อยังไม่มีผู้ตวงบันทึก */
function measuredWeightFromUsage(
  actualQty: string,
  weighedBy: number | null | undefined,
): string {
  if (weighedBy == null) {
    const n = Number(actualQty);
    if (!Number.isFinite(n) || n === 0) return "";
  }
  const n = Number(actualQty);
  if (!Number.isFinite(n) || n === 0) return "";
  return String(n);
}

function toPriceNumber(
  value: { toNumber?: () => number } | number | string | null | undefined,
): number {
  if (value == null) return 0;
  let n = 0;
  if (typeof value === "number") n = Number.isFinite(value) ? value : 0;
  else if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    n = Number.isFinite(parsed) ? parsed : 0;
  } else if (typeof value.toNumber === "function") {
    n = value.toNumber();
  }
  return roundUnitPrice(n);
}

function resolveUnitPriceSource(
  savedSource: string | null | undefined,
  priceStatus: OnhandCostPriceStatus | undefined,
): "api" | "manual" | undefined {
  if (savedSource === "api" || savedSource === "manual") return savedSource;
  if (priceStatus === "found" || priceStatus === "fallback" || priceStatus === "default") {
    return "api";
  }
  return undefined;
}

function resolveUnitPriceSourceAt(
  savedSource: string | null | undefined,
  savedAt: Date | null | undefined,
  priceStatus: OnhandCostPriceStatus | undefined,
): string | undefined {
  const source = resolveUnitPriceSource(savedSource, priceStatus);
  if (!source) return undefined;
  if (
    (savedSource === "api" || savedSource === "manual") &&
    savedAt
  ) {
    return toIsoUtc(savedAt) ?? undefined;
  }
  if (source === "api") {
    return toIsoUtc(nowUtc()) ?? undefined;
  }
  return undefined;
}

function resolveTimerWeighingFlags(
  code: string,
  name: string,
): Pick<BomIngredientDto, "operatorWeighable" | "editableOnTimer"> {
  const operatorWeighable = isOperatorWeighableMaterial(code, name);
  return {
    operatorWeighable,
    editableOnTimer: operatorWeighable,
  };
}

export interface BomIngredientDto {
  id: string;
  code: string;
  name: string;
  quantity: string;
  measuredWeight: string;
  /** หน่วยที่ใช้ตวง/บันทึกใน batch (อาจต่างจากสูตร) */
  unit: string;
  /** หน่วยตามสูตร BOM — แสดงเทียบเท่านั้น */
  formulaUnit: string;
  /** จำนวนต่อ 1 แบทช์ (BOM เท่านั้น) */
  baseQuantity?: string;
  isManual?: boolean;
  /** ผู้ผลิตตวงบนหน้าจับเวลาได้ (เช่น น้ำเปล่า) */
  operatorWeighable?: boolean;
  /** แก้จำนวนเบิกบนหน้าจับเวลาได้ */
  editableOnTimer?: boolean;
  /** ราคาต่อหน่วย (บาท) — snapshot จาก batch หรือ master */
  unitPrice?: number;
  unitPriceStatus?: OnhandCostPriceStatus;
  unitPriceFallbackReason?: string;
  /** หมายเหตุต่อวัตถุดิบ (บันทึกใน batch_material_usage) */
  note?: string;
  /** 'api' = ดึงจาก onhand API | 'manual' = ผู้ใช้คีย์เอง */
  unitPriceSource?: "api" | "manual";
  /** เวลาที่ทราบที่มาของราคา (ISO UTC) */
  unitPriceSourceAt?: string;
}

@Injectable()
export class BomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onhandCostPrice: OnhandCostPriceService,
    @Inject(BOM_SOURCE_PROVIDER)
    private readonly bomSource: BomSourceProvider,
  ) {}

  async hasFormula(jobCode: string): Promise<boolean> {
    return (await this.bomSource.getFormula(jobCode)) != null;
  }

  async findBomComponent(jobCode: string, materialCode: string) {
    const formula = await this.bomSource.getFormula(jobCode);
    if (!formula) return null;
    const code = materialCode.trim();
    return formula.components.find((component) => component.rawCode === code) ?? null;
  }

  async getIngredientsForWorkPlan(
    jobCode: string,
    batchId?: number,
    batchCount = 1,
  ): Promise<BomIngredientDto[]> {
    const normalizedBatchCount = normalizeBatchCount(batchCount);
    const formula = await this.bomSource.getFormula(jobCode);
    const components = formula?.components ?? [];

    const bomCodes = new Set(components.map((component) => component.rawCode));
    const rawCodes = components.map((component) => component.rawCode);
    const materials =
      rawCodes.length > 0
        ? await this.prisma.material.findMany({
            where: { Mat_Id: { in: rawCodes } },
          })
        : [];
    const materialByCode = new Map(materials.map((m) => [m.Mat_Id, m]));

    let usageByCode = new Map<
      string,
      {
        actualQty: string;
        plannedQty: string;
        unit: string;
        unitPrice: number;
        usageId: number;
        weighedBy: number | null;
        note: string | null;
        priceSource: string | null;
        priceSourceAt: Date | null;
      }
    >();

    if (batchId) {
      const usageRows = await this.prisma.batch_material_usage.findMany({
        where: { batch_id: batchId },
        include: { materials: true },
      });
      usageByCode = new Map(
        usageRows.map((row) => [
          row.materials.material_code,
          {
            actualQty: row.actual_qty.toString(),
            plannedQty: row.planned_qty.toString(),
            unit: row.unit,
            unitPrice: toPriceNumber(row.unit_price),
            usageId: row.id,
            weighedBy: row.weighed_by,
            note: row.note?.trim() || null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            priceSource: (row as any).price_source ?? null,
            priceSourceAt: row.updated_at ?? null,
          },
        ]),
      );
    }

    const allCodesList = [...new Set<string>([...rawCodes, ...usageByCode.keys()])];
    const allCanonicalMaterials =
      allCodesList.length > 0
        ? await this.prisma.materials.findMany({
            where: { material_code: { in: allCodesList } },
          })
        : [];
    const masterPriceByCode = new Map(
      allCanonicalMaterials.map((m) => [m.material_code, toPriceNumber(m.price)]),
    );

    const onhandLookupCodes = allCodesList.filter((code) => {
      const usage = usageByCode.get(code);
      return usage?.weighedBy == null;
    });
    const onhandPrices = await this.onhandCostPrice.resolvePrices(onhandLookupCodes);

    const resolvePriceFields = (code: string) => {
      const usage = usageByCode.get(code);
      const resolved = resolveIngredientUnitPrice(
        usage
          ? { unitPrice: usage.unitPrice, weighedBy: usage.weighedBy }
          : undefined,
        onhandPrices.get(code),
        masterPriceByCode.get(code) ?? 0,
      );
      return {
        unitPrice: resolved.unitPrice,
        unitPriceStatus: resolved.unitPriceStatus,
        unitPriceFallbackReason: resolved.unitPriceFallbackReason,
      };
    };

    const ingredients: BomIngredientDto[] = components.map((component) => {
      const mat = materialByCode.get(component.rawCode);
      const usage = usageByCode.get(component.rawCode);

      const formulaUnit = resolveUnit(component.rawUnit, mat?.Mat_Unit);
      const weighingUnit = resolveUnit(usage?.unit, formulaUnit);
      const baseQty = component.rawQty;
      const scaledQty = scaleBomQuantity(baseQty, normalizedBatchCount);
      const materialName = component.rawName ?? mat?.Mat_Name ?? component.rawCode;

      const priceFields = resolvePriceFields(component.rawCode);

      return {
        id: `bom-${component.rawCode}`,
        code: component.rawCode,
        name: materialName,
        quantity: formatQuantity(scaledQty),
        baseQuantity: formatQuantity(baseQty),
        measuredWeight: usage
          ? measuredWeightFromUsage(usage.actualQty, usage.weighedBy)
          : "",
        unit: weighingUnit,
        formulaUnit,
        ...priceFields,
        note: usage?.note ?? undefined,
        unitPriceSource: resolveUnitPriceSource(
          usage?.priceSource,
          priceFields.unitPriceStatus,
        ),
        unitPriceSourceAt: resolveUnitPriceSourceAt(
          usage?.priceSource,
          usage?.priceSourceAt,
          priceFields.unitPriceStatus,
        ),
        isManual: false,
        ...resolveTimerWeighingFlags(component.rawCode, materialName),
      };
    });

    if (batchId) {
      for (const [code, usage] of usageByCode.entries()) {
        if (bomCodes.has(code)) continue;

        const material = await this.prisma.materials.findUnique({
          where: { material_code: code },
        });

        const materialName = material?.material_name ?? code;

        const priceFields = resolvePriceFields(code);

        ingredients.push({
          id: `manual-${usage.usageId}`,
          code,
          name: materialName,
          quantity: usage.plannedQty,
          measuredWeight: measuredWeightFromUsage(usage.actualQty, usage.weighedBy),
          unit: resolveUnit(usage.unit),
          formulaUnit: resolveUnit(usage.unit),
          ...priceFields,
          note: usage.note ?? undefined,
          unitPriceSource: resolveUnitPriceSource(
            usage.priceSource,
            priceFields.unitPriceStatus,
          ),
          unitPriceSourceAt: resolveUnitPriceSourceAt(
            usage.priceSource,
            usage.priceSourceAt,
            priceFields.unitPriceStatus,
          ),
          isManual: true,
          ...resolveTimerWeighingFlags(code, materialName),
        });
      }
    }

    return ingredients;
  }
}
