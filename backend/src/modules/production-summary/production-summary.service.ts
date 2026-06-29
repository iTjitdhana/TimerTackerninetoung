import { Injectable } from "@nestjs/common";
import { Prisma, work_plans_workflow_status } from "@prisma/client";
import { BatchResolverService } from "../../shared/services/batch-resolver.service";
import { ProductionLogService } from "../../shared/services/production-log.service";
import { PrismaService } from "../../shared/prisma/prisma.module";
import {
  DEFAULT_FORM_OUTPUT_UNIT,
  isKgUnit,
  ProductOutputConfig,
  resolveConversionRateForUnit,
} from "../../shared/utils/output-quantity.util";
import {
  aggregateOutputLines,
  buildOutputLinesFromLegacy,
  normalizeOutputLine,
  ProductionOutputLine,
  ProductionOutputLineInput,
  resolvePrimarySellableLine,
} from "../../shared/utils/production-output.util";
import { resolveWallClockSpanMinutes } from "../../shared/utils/datetime.util";
import { CreateProductionSummaryDto } from "./dto/production-summary.dto";
import {
  deriveDailyWageFromHourlyRate,
  getStandardWorkMinutes,
  resolveLaborPersistence,
  buildProductionCostMaterialDetails,
  parseProductionCostMaterialDetails,
} from "../../shared/utils/labor-cost.util";
import { serializeForJson } from "../../shared/utils/json-serialize.util";
import {
  buildUnitConversionLookup,
  convertQtyToKg,
} from "../../shared/utils/input-material-weight.util";
import {
  buildLegacyOutputLinesFromBatchResult,
  buildOutputSnapshot,
  resolveSavedOutputSnapshot,
} from "../../shared/utils/output-snapshot.util";

const INPUT_MATERIAL_UNIT = "กก.";

interface MaterialMetrics {
  inputMaterialQty: number;
  materialCost: number;
  materialDetails: Array<{
    name: string;
    code: string;
    qty: number;
    unit: string;
    unitPrice: number;
    cost: number;
  }>;
}

interface CostMetrics extends MaterialMetrics {
  timeUsedMinutes: number;
  operatorsCount: number;
  inputUnitConversions: Array<{
    materialCode: string | null;
    fromUnit: string;
    conversionRate: number;
  }>;
}

@Injectable()
export class ProductionSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batchResolver: BatchResolverService,
    private readonly productionLogService: ProductionLogService,
  ) {}

  async create(dto: CreateProductionSummaryDto) {
    const workPlan = await this.batchResolver.resolveWorkPlan(dto.jobId);
    const batch = await this.batchResolver.resolveOrCreateBatch(dto.jobId);
    const outputConfig = await this.batchResolver.resolveProductOutputConfig(
      workPlan.job_code,
      batch.product_code,
      workPlan.job_name,
    );

    const costMetrics = await this.loadCostMetrics(batch.id, workPlan.id);
    const standardWorkMinutes = getStandardWorkMinutes();
    const laborInputs = resolveLaborPersistence(
      costMetrics.timeUsedMinutes,
      costMetrics.operatorsCount,
      dto.dailyWagePerPerson,
      standardWorkMinutes,
    );
    const laborCost = laborInputs.laborCost;
    const outputLines = this.buildPersistedOutputLines(
      dto,
      outputConfig,
      costMetrics.inputMaterialQty,
    );
    const outputSnapshot = buildOutputSnapshot(outputConfig, outputLines);
    const aggregated = aggregateOutputLines(outputLines);
    const sellableKg = aggregated.sellableKg;
    const scrapKg = aggregated.scrapKg;
    const primaryLine = resolvePrimarySellableLine(aggregated.sellableLines);
    const selectedOutputUnit =
      primaryLine?.unit ?? dto.outputUnit?.trim() ?? DEFAULT_FORM_OUTPUT_UNIT;
    const primaryQty = primaryLine?.qty ?? dto.outputQty;
    const totalCost = costMetrics.materialCost + laborCost;
    const outputUnitCost =
      primaryQty > 0
        ? (totalCost * (primaryLine?.weightKg ?? sellableKg)) /
          sellableKg /
          primaryQty
        : 0;

    const balance = this.calculateProductionBalance(
      costMetrics.inputMaterialQty,
      sellableKg,
      scrapKg,
    );

    const { summary, costRecord } = await this.prisma.$transaction(
      async (tx) => {
        const summary = await tx.batch_production_results.upsert({
          where: { batch_id: batch.id },
          create: {
            batch_id: batch.id,
            product_code: batch.product_code,
            good_qty: primaryQty,
            good_secondary_qty: sellableKg,
            good_secondary_unit: selectedOutputUnit,
            defect_qty: scrapKg,
          },
          update: {
            good_qty: primaryQty,
            good_secondary_qty: sellableKg,
            good_secondary_unit: selectedOutputUnit,
            defect_qty: scrapKg,
          },
        });

        await tx.production_batches.update({
          where: { id: batch.id },
          data: {
            status: "completed",
            end_time: new Date(),
            actual_qty: primaryQty,
            unit: selectedOutputUnit,
          },
        });

        const costRecord = await this.upsertProductionCosts(tx, {
          workPlan,
          batchId: batch.id,
          outputUnit: selectedOutputUnit,
          outputQty: primaryQty,
          outputUnitCost,
          totalCost,
          dailyWagePerPerson: dto.dailyWagePerPerson,
          standardWorkMinutes,
          costMetrics,
          outputLines,
          outputSnapshot,
        });

        await tx.work_plans.update({
          where: { id: workPlan.id },
          data: { workflow_status: work_plans_workflow_status.completed },
        });

        await tx.finished_flags.upsert({
          where: { work_plan_id: workPlan.id },
          create: { work_plan_id: workPlan.id, is_finished: true },
          update: { is_finished: true },
        });

        return { summary, costRecord };
      },
    );

    return serializeForJson({
      jobId: dto.jobId,
      batchId: batch.id,
      summary: {
        ...summary,
        outputLines,
      },
      outputConfig,
      savedOutputSnapshot: outputSnapshot,
      balance,
      cost: costRecord,
    });
  }

  async getByJobId(jobId: string, canViewCost = true) {
    const workPlan = await this.batchResolver.resolveWorkPlan(jobId);
    const batch = await this.batchResolver.findLatestBatch(workPlan.id);
    const outputConfig = await this.batchResolver.resolveProductOutputConfig(
      workPlan.job_code,
      batch?.product_code,
      workPlan.job_name,
    );

    if (!batch) {
      return {
        jobId,
        batchId: null,
        summary: null,
        outputConfig,
        savedOutputSnapshot: null,
        costPreview: null,
      };
    }

    const summary = await this.prisma.batch_production_results.findUnique({
      where: { batch_id: batch.id },
    });
    const costMetrics = await this.loadCostMetrics(batch.id, workPlan.id);
    const savedCost = await this.prisma.production_costs.findFirst({
      where: {
        production_date: workPlan.production_date,
        job_code: workPlan.job_code,
        bu_id: workPlan.bu_id,
      },
    });

    const standardWorkMinutes = getStandardWorkMinutes();
    const parsedMaterialDetails = parseProductionCostMaterialDetails(
      savedCost?.material_details,
    );
    const savedHourlyRate =
      savedCost?.labor_rate_per_hour != null
        ? this.toNumber(savedCost.labor_rate_per_hour)
        : null;
    const dailyWagePerPerson =
      parsedMaterialDetails.dailyWagePerPerson ??
      (savedHourlyRate
        ? deriveDailyWageFromHourlyRate(savedHourlyRate, standardWorkMinutes)
        : null);
    const calculatedLaborCost =
      savedCost?.labor_cost != null
        ? this.toNumber(savedCost.labor_cost)
        : null;
    const outputLines =
      parsedMaterialDetails.outputLines ??
      (summary ? buildLegacyOutputLinesFromBatchResult(summary) : null);

    const savedOutputSnapshot = resolveSavedOutputSnapshot({
      storedSnapshot: parsedMaterialDetails.outputSnapshot,
      outputLines: outputLines ?? undefined,
      batchSummary: summary ?? undefined,
      outputConfig,
    });

    return {
      jobId,
      batchId: batch.id,
      summary: summary
        ? {
            ...summary,
            outputLines,
          }
        : null,
      outputConfig,
      savedOutputSnapshot,
      costPreview: canViewCost
        ? {
            inputMaterialQty: costMetrics.inputMaterialQty,
            inputMaterialUnit: INPUT_MATERIAL_UNIT,
            inputUnitConversions: costMetrics.inputUnitConversions,
            materialCost: costMetrics.materialCost,
            timeUsedMinutes: costMetrics.timeUsedMinutes,
            operatorsCount: costMetrics.operatorsCount,
            standardWorkMinutes,
            dailyWagePerPerson,
            calculatedLaborCost,
          }
        : {
            inputMaterialQty: costMetrics.inputMaterialQty,
            inputMaterialUnit: INPUT_MATERIAL_UNIT,
            inputUnitConversions: costMetrics.inputUnitConversions,
            materialCost: 0,
            timeUsedMinutes: 0,
            operatorsCount: 0,
            standardWorkMinutes,
            dailyWagePerPerson: null,
            calculatedLaborCost: null,
          },
    };
  }

  calculateProductionBalance(
    totalInputKg: number,
    weightKg: number,
    scrapKg?: number,
  ) {
    const scrap =
      scrapKg ?? Math.max(0, totalInputKg - weightKg);

    return {
      totalInput: totalInputKg,
      weightKg,
      scrap,
    };
  }

  private async loadCostMetrics(
    batchId: number,
    workPlanId: number,
  ): Promise<CostMetrics> {
    const [usageRows, batchExecutions, operatorCount, unitConversionRows] =
      await Promise.all([
      this.prisma.batch_material_usage.findMany({
        where: { batch_id: batchId },
        include: { materials: true },
      }),
      this.prisma.process_executions.findMany({
        where: { batch_id: batchId },
      }),
      this.prisma.work_plan_operators.count({
        where: { work_plan_id: workPlanId },
      }),
      this.prisma.unit_conversions.findMany({
        where: { to_unit: "กก." },
      }),
    ]);

    const unitConversionLookup = buildUnitConversionLookup(
      unitConversionRows.map((row) => ({
        from_unit: row.from_unit,
        to_unit: row.to_unit,
        conversion_rate: this.toNumber(row.conversion_rate),
        material_code: row.material_code,
      })),
    );
    const inputUnitConversions = unitConversionRows.map((row) => ({
      materialCode: row.material_code,
      fromUnit: row.from_unit,
      conversionRate: this.toNumber(row.conversion_rate),
    }));

    let executions = batchExecutions;
    const batchTimeUsedMinutes = resolveWallClockSpanMinutes(batchExecutions);
    if (batchTimeUsedMinutes === 0) {
      executions = await this.prisma.process_executions.findMany({
        where: { work_plan_id: workPlanId },
      });
    }

    const materialMetrics = this.computeMaterialMetrics(
      usageRows,
      unitConversionLookup,
    );
    let timeUsedMinutes = resolveWallClockSpanMinutes(executions);

    if (timeUsedMinutes === 0) {
      timeUsedMinutes =
        await this.productionLogService.getWorkPlanWallClockMinutes(workPlanId);
    }

    const operatorsCount = await this.resolveOperatorsCount(
      workPlanId,
      operatorCount,
    );

    return {
      ...materialMetrics,
      timeUsedMinutes,
      operatorsCount,
      inputUnitConversions,
    };
  }

  private computeMaterialMetrics(
    usageRows: Array<{
      actual_qty: { toNumber?: () => number } | number | string;
      unit: string;
      unit_price: { toNumber?: () => number } | number | string;
      materials: { material_name: string; material_code: string };
    }>,
    unitConversionLookup: Map<string, number>,
  ): MaterialMetrics {
    let inputMaterialQty = 0;
    let materialCost = 0;
    const materialDetails: MaterialMetrics["materialDetails"] = [];

    for (const row of usageRows) {
      const qty = this.toNumber(row.actual_qty);
      const unitPrice = this.toNumber(row.unit_price);
      const cost = qty * unitPrice;
      materialCost += cost;

      inputMaterialQty += convertQtyToKg(
        qty,
        row.unit,
        row.materials.material_code,
        unitConversionLookup,
      );

      materialDetails.push({
        name: row.materials.material_name,
        code: row.materials.material_code,
        qty,
        unit: row.unit,
        unitPrice,
        cost,
      });
    }

    return { inputMaterialQty, materialCost, materialDetails };
  }

  private async resolveOperatorsCount(
    workPlanId: number,
    operatorCount: number,
  ): Promise<number> {
    if (operatorCount > 0) {
      return operatorCount;
    }

    const workPlan = await this.prisma.work_plans.findUnique({
      where: { id: workPlanId },
      select: { operators: true },
    });

    if (Array.isArray(workPlan?.operators)) {
      return workPlan.operators.length;
    }

    return 1;
  }

  private async upsertProductionCosts(
    tx: Prisma.TransactionClient,
    params: {
    workPlan: {
      id: number;
      job_code: string;
      job_name: string | null;
      production_date: Date;
      bu_id: number;
    };
    batchId: number;
    outputUnit: string;
    outputQty: number;
    outputUnitCost: number;
    totalCost: number;
    dailyWagePerPerson: number;
    standardWorkMinutes: number;
    costMetrics: CostMetrics;
    outputLines: ProductionOutputLine[];
    outputSnapshot: ReturnType<typeof buildOutputSnapshot>;
  }) {
    const {
      workPlan,
      batchId,
      outputUnit,
      outputQty,
      outputUnitCost,
      totalCost,
      dailyWagePerPerson,
      standardWorkMinutes,
      costMetrics,
      outputLines,
      outputSnapshot,
    } = params;

    const laborInputs = resolveLaborPersistence(
      costMetrics.timeUsedMinutes,
      costMetrics.operatorsCount,
      dailyWagePerPerson,
      standardWorkMinutes,
    );
    const materialDetailsPayload = buildProductionCostMaterialDetails(
      costMetrics.materialDetails,
      dailyWagePerPerson,
      outputLines,
      outputSnapshot,
    );

    return tx.production_costs.upsert({
      where: {
        production_date_job_code_bu_id: {
          production_date: workPlan.production_date,
          job_code: workPlan.job_code,
          bu_id: workPlan.bu_id,
        },
      },
      create: {
        work_plan_id: BigInt(workPlan.id),
        bu_id: workPlan.bu_id,
        batch_id: batchId,
        job_code: workPlan.job_code,
        job_name: (workPlan.job_name ?? workPlan.job_code).slice(0, 255),
        production_date: workPlan.production_date,
        input_material_qty: costMetrics.inputMaterialQty,
        input_material_unit: INPUT_MATERIAL_UNIT,
        output_qty: outputQty,
        output_unit: outputUnit,
        output_unit_cost: outputUnitCost,
        time_used_minutes: laborInputs.timeUsedMinutes,
        operators_count: laborInputs.operatorsCount,
        labor_rate_per_hour: laborInputs.laborRatePerHour,
        material_cost: costMetrics.materialCost,
        total_cost: totalCost,
        material_details: materialDetailsPayload as object,
      },
      update: {
        work_plan_id: BigInt(workPlan.id),
        bu_id: workPlan.bu_id,
        batch_id: batchId,
        job_name: (workPlan.job_name ?? workPlan.job_code).slice(0, 255),
        input_material_qty: costMetrics.inputMaterialQty,
        input_material_unit: INPUT_MATERIAL_UNIT,
        output_qty: outputQty,
        output_unit: outputUnit,
        output_unit_cost: outputUnitCost,
        time_used_minutes: laborInputs.timeUsedMinutes,
        operators_count: laborInputs.operatorsCount,
        labor_rate_per_hour: laborInputs.laborRatePerHour,
        material_cost: costMetrics.materialCost,
        total_cost: totalCost,
        material_details: materialDetailsPayload as object,
      },
    });
  }

  private buildPersistedOutputLines(
    dto: CreateProductionSummaryDto,
    outputConfig: ProductOutputConfig,
    inputMaterialKg: number,
  ): ProductionOutputLine[] {
    const sellableInputs = this.resolveSellableInputs(dto, outputConfig);
    const aggregated = aggregateOutputLines(sellableInputs);
    const explicitScrap = dto.outputLines?.find((line) => line.kind === "scrap");
    const scrapKg =
      explicitScrap != null
        ? explicitScrap.qty
        : dto.scrapQty ??
          Math.max(0, inputMaterialKg - aggregated.sellableKg);

    const lines = sellableInputs.map(normalizeOutputLine);
    if (scrapKg > 0) {
      lines.push(
        normalizeOutputLine({
          kind: "scrap",
          label: "เศษ",
          qty: scrapKg,
          unit: "กก.",
          conversionRate: 1,
        }),
      );
    }

    return lines;
  }

  private resolveSellableInputs(
    dto: CreateProductionSummaryDto,
    outputConfig: ProductOutputConfig,
  ): ProductionOutputLineInput[] {
    if (dto.outputLines && dto.outputLines.length > 0) {
      return dto.outputLines.filter((line) => line.kind === "sellable");
    }

    const selectedOutputUnit =
      dto.outputUnit?.trim() || DEFAULT_FORM_OUTPUT_UNIT;
    const variant =
      outputConfig.outputVariants.find(
        (item) => item.unit === selectedOutputUnit,
      ) ?? outputConfig.outputVariants[0];
    const conversionRate = isKgUnit(selectedOutputUnit)
      ? 1
      : resolveConversionRateForUnit(selectedOutputUnit, outputConfig.unitOptions);

    return buildOutputLinesFromLegacy({
      outputQty: dto.outputQty,
      outputUnit: selectedOutputUnit,
      conversionRate,
      label: variant?.label ?? selectedOutputUnit,
    }).filter((line) => line.kind === "sellable");
  }

  private toNumber(value: { toNumber?: () => number } | number | string): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value && typeof value.toNumber === "function") {
      return value.toNumber();
    }
    return 0;
  }
}
