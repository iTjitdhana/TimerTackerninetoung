import { describe, expect, it, vi } from "vitest";
import { work_plans_workflow_status } from "@prisma/client";
import { ProductionSummaryService } from "./production-summary.service";
import type { PrismaService } from "../../shared/prisma/prisma.module";
import type { BatchResolverService } from "../../shared/services/batch-resolver.service";
import type { ProductionLogService } from "../../shared/services/production-log.service";

const workPlan = {
  id: 42,
  job_code: "135012",
  job_name: "Test Product",
  production_date: new Date("2025-08-26T00:00:00.000Z"),
  bu_id: 1,
};

const batch = {
  id: 53,
  product_code: "135012",
  status: "producing",
};

function createService() {
  const finishedFlagsUpsert = vi.fn().mockResolvedValue({
    work_plan_id: workPlan.id,
    is_finished: true,
  });
  const workPlansUpdate = vi.fn().mockResolvedValue({});
  const batchResultsUpsert = vi.fn().mockResolvedValue({
    batch_id: batch.id,
    good_qty: 10,
    defect_qty: 0,
  });
  const productionBatchesUpdate = vi.fn().mockResolvedValue({});
  const productionCostsUpsert = vi.fn().mockResolvedValue({ id: 1 });

  const tx = {
    batch_production_results: { upsert: batchResultsUpsert },
    production_batches: { update: productionBatchesUpdate },
    production_costs: { upsert: productionCostsUpsert },
    work_plans: { update: workPlansUpdate },
    finished_flags: { upsert: finishedFlagsUpsert },
  };

  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    batch_material_usage: {
      findMany: vi.fn().mockResolvedValue([
        {
          actual_qty: 10,
          unit: "กก.",
          unit_price: 100,
          materials: { material_name: "Flour", material_code: "M001" },
        },
      ]),
    },
    process_executions: {
      findMany: vi.fn().mockResolvedValue([
        {
          start_time: new Date("2025-08-26T08:00:00.000Z"),
          end_time: new Date("2025-08-26T09:00:00.000Z"),
        },
      ]),
    },
    work_plan_operators: {
      count: vi.fn().mockResolvedValue(2),
    },
    unit_conversions: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;

  const batchResolver = {
    resolveWorkPlan: vi.fn().mockResolvedValue(workPlan),
    resolveOrCreateBatch: vi.fn().mockResolvedValue(batch),
    resolveProductOutputConfig: vi.fn().mockResolvedValue({
      defaultOutputUnit: "กก.",
      masterUnit: "กก.",
      conversionRate: 1,
      baseUnit: "กก.",
      conversionVerified: true,
      conversionWarnings: [],
      conversionInfos: [],
      fgCode: null,
      outputVariants: [],
      unitOptions: [{ unit: "กก.", conversionRate: 1 }],
    }),
  } as unknown as BatchResolverService;

  const productionLogService = {
    getWorkPlanWallClockMinutes: vi.fn().mockResolvedValue(0),
  } as unknown as ProductionLogService;

  const service = new ProductionSummaryService(
    prisma,
    batchResolver,
    productionLogService,
  );

  return {
    service,
    finishedFlagsUpsert,
    workPlansUpdate,
  };
}

describe("ProductionSummaryService.create", () => {
  it("upserts finished_flags when saving production summary", async () => {
    const { service, finishedFlagsUpsert, workPlansUpdate } = createService();

    await service.create({
      jobId: "42",
      outputQty: 10,
      outputUnit: "กก.",
      scrapQty: 0,
      dailyWagePerPerson: 450,
      outputLines: [
        {
          kind: "sellable",
          label: "กก.",
          qty: 10,
          unit: "กก.",
          conversionRate: 1,
        },
        {
          kind: "scrap",
          label: "เศษ",
          qty: 0,
          unit: "กก.",
          conversionRate: 1,
        },
      ],
    });

    expect(workPlansUpdate).toHaveBeenCalledWith({
      where: { id: workPlan.id },
      data: { workflow_status: work_plans_workflow_status.completed },
    });
    expect(finishedFlagsUpsert).toHaveBeenCalledWith({
      where: { work_plan_id: workPlan.id },
      create: { work_plan_id: workPlan.id, is_finished: true },
      update: { is_finished: true },
    });
  });
});
