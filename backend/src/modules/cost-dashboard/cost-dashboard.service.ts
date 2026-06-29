import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.module";
import { BatchResolverService } from "../../shared/services/batch-resolver.service";
import {
  ProductionLogService,
  type StepLogTiming,
} from "../../shared/services/production-log.service";
import {
  formatDateOnlyBangkok,
  nextDateOnlyBangkok,
  parseDateOnlyBangkok,
} from "../../shared/utils/datetime.util";
import {
  resolveProductionDataCompleteness,
  resolveTimerStatusForCost,
  resolveYieldPercentFromBatch,
  type BatchYieldSource,
  type ProcessExecutionRow,
  type ProductionDataCompleteness,
  type TimerStatus,
} from "./cost-dashboard.util";
import { parseProductionCostMaterialDetails } from "../../shared/utils/labor-cost.util";
import { resolveSavedConversionStatus } from "../../shared/utils/output-snapshot.util";

interface WpInfo {
  operators: string[];
}

interface CostRow {
  id: bigint;
  work_plan_id: bigint | null;
  bu_id: number | null;
  batch_id: number | null;
  job_code: string;
  job_name: string;
  production_date: Date;
  input_material_qty: object | null;
  material_cost: object | null;
  total_cost: object | null;
  output_qty: object | null;
  output_unit: string | null;
  time_used_minutes: number | null;
}

interface WorkPlanRow {
  id: number;
  job_code: string;
  job_name: string | null;
  bu_id: number;
  production_date: Date;
  work_plan_operators: Array<{
    id_code: string | null;
    users: { name: string } | null;
  }>;
}

interface DailyOverviewSource {
  id: string;
  workPlanId: number;
  batchId: number | null;
  jobCode: string;
  jobName: string;
  productionDate: Date;
  inputMaterialQty: CostRow["input_material_qty"];
  materialCost: CostRow["material_cost"];
  totalCost: CostRow["total_cost"];
  outputQty: CostRow["output_qty"];
  outputUnit: string | null;
  timeUsedMinutes: number | null;
  operators: string[];
}

interface ExecutionsLookup {
  byBatchId: Map<number, ProcessExecutionRow[]>;
  byWorkPlanId: Map<number, ProcessExecutionRow[]>;
}

function buildResultItem(
  c: CostRow,
  wp: WpInfo | undefined,
  yieldPercent: number | null,
  timerStatus: TimerStatus,
  dataCompleteness: ProductionDataCompleteness,
) {
  return {
    id: String(c.id),
    jobId: c.work_plan_id != null ? String(c.work_plan_id) : null,
    jobCode: c.job_code,
    jobName: c.job_name,
    productionDate: c.production_date,
    materialCost: c.material_cost ? Number(c.material_cost) : null,
    totalCost: c.total_cost ? Number(c.total_cost) : null,
    outputQty: c.output_qty ? Number(c.output_qty) : null,
    outputUnit: c.output_unit,
    yieldPercent,
    timeUsedMinutes: c.time_used_minutes,
    operators: wp?.operators ?? [],
    timerStatus,
    dataCompleteness,
  };
}

function buildCompositeKey(
  jobCode: string,
  buId: number | null | undefined,
  productionDate: Date,
): string {
  const dateKey = formatDateOnlyBangkok(productionDate);
  return `${jobCode}_${buId ?? "null"}_${dateKey}`;
}

function buildWpInfo(
  wp: WorkPlanRow,
  idCodeToName: Map<string, string>,
): WpInfo {
  const operators = wp.work_plan_operators
    .map((op) => {
      if (op.users?.name) return op.users.name;
      if (op.id_code) return idCodeToName.get(op.id_code) ?? op.id_code;
      return null;
    })
    .filter((name): name is string => name != null);

  return { operators };
}

function buildWpLookup(
  workPlans: WorkPlanRow[],
  idCodeToName: Map<string, string>,
) {
  const byWorkPlanId = new Map<string, WpInfo>();
  const byComposite = new Map<string, WpInfo>();

  for (const wp of workPlans) {
    const info = buildWpInfo(wp, idCodeToName);
    byWorkPlanId.set(String(wp.id), info);
    byComposite.set(
      buildCompositeKey(wp.job_code, wp.bu_id, wp.production_date),
      info,
    );
  }

  return { byWorkPlanId, byComposite };
}

function lookupWpInfo(
  cost: CostRow,
  lookup: ReturnType<typeof buildWpLookup>,
): WpInfo | undefined {
  if (cost.work_plan_id != null) {
    const byId = lookup.byWorkPlanId.get(String(cost.work_plan_id));
    if (byId) return byId;
  }

  return lookup.byComposite.get(
    buildCompositeKey(cost.job_code, cost.bu_id, cost.production_date),
  );
}

function buildCostLookup(costs: CostRow[]) {
  const byWorkPlanId = new Map<number, CostRow>();
  const byComposite = new Map<string, CostRow>();

  for (const cost of costs) {
    if (cost.work_plan_id != null) {
      byWorkPlanId.set(Number(cost.work_plan_id), cost);
    }
    byComposite.set(
      buildCompositeKey(cost.job_code, cost.bu_id, cost.production_date),
      cost,
    );
  }

  return { byWorkPlanId, byComposite };
}

function lookupCostForWorkPlan(
  wp: WorkPlanRow,
  lookup: ReturnType<typeof buildCostLookup>,
): CostRow | undefined {
  const byId = lookup.byWorkPlanId.get(wp.id);
  if (byId) return byId;

  return lookup.byComposite.get(
    buildCompositeKey(wp.job_code, wp.bu_id, wp.production_date),
  );
}

function buildDailyOverviewSources(
  workPlans: WorkPlanRow[],
  costs: CostRow[],
  batchByWorkPlanId: Map<number, number>,
  idCodeToName: Map<string, string>,
): DailyOverviewSource[] {
  const costLookup = buildCostLookup(costs);

  return workPlans.map((wp) => {
    const cost = lookupCostForWorkPlan(wp, costLookup);
    const wpInfo = buildWpInfo(wp, idCodeToName);
    const batchId =
      cost?.batch_id != null
        ? cost.batch_id
        : (batchByWorkPlanId.get(wp.id) ?? null);

    return {
      id: cost != null ? String(cost.id) : `wp-${wp.id}`,
      workPlanId: wp.id,
      batchId,
      jobCode: wp.job_code,
      jobName: cost?.job_name ?? wp.job_name ?? wp.job_code,
      productionDate: wp.production_date,
      inputMaterialQty: cost?.input_material_qty ?? null,
      materialCost: cost?.material_cost ?? null,
      totalCost: cost?.total_cost ?? null,
      outputQty: cost?.output_qty ?? null,
      outputUnit: cost?.output_unit ?? null,
      timeUsedMinutes: cost?.time_used_minutes ?? null,
      operators: wpInfo.operators,
    };
  });
}

function resolveExecutionsForSource(
  source: DailyOverviewSource,
  executionsLookup: ExecutionsLookup,
): {
  batchExecutions: ProcessExecutionRow[];
  workPlanExecutions: ProcessExecutionRow[];
} {
  const batchExecutions =
    source.batchId != null
      ? (executionsLookup.byBatchId.get(source.batchId) ?? [])
      : [];
  const workPlanExecutions =
    executionsLookup.byWorkPlanId.get(source.workPlanId) ?? [];

  return { batchExecutions, workPlanExecutions };
}

function buildResultItemFromSource(
  source: DailyOverviewSource,
  yieldPercent: number | null,
  timerStatus: TimerStatus,
  dataCompleteness: ProductionDataCompleteness,
) {
  return {
    id: source.id,
    jobId: String(source.workPlanId),
    jobCode: source.jobCode,
    jobName: source.jobName,
    productionDate: source.productionDate,
    materialCost: source.materialCost ? Number(source.materialCost) : null,
    totalCost: source.totalCost ? Number(source.totalCost) : null,
    outputQty: source.outputQty ? Number(source.outputQty) : null,
    outputUnit: source.outputUnit,
    yieldPercent,
    timeUsedMinutes: source.timeUsedMinutes,
    operators: source.operators,
    timerStatus,
    dataCompleteness,
  };
}

// ─── Job-code categorisation ──────────────────────────────────────────────────

type JobCategory =
  | "production"
  | "repack"
  | "vegetable"
  | "requisition"
  | "formula"
  | "other";

function categorizeByJobCode(jobCode: string): JobCategory {
  const code = jobCode.trim();
  const upper = code.toUpperCase();

  // ลงท้ายด้วย R → Repack
  if (upper.endsWith("R")) return "repack";

  // รหัส Repack พิเศษ (ไม่ลงท้าย R)
  if (code === "135014" || code === "240003") return "repack";

  // ขึ้นต้นด้วย 153005 → ทำผัก
  if (code.startsWith("153005")) return "vegetable";

  // ขึ้นต้นด้วย A, B, C → เบิกของ
  const firstChar = upper[0];
  if (firstChar === "A" || firstChar === "B" || firstChar === "C")
    return "requisition";

  // ขึ้นต้นด้วย D → ตวงสูตร
  if (firstChar === "D") return "formula";

  // ตัวเลขล้วน: > 3 หลัก → Production, ≤ 3 หลัก → อื่น ๆ
  // ยกเว้นรหัสพิเศษ → อื่น ๆ (1000 งานธุรการ, 135010 ทำความสะอาด)
  if (/^\d+$/.test(code)) {
    if (code === "1000" || code === "135010") return "other";
    return code.length > 3 ? "production" : "other";
  }

  return "other";
}

const COMPLETENESS_PATTERN_ORDER = [
  "1_1_1",
  "0_1_1",
  "1_1_0",
  "1_0_1",
  "0_1_0",
  "0_0_1",
  "1_0_0",
  "0_0_0",
] as const;

interface ProductionCompletenessRow {
  id: number;
  jobCode: string;
  jobName: string | null;
  productionDate: Date;
  pattern: string;
  hasPrice: boolean;
  hasTimer: boolean;
  hasOutput: boolean;
  conversionVerified: boolean | null;
  fgCode: string | null;
  conversionWarnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CostDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productionLogService: ProductionLogService,
    private readonly batchResolver: BatchResolverService,
  ) {}

  async getDailyOverview(date: string) {
    const targetDate = parseDateOnlyBangkok(date);
    const nextDay = nextDateOnlyBangkok(date);

    const [workPlans, costs] = await Promise.all([
      this.prisma.work_plans.findMany({
        where: { production_date: { gte: targetDate, lt: nextDay } },
        orderBy: { job_name: "asc" },
        select: {
          id: true,
          job_code: true,
          job_name: true,
          bu_id: true,
          production_date: true,
          work_plan_operators: {
            select: {
              id_code: true,
              users: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.production_costs.findMany({
        where: { production_date: { gte: targetDate, lt: nextDay } },
      }),
    ]);

    const workPlanIds = workPlans.map((wp) => wp.id);
    const idCodeToName = await this._resolveIdCodes(
      this._collectOrphanIdCodes(workPlans),
    );
    const batchByWorkPlanId = await this._loadBatchByWorkPlanLookup(workPlanIds);
    const sources = buildDailyOverviewSources(
      workPlans,
      costs,
      batchByWorkPlanId,
      idCodeToName,
    );

    const batchIds = sources.map((source) => source.batchId);
    const [batchLookup, executionsLookup, logTimingsLookup, materialWeighingLookup] =
      await Promise.all([
        this._loadBatchResults(batchIds),
        this._loadExecutionsLookup({
          batchIds,
          workPlanIds,
        }),
        this._loadLogTimingsLookup(workPlanIds),
        this._loadMaterialWeighingLookup(batchIds),
      ]);

    return this._mapDailySourcesToResults(
      sources,
      batchLookup,
      executionsLookup,
      logTimingsLookup,
      materialWeighingLookup,
    );
  }

  async searchHistory(q: string, limit = 50) {
    const term = q.trim();
    if (!term) return [];

    const [byJobCode, byJobName, byOperator] = await Promise.all([
      this.prisma.production_costs.findMany({
        where: { job_code: { contains: term } },
        orderBy: { production_date: "desc" },
        take: limit,
      }),
      this.prisma.production_costs.findMany({
        where: { job_name: { contains: term } },
        orderBy: { production_date: "desc" },
        take: limit,
      }),
      this._searchByOperatorName(term, limit),
    ]);

    const seen = new Set<string>();
    const merged = [...byJobCode, ...byJobName, ...byOperator].filter(
      (cost: CostRow) => {
        const key = String(cost.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      },
    );

    merged.sort(
      (a: CostRow, b: CostRow) =>
        new Date(b.production_date).getTime() -
        new Date(a.production_date).getTime(),
    );

    return this._enrichWithWpData(merged);
  }

  private async _loadBatchResults(
    batchIds: Array<number | null | undefined>,
  ): Promise<Map<number, BatchYieldSource>> {
    const uniqueIds = [
      ...new Set(
        batchIds.filter((id): id is number => id != null && Number.isFinite(id)),
      ),
    ];
    if (uniqueIds.length === 0) return new Map();

    const rows = await this.prisma.batch_production_results.findMany({
      where: { batch_id: { in: uniqueIds } },
      select: {
        batch_id: true,
        good_qty: true,
        good_secondary_qty: true,
        defect_qty: true,
      },
    });

    return new Map(rows.map((row) => [row.batch_id, row]));
  }

  private async _loadBatchByWorkPlanLookup(
    workPlanIds: number[],
  ): Promise<Map<number, number>> {
    const uniqueIds = [...new Set(workPlanIds.filter(Number.isFinite))];
    if (uniqueIds.length === 0) return new Map();

    const rows = await this.prisma.production_batches.findMany({
      where: { work_plan_id: { in: uniqueIds } },
      select: { id: true, work_plan_id: true },
      orderBy: { id: "asc" },
    });

    const lookup = new Map<number, number>();
    for (const row of rows) {
      if (!lookup.has(row.work_plan_id)) {
        lookup.set(row.work_plan_id, row.id);
      }
    }

    return lookup;
  }

  private async _loadExecutionsLookup(params: {
    batchIds: Array<number | null | undefined>;
    workPlanIds: number[];
  }): Promise<ExecutionsLookup> {
    const batchIds = [
      ...new Set(
        params.batchIds.filter(
          (id): id is number => id != null && Number.isFinite(id),
        ),
      ),
    ];
    const workPlanIds = [...new Set(params.workPlanIds.filter(Number.isFinite))];

    const [batchRows, workPlanRows] = await Promise.all([
      batchIds.length > 0
        ? this.prisma.process_executions.findMany({
            where: { batch_id: { in: batchIds } },
            select: { batch_id: true, process_number: true, status: true, start_time: true, end_time: true },
          })
        : Promise.resolve([]),
      workPlanIds.length > 0
        ? this.prisma.process_executions.findMany({
            where: { work_plan_id: { in: workPlanIds } },
            select: {
              work_plan_id: true,
              process_number: true,
              status: true,
              start_time: true,
              end_time: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const byBatchId = new Map<number, ProcessExecutionRow[]>();
    for (const row of batchRows) {
      if (row.batch_id == null) continue;
      const list = byBatchId.get(row.batch_id) ?? [];
      list.push({
        process_number: row.process_number,
        status: row.status,
        start_time: row.start_time,
        end_time: row.end_time,
      });
      byBatchId.set(row.batch_id, list);
    }

    const byWorkPlanId = new Map<number, ProcessExecutionRow[]>();
    for (const row of workPlanRows) {
      if (row.work_plan_id == null) continue;
      const list = byWorkPlanId.get(row.work_plan_id) ?? [];
      list.push({
        process_number: row.process_number,
        status: row.status,
        start_time: row.start_time,
        end_time: row.end_time,
      });
      byWorkPlanId.set(row.work_plan_id, list);
    }

    return { byBatchId, byWorkPlanId };
  }

  private async _loadLogTimingsLookup(
    workPlanIds: number[],
  ): Promise<Map<number, Map<number, StepLogTiming>>> {
    const uniqueIds = [...new Set(workPlanIds.filter(Number.isFinite))];
    if (uniqueIds.length === 0) return new Map();

    const entries = await Promise.all(
      uniqueIds.map(async (workPlanId) => {
        try {
          const timings =
            await this.productionLogService.getStepTimings(workPlanId);
          return [workPlanId, timings] as const;
        } catch {
          return [workPlanId, new Map<number, StepLogTiming>()] as const;
        }
      }),
    );

    return new Map(entries);
  }

  private async _loadMaterialWeighingLookup(
    batchIds: Array<number | null | undefined>,
  ): Promise<Map<number, boolean>> {
    const uniqueIds = [
      ...new Set(
        batchIds.filter((id): id is number => id != null && Number.isFinite(id)),
      ),
    ];
    if (uniqueIds.length === 0) return new Map();

    const rows = await this.prisma.batch_material_usage.findMany({
      where: { batch_id: { in: uniqueIds } },
      select: { batch_id: true, actual_qty: true },
    });

    const lookup = new Map<number, boolean>();
    for (const row of rows) {
      if (lookup.get(row.batch_id)) continue;
      lookup.set(row.batch_id, Number(row.actual_qty) > 0);
    }

    return lookup;
  }

  private _mapDailySourcesToResults(
    sources: DailyOverviewSource[],
    batchLookup: Map<number, BatchYieldSource>,
    executionsLookup: ExecutionsLookup,
    logTimingsLookup: Map<number, Map<number, StepLogTiming>>,
    materialWeighingLookup: Map<number, boolean>,
  ) {
    return sources.map((source) => {
      const batchResult =
        source.batchId != null ? batchLookup.get(source.batchId) : undefined;
      const yieldPercent = resolveYieldPercentFromBatch(
        source.inputMaterialQty,
        batchResult,
      );
      const { batchExecutions, workPlanExecutions } = resolveExecutionsForSource(
        source,
        executionsLookup,
      );
      const logTimings = logTimingsLookup.get(source.workPlanId);
      const timerStatus = resolveTimerStatusForCost({
        batchExecutions,
        workPlanExecutions,
        logTimings,
        timeUsedMinutes: source.timeUsedMinutes,
      });
      const batchHasWeighingRecords =
        source.batchId != null
          ? (materialWeighingLookup.get(source.batchId) ?? false)
          : false;
      const dataCompleteness = resolveProductionDataCompleteness({
        inputMaterialQty: source.inputMaterialQty,
        materialCost: source.materialCost,
        batchHasWeighingRecords,
        outputQty: source.outputQty,
        batchResult,
        timerStatus,
      });

      return buildResultItemFromSource(
        source,
        yieldPercent,
        timerStatus,
        dataCompleteness,
      );
    });
  }

  private _mapCostsToResults(
    costs: CostRow[],
    lookup: ReturnType<typeof buildWpLookup>,
    batchLookup: Map<number, BatchYieldSource>,
    executionsLookup: ExecutionsLookup,
    logTimingsLookup: Map<number, Map<number, StepLogTiming>>,
    materialWeighingLookup: Map<number, boolean>,
  ) {
    return costs.map((cost: CostRow) => {
      const batchResult =
        cost.batch_id != null ? batchLookup.get(cost.batch_id) : undefined;
      const yieldPercent = resolveYieldPercentFromBatch(
        cost.input_material_qty,
        batchResult,
      );
      const { batchExecutions, workPlanExecutions } = resolveExecutionsForSource(
        {
          id: String(cost.id),
          workPlanId: Number(cost.work_plan_id),
          batchId: cost.batch_id,
          jobCode: cost.job_code,
          jobName: cost.job_name,
          productionDate: cost.production_date,
          inputMaterialQty: cost.input_material_qty,
          materialCost: cost.material_cost,
          totalCost: cost.total_cost,
          outputQty: cost.output_qty,
          outputUnit: cost.output_unit,
          timeUsedMinutes: cost.time_used_minutes,
          operators: lookupWpInfo(cost, lookup)?.operators ?? [],
        },
        executionsLookup,
      );
      const logTimings =
        cost.work_plan_id != null
          ? logTimingsLookup.get(Number(cost.work_plan_id))
          : undefined;
      const timerStatus = resolveTimerStatusForCost({
        batchExecutions,
        workPlanExecutions,
        logTimings,
        timeUsedMinutes: cost.time_used_minutes,
      });
      const batchHasWeighingRecords =
        cost.batch_id != null
          ? (materialWeighingLookup.get(cost.batch_id) ?? false)
          : false;
      const dataCompleteness = resolveProductionDataCompleteness({
        inputMaterialQty: cost.input_material_qty,
        materialCost: cost.material_cost,
        batchHasWeighingRecords,
        outputQty: cost.output_qty,
        batchResult,
        timerStatus,
      });

      return buildResultItem(
        cost,
        lookupWpInfo(cost, lookup),
        yieldPercent,
        timerStatus,
        dataCompleteness,
      );
    });
  }

  async getCompletenessSummary(from: string, to: string) {
    const workPlans = await this.prisma.work_plans.findMany({
      where: {
        production_date: {
          gte: parseDateOnlyBangkok(from),
          lt: nextDateOnlyBangkok(to),
        },
      },
      select: { id: true, job_code: true },
    });

    const emptyByCategory = {
      production: 0,
      repack: 0,
      vegetable: 0,
      requisition: 0,
      formula: 0,
      other: 0,
    };

    if (workPlans.length === 0) {
      return {
        total: 0,
        productionCount: 0,
        byCategory: emptyByCategory,
        dateFrom: from,
        dateTo: to,
        groupsByPattern: [],
        byField: {
          hasMaterialPriced: 0,
          hasTimerData: 0,
          hasOutputQty: 0,
          hasVerifiedConversion: 0,
        },
        unverifiedConversionCount: 0,
      };
    }

    const byCategory = { ...emptyByCategory };
    for (const wp of workPlans) {
      byCategory[categorizeByJobCode(wp.job_code)]++;
    }

    const productionRows = await this._loadProductionCompletenessRows(from, to);
    const productionCount = productionRows.length;

    if (productionCount === 0) {
      return {
        total: workPlans.length,
        productionCount: 0,
        byCategory,
        dateFrom: from,
        dateTo: to,
        groupsByPattern: [],
        byField: {
          hasMaterialPriced: 0,
          hasTimerData: 0,
          hasOutputQty: 0,
          hasVerifiedConversion: 0,
        },
        unverifiedConversionCount: 0,
      };
    }

    const patternCounts = new Map<string, number>();
    let fieldMaterial = 0;
    let fieldTimer = 0;
    let fieldOutput = 0;
    let fieldVerifiedConversion = 0;
    let unverifiedConversionCount = 0;

    for (const row of productionRows) {
      if (row.hasPrice) fieldMaterial++;
      if (row.hasTimer) fieldTimer++;
      if (row.hasOutput) fieldOutput++;
      if (row.hasOutput && row.conversionVerified === true) {
        fieldVerifiedConversion++;
      }
      if (row.hasOutput && row.conversionVerified === false) {
        unverifiedConversionCount++;
      }
      patternCounts.set(row.pattern, (patternCounts.get(row.pattern) ?? 0) + 1);
    }

    const groupsByPattern = COMPLETENESS_PATTERN_ORDER.map((pattern) => {
      const [p, t, o] = pattern.split("_").map(Number);
      const count = patternCounts.get(pattern) ?? 0;
      return {
        pattern,
        hasPrice: p === 1,
        hasTimer: t === 1,
        hasOutput: o === 1,
        count,
        ratio: productionCount > 0 ? count / productionCount : 0,
      };
    });

    return {
      total: workPlans.length,
      productionCount,
      byCategory,
      dateFrom: from,
      dateTo: to,
      groupsByPattern,
      byField: {
        hasMaterialPriced: fieldMaterial,
        hasTimerData: fieldTimer,
        hasOutputQty: fieldOutput,
        hasVerifiedConversion: fieldVerifiedConversion,
      },
      unverifiedConversionCount,
    };
  }

  async getUnverifiedConversionPreview(from: string, to: string, limit = 200) {
    const rows = await this._loadProductionCompletenessRows(from, to);
    return rows
      .filter((row) => row.hasOutput && row.conversionVerified === false)
      .slice(0, Math.min(Math.max(limit, 1), 500))
      .map((row) => ({
        jobId: row.id,
        jobCode: row.jobCode,
        jobName: row.jobName,
        productionDate: formatDateOnlyBangkok(row.productionDate),
        fgCode: row.fgCode,
        conversionWarnings: row.conversionWarnings,
      }));
  }

  async getProductionPatternPreview(
    from: string,
    to: string,
    pattern: string,
    limit = 200,
  ) {
    if (!COMPLETENESS_PATTERN_ORDER.includes(pattern as (typeof COMPLETENESS_PATTERN_ORDER)[number])) {
      return [];
    }

    const rows = await this._loadProductionCompletenessRows(from, to);
    return rows
      .filter((row) => row.pattern === pattern)
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        jobCode: row.jobCode,
        jobName: row.jobName,
        productionDate: formatDateOnlyBangkok(row.productionDate),
        pattern: row.pattern,
        hasPrice: row.hasPrice,
        hasTimer: row.hasTimer,
        hasOutput: row.hasOutput,
      }));
  }

  private async _loadProductionCompletenessRows(
    from: string,
    to: string,
  ): Promise<ProductionCompletenessRow[]> {
    const fromDate = parseDateOnlyBangkok(from);
    const toNextDate = nextDateOnlyBangkok(to);

    const workPlans = await this.prisma.work_plans.findMany({
      where: { production_date: { gte: fromDate, lt: toNextDate } },
      select: {
        id: true,
        job_code: true,
        job_name: true,
        production_date: true,
      },
      orderBy: [{ production_date: "desc" }, { job_name: "asc" }],
    });

    const productionWorkPlans = workPlans.filter(
      (wp) => categorizeByJobCode(wp.job_code) === "production",
    );
    if (productionWorkPlans.length === 0) return [];

    const productionIds = productionWorkPlans.map((wp) => wp.id);

    const batches = await this.prisma.production_batches.findMany({
      where: { work_plan_id: { in: productionIds } },
      select: { id: true, work_plan_id: true, product_code: true },
      orderBy: { id: "desc" },
    });

    const batchesByWpId = new Map<number, number[]>();
    const productCodeByWpId = new Map<number, string>();
    for (const batch of batches) {
      const wpBatchIds = batchesByWpId.get(batch.work_plan_id) ?? [];
      wpBatchIds.push(batch.id);
      batchesByWpId.set(batch.work_plan_id, wpBatchIds);
      if (!productCodeByWpId.has(batch.work_plan_id)) {
        productCodeByWpId.set(batch.work_plan_id, batch.product_code);
      }
    }
    const allBatchIds = batches.map((batch) => batch.id);

    const [usageRows, batchResults, costs, executionsLookup, logTimingsLookup] =
      await Promise.all([
        allBatchIds.length > 0
          ? this.prisma.batch_material_usage.findMany({
              where: { batch_id: { in: allBatchIds } },
              select: { batch_id: true, unit_price: true },
            })
          : Promise.resolve([]),
        allBatchIds.length > 0
          ? this.prisma.batch_production_results.findMany({
              where: { batch_id: { in: allBatchIds } },
              select: {
                batch_id: true,
                good_qty: true,
                good_secondary_qty: true,
                good_secondary_unit: true,
                defect_qty: true,
              },
            })
          : Promise.resolve([]),
        this.prisma.production_costs.findMany({
          where: {
            work_plan_id: { in: productionIds.map((id) => BigInt(id)) },
          },
          select: {
            work_plan_id: true,
            output_qty: true,
            time_used_minutes: true,
            material_details: true,
          },
        }),
        this._loadExecutionsLookup({
          batchIds: allBatchIds,
          workPlanIds: productionIds,
        }),
        this._loadLogTimingsLookup(productionIds),
      ]);

    const batchesWithUsage = new Set<number>();
    const batchesWithMissingPrice = new Set<number>();
    for (const row of usageRows) {
      batchesWithUsage.add(row.batch_id);
      if (Number(row.unit_price) <= 0) batchesWithMissingPrice.add(row.batch_id);
    }
    const pricedBatchIds = new Set<number>(
      [...batchesWithUsage].filter((id) => !batchesWithMissingPrice.has(id)),
    );

    const timeUsedByWpId = new Map<number, number | null>();
    const wpIdsWithOutput = new Set<number>();
    for (const cost of costs) {
      if (cost.work_plan_id == null) continue;
      const wpId = Number(cost.work_plan_id);
      timeUsedByWpId.set(wpId, cost.time_used_minutes);
      if (cost.output_qty != null) wpIdsWithOutput.add(wpId);
    }
    const batchIdsWithOutput = new Set(
      batchResults
        .filter((row) => row.good_qty != null)
        .map((row) => row.batch_id),
    );
    const batchResultByBatchId = new Map(
      batchResults.map((row) => [row.batch_id, row]),
    );
    const costByWpId = new Map<number, (typeof costs)[number]>();
    for (const cost of costs) {
      if (cost.work_plan_id == null) continue;
      costByWpId.set(Number(cost.work_plan_id), cost);
    }

    const baseRows = productionWorkPlans.map((wp) => {
      const wpBatchIds = batchesByWpId.get(wp.id) ?? [];
      const batchExecutions = wpBatchIds.flatMap(
        (id) => executionsLookup.byBatchId.get(id) ?? [],
      );
      const workPlanExecutions =
        executionsLookup.byWorkPlanId.get(wp.id) ?? [];
      const timerStatus = resolveTimerStatusForCost({
        batchExecutions,
        workPlanExecutions,
        logTimings: logTimingsLookup.get(wp.id),
        timeUsedMinutes: timeUsedByWpId.get(wp.id) ?? null,
      });
      const hasPrice = wpBatchIds.some((id) => pricedBatchIds.has(id));
      const hasTimer = timerStatus === "ok";
      const hasOutput =
        wpIdsWithOutput.has(wp.id) ||
        wpBatchIds.some((id) => batchIdsWithOutput.has(id));
      const pattern = `${hasPrice ? 1 : 0}_${hasTimer ? 1 : 0}_${hasOutput ? 1 : 0}`;

      return {
        id: wp.id,
        jobCode: wp.job_code,
        jobName: wp.job_name,
        productionDate: wp.production_date,
        pattern,
        hasPrice,
        hasTimer,
        hasOutput,
        productCode: productCodeByWpId.get(wp.id) ?? null,
      };
    });

    return baseRows.map((row) => {
      if (!row.hasOutput) {
        return {
          id: row.id,
          jobCode: row.jobCode,
          jobName: row.jobName,
          productionDate: row.productionDate,
          pattern: row.pattern,
          hasPrice: row.hasPrice,
          hasTimer: row.hasTimer,
          hasOutput: row.hasOutput,
          conversionVerified: null,
          fgCode: null,
          conversionWarnings: [],
        };
      }

      const wpBatchIds = batchesByWpId.get(row.id) ?? [];
      const latestBatchId = wpBatchIds[0];
      const batchSummary = latestBatchId
        ? batchResultByBatchId.get(latestBatchId)
        : undefined;
      const cost = costByWpId.get(row.id);
      const parsed = parseProductionCostMaterialDetails(cost?.material_details);
      const status = resolveSavedConversionStatus({
        outputSnapshot: parsed.outputSnapshot,
        outputLines: parsed.outputLines,
        batchSummary,
      });

      return {
        id: row.id,
        jobCode: row.jobCode,
        jobName: row.jobName,
        productionDate: row.productionDate,
        pattern: row.pattern,
        hasPrice: row.hasPrice,
        hasTimer: row.hasTimer,
        hasOutput: row.hasOutput,
        conversionVerified: status.conversionVerified,
        fgCode: status.fgCode ?? parsed.outputSnapshot?.fgCode ?? null,
        conversionWarnings: status.conversionWarnings,
      };
    });
  }

  /** ดูรายการที่ไม่ใช่งาน Production เพื่อตรวจสอบ job_code pattern */
  async getNonProductionPreview(from: string, to: string, limit = 100) {
    const fromDate = parseDateOnlyBangkok(from);
    const toNextDate = nextDateOnlyBangkok(to);

    const workPlans = await this.prisma.work_plans.findMany({
      where: { production_date: { gte: fromDate, lt: toNextDate } },
      select: { id: true, job_name: true, job_code: true, production_date: true },
      orderBy: { production_date: "desc" },
    });

    return workPlans
      .filter((wp) => categorizeByJobCode(wp.job_code) !== "production")
      .slice(0, limit)
      .map((wp) => ({
        id: wp.id,
        jobCode: wp.job_code,
        jobName: wp.job_name,
        productionDate: formatDateOnlyBangkok(wp.production_date),
        category: categorizeByJobCode(wp.job_code),
      }));
  }

  private _collectOrphanIdCodes(workPlans: WorkPlanRow[]): string[] {
    const orphanIdCodes = new Set<string>();
    for (const wp of workPlans) {
      for (const op of wp.work_plan_operators) {
        if (!op.users && op.id_code) orphanIdCodes.add(op.id_code);
      }
    }
    return [...orphanIdCodes];
  }

  private async _resolveIdCodes(idCodes: string[]): Promise<Map<string, string>> {
    if (idCodes.length === 0) return new Map();
    const users = await this.prisma.users.findMany({
      where: { id_code: { in: idCodes } },
      select: { id_code: true, name: true },
    });
    return new Map(users.map((user) => [user.id_code, user.name]));
  }

  private async _searchByOperatorName(name: string, limit: number) {
    const users = await this.prisma.users.findMany({
      where: { name: { contains: name }, is_active: true },
      select: { id: true, id_code: true },
    });
    if (users.length === 0) return [];

    const userIds = users.map((user) => user.id);
    const idCodes = users.map((user) => user.id_code);

    const workPlans = await this.prisma.work_plans.findMany({
      where: {
        work_plan_operators: {
          some: {
            OR: [
              { user_id: { in: userIds } },
              { id_code: { in: idCodes } },
            ],
          },
        },
      },
      select: { job_code: true },
      take: limit,
    });
    if (workPlans.length === 0) return [];

    const jobCodes = [...new Set(workPlans.map((wp) => wp.job_code))];
    return this.prisma.production_costs.findMany({
      where: { job_code: { in: jobCodes } },
      orderBy: { production_date: "desc" },
      take: limit,
    });
  }

  private async _enrichWithWpData(costs: CostRow[]) {
    if (costs.length === 0) return [];

    const workPlanIds = costs
      .map((cost) => cost.work_plan_id)
      .filter((id): id is bigint => id != null);

    const wps = await this.prisma.work_plans.findMany({
      where: {
        OR: [
          ...(workPlanIds.length > 0
            ? [{ id: { in: workPlanIds.map((id) => Number(id)) } }]
            : []),
          ...costs.map((cost: CostRow) => ({
            job_code: cost.job_code,
            bu_id: cost.bu_id ?? undefined,
            production_date: cost.production_date,
          })),
        ],
      },
      select: {
        id: true,
        job_code: true,
        job_name: true,
        bu_id: true,
        production_date: true,
        work_plan_operators: {
          select: {
            id_code: true,
            users: { select: { name: true } },
          },
        },
      },
    });

    const idCodeToName = await this._resolveIdCodes(
      this._collectOrphanIdCodes(wps),
    );
    const lookup = buildWpLookup(wps, idCodeToName);
    const [batchLookup, executionsLookup, logTimingsLookup, materialWeighingLookup] =
      await Promise.all([
      this._loadBatchResults(costs.map((cost: CostRow) => cost.batch_id)),
      this._loadExecutionsLookup({
        batchIds: costs.map((cost: CostRow) => cost.batch_id),
        workPlanIds: costs
          .map((cost) => cost.work_plan_id)
          .filter((id): id is bigint => id != null)
          .map((id) => Number(id)),
      }),
      this._loadLogTimingsLookup(
        costs
          .map((cost) => cost.work_plan_id)
          .filter((id): id is bigint => id != null)
          .map((id) => Number(id)),
      ),
      this._loadMaterialWeighingLookup(
        costs.map((cost: CostRow) => cost.batch_id),
      ),
    ]);

    return this._mapCostsToResults(
      costs,
      lookup,
      batchLookup,
      executionsLookup,
      logTimingsLookup,
      materialWeighingLookup,
    );
  }
}
