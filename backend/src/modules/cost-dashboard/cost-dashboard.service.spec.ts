import { describe, expect, it, vi } from "vitest";
import { CostDashboardService } from "./cost-dashboard.service";
import type { PrismaService } from "../../shared/prisma/prisma.module";
import type { ProductionLogService } from "../../shared/services/production-log.service";
import type { BatchResolverService } from "../../shared/services/batch-resolver.service";

function createService(
  prismaOverrides: Record<string, unknown>,
  logOverrides?: Partial<ProductionLogService>,
  batchResolverOverrides?: Partial<BatchResolverService>,
) {
  const productionLogService = {
    getStepTimings: vi.fn().mockResolvedValue(new Map()),
    ...logOverrides,
  } as unknown as ProductionLogService;

  const batchResolver = {
    resolveProductOutputConfig: vi.fn().mockResolvedValue({
      conversionVerified: true,
      fgCode: null,
      conversionWarnings: [],
    }),
    ...batchResolverOverrides,
  } as unknown as BatchResolverService;

  return new CostDashboardService(
    prismaOverrides as unknown as PrismaService,
    productionLogService,
    batchResolver,
  );
}

function completedExecution(
  processNumber: number,
  workPlanId?: number,
  batchId?: number,
) {
  return {
    work_plan_id: workPlanId,
    batch_id: batchId,
    process_number: processNumber,
    status: "completed",
    start_time: new Date("2026-06-18T08:00:00+07:00"),
    end_time: new Date("2026-06-18T09:00:00+07:00"),
  };
}

describe("CostDashboardService.getDailyOverview", () => {
  it("joins work plan data by work_plan_id", async () => {
    const productionDate = new Date("2026-06-18T00:00:00+07:00");
    const service = createService({
      production_costs: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 11n,
            work_plan_id: 501n,
            bu_id: 1,
            batch_id: 9001,
            job_code: "JOB-001",
            job_name: "Product A",
            production_date: productionDate,
            input_material_qty: 100,
            material_cost: 100,
            total_cost: 250,
            output_qty: 800,
            output_unit: "ถุง",
            time_used_minutes: 90,
          },
        ]),
      },
      work_plans: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 501,
            job_code: "JOB-001",
            job_name: "Product A",
            bu_id: 1,
            production_date: productionDate,
            work_plan_operators: [
              { id_code: "u001", users: { name: "สมชาย" } },
            ],
          },
        ]),
      },
      production_batches: {
        findMany: vi.fn().mockResolvedValue([
          { id: 9001, work_plan_id: 501 },
        ]),
      },
      batch_production_results: {
        findMany: vi.fn().mockResolvedValue([
          {
            batch_id: 9001,
            good_qty: 800,
            good_secondary_qty: 88,
            defect_qty: 12,
          },
        ]),
      },
      batch_material_usage: {
        findMany: vi.fn().mockResolvedValue([
          { batch_id: 9001, actual_qty: 100 },
        ]),
      },
      process_executions: {
        findMany: vi.fn().mockResolvedValue([
          {
            batch_id: 9001,
            work_plan_id: 501,
            process_number: 1,
            status: "completed",
            start_time: new Date("2026-06-18T08:00:00+07:00"),
            end_time: new Date("2026-06-18T10:00:00+07:00"),
          },
        ]),
      },
      users: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const result = await service.getDailyOverview("2026-06-18");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "11",
      jobId: "501",
      jobCode: "JOB-001",
      operators: ["สมชาย"],
      timerStatus: "ok",
      totalCost: 250,
      yieldPercent: 100,
      dataCompleteness: {
        percent: 100,
        hasMaterialWeighing: true,
        hasTimerData: true,
        hasOutputQty: true,
      },
    });
  });

  it("shows warn when time was recorded but step data is missing", async () => {
    const productionDate = new Date("2026-06-18T00:00:00+07:00");
    const service = createService({
      production_costs: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 13n,
            work_plan_id: 503n,
            bu_id: 2,
            batch_id: 9002,
            job_code: "JOB-003",
            job_name: "Product C",
            production_date: productionDate,
            input_material_qty: 50,
            material_cost: 100,
            total_cost: 200,
            output_qty: 10,
            output_unit: "kg",
            time_used_minutes: 90,
          },
        ]),
      },
      work_plans: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 503,
            job_code: "JOB-003",
            job_name: "Product C",
            bu_id: 2,
            production_date: productionDate,
            work_plan_operators: [],
          },
        ]),
      },
      production_batches: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_production_results: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_material_usage: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      process_executions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      users: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const result = await service.getDailyOverview("2026-06-18");

    expect(result[0]?.timerStatus).toBe("warn");
    expect(result[0]?.dataCompleteness.percent).toBe(67);
  });

  it("returns no_data timer status when work plan has no executions", async () => {
    const productionDate = new Date("2026-06-18T00:00:00+07:00");
    const service = createService({
      production_costs: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 12n,
            work_plan_id: 502n,
            bu_id: 2,
            batch_id: null,
            job_code: "JOB-002",
            job_name: "Product B",
            production_date: productionDate,
            input_material_qty: null,
            material_cost: null,
            total_cost: null,
            output_qty: null,
            output_unit: null,
            time_used_minutes: null,
          },
        ]),
      },
      work_plans: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 502,
            job_code: "JOB-002",
            job_name: "Product B",
            bu_id: 2,
            production_date: productionDate,
            work_plan_operators: [],
          },
        ]),
      },
      production_batches: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_production_results: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_material_usage: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      process_executions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      users: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const result = await service.getDailyOverview("2026-06-18");

    expect(result[0]?.timerStatus).toBe("no_data");
    expect(result[0]?.dataCompleteness.percent).toBe(0);
    expect(result[0]?.operators).toEqual([]);
    expect(result[0]?.yieldPercent).toBeNull();
  });

  it("lists all work plans for the day even when production_cost is missing", async () => {
    const productionDate = new Date("2026-06-18T00:00:00+07:00");
    const service = createService({
      production_costs: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 11n,
            work_plan_id: 501n,
            bu_id: 1,
            batch_id: 9001,
            job_code: "JOB-001",
            job_name: "Product A",
            production_date: productionDate,
            input_material_qty: 100,
            material_cost: 100,
            total_cost: 250,
            output_qty: 800,
            output_unit: "ถุง",
            time_used_minutes: 90,
          },
        ]),
      },
      work_plans: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 501,
            job_code: "JOB-001",
            job_name: "Product A",
            bu_id: 1,
            production_date: productionDate,
            work_plan_operators: [{ id_code: "u001", users: { name: "สมชาย" } }],
          },
          {
            id: 502,
            job_code: "JOB-002",
            job_name: "Product B",
            bu_id: 2,
            production_date: productionDate,
            work_plan_operators: [],
          },
        ]),
      },
      production_batches: {
        findMany: vi.fn().mockResolvedValue([
          { id: 9001, work_plan_id: 501 },
        ]),
      },
      batch_production_results: {
        findMany: vi.fn().mockResolvedValue([
          {
            batch_id: 9001,
            good_qty: 800,
            good_secondary_qty: 88,
            defect_qty: 12,
          },
        ]),
      },
      batch_material_usage: {
        findMany: vi.fn().mockResolvedValue([
          { batch_id: 9001, actual_qty: 100 },
        ]),
      },
      process_executions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      users: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const result = await service.getDailyOverview("2026-06-18");

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      id: "wp-502",
      jobId: "502",
      jobCode: "JOB-002",
      jobName: "Product B",
      totalCost: null,
      yieldPercent: null,
      timeUsedMinutes: null,
      timerStatus: "no_data",
      dataCompleteness: {
        percent: 0,
        hasMaterialWeighing: false,
        hasTimerData: false,
        hasOutputQty: false,
      },
    });
  });
});

describe("CostDashboardService.searchHistory", () => {
  it("returns empty array for blank query", async () => {
    const service = createService({});
    await expect(service.searchHistory("   ")).resolves.toEqual([]);
  });
});

describe("CostDashboardService.getCompletenessSummary", () => {
  it("counts completeness patterns only for production job codes", async () => {
    const productionDate = new Date("2026-06-18T00:00:00+07:00");
    const service = createService({
      work_plans: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, job_code: "12345" },
          { id: 2, job_code: "12346" },
          { id: 3, job_code: "A001" },
          { id: 4, job_code: "15300501" },
        ]),
      },
      production_batches: {
        findMany: vi.fn().mockResolvedValue([
          { id: 101, work_plan_id: 1 },
          { id: 102, work_plan_id: 2 },
        ]),
      },
      process_executions: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          if ("work_plan_id" in where) {
            return Promise.resolve([
              completedExecution(1, 1),
              completedExecution(1, 2),
            ]);
          }
          if ("batch_id" in where) {
            return Promise.resolve([
              completedExecution(1, undefined, 101),
              completedExecution(1, undefined, 102),
            ]);
          }
          return Promise.resolve([]);
        }),
      },
      production_costs: {
        findMany: vi.fn().mockResolvedValue([
          {
            work_plan_id: 1n,
            output_qty: 50,
            time_used_minutes: 60,
          },
        ]),
      },
      batch_material_usage: {
        findMany: vi.fn().mockResolvedValue([
          { batch_id: 101, unit_price: 10 },
          { batch_id: 102, unit_price: 0 },
        ]),
      },
      batch_production_results: {
        findMany: vi.fn().mockResolvedValue([
          { batch_id: 101, good_qty: 50 },
        ]),
      },
    });

    const result = await service.getCompletenessSummary(
      "2026-06-18",
      "2026-06-18",
    );

    expect(result.total).toBe(4);
    expect(result.productionCount).toBe(2);
    expect(result.byCategory.production).toBe(2);

    const patternSum = result.groupsByPattern.reduce(
      (sum, group) => sum + group.count,
      0,
    );
    expect(patternSum).toBe(result.productionCount);

    expect(result.groupsByPattern.find((g) => g.pattern === "1_1_1")?.count).toBe(
      1,
    );
    expect(result.groupsByPattern.find((g) => g.pattern === "0_1_0")?.count).toBe(
      1,
    );
  });

  it("categorizes administrative job code 1000 as other", async () => {
    const productionDate = new Date("2026-06-18T00:00:00+07:00");
    const service = createService({
      work_plans: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, job_code: "12345" },
          { id: 2, job_code: "1000" },
          { id: 3, job_code: "12" },
        ]),
      },
      production_batches: {
        findMany: vi.fn().mockResolvedValue([{ id: 101, work_plan_id: 1 }]),
      },
      process_executions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      production_costs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_material_usage: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_production_results: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await service.getCompletenessSummary(
      "2026-06-18",
      "2026-06-18",
    );

    expect(result.total).toBe(3);
    expect(result.productionCount).toBe(1);
    expect(result.byCategory.production).toBe(1);
    expect(result.byCategory.other).toBe(2);
  });

  it("categorizes cleaning job code 135010 as other", async () => {
    const service = createService({
      work_plans: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, job_code: "12345" },
          { id: 2, job_code: "135010" },
        ]),
      },
      production_batches: {
        findMany: vi.fn().mockResolvedValue([{ id: 101, work_plan_id: 1 }]),
      },
      process_executions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      production_costs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_material_usage: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_production_results: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await service.getCompletenessSummary(
      "2026-06-18",
      "2026-06-18",
    );

    expect(result.productionCount).toBe(1);
    expect(result.byCategory.production).toBe(1);
    expect(result.byCategory.other).toBe(1);
  });

  it("categorizes crab meat job code 135014 as repack", async () => {
    const service = createService({
      work_plans: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, job_code: "12345" },
          { id: 2, job_code: "135014" },
        ]),
      },
      production_batches: {
        findMany: vi.fn().mockResolvedValue([{ id: 101, work_plan_id: 1 }]),
      },
      process_executions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      production_costs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_material_usage: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_production_results: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await service.getCompletenessSummary(
      "2026-06-18",
      "2026-06-18",
    );

    expect(result.productionCount).toBe(1);
    expect(result.byCategory.production).toBe(1);
    expect(result.byCategory.repack).toBe(1);
  });

  it("categorizes kun chiang repack job code 240003 as repack", async () => {
    const service = createService({
      work_plans: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, job_code: "12345" },
          { id: 2, job_code: "240003" },
        ]),
      },
      production_batches: {
        findMany: vi.fn().mockResolvedValue([{ id: 101, work_plan_id: 1 }]),
      },
      process_executions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      production_costs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_material_usage: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      batch_production_results: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await service.getCompletenessSummary(
      "2026-06-18",
      "2026-06-18",
    );

    expect(result.productionCount).toBe(1);
    expect(result.byCategory.production).toBe(1);
    expect(result.byCategory.repack).toBe(1);
  });

  it("counts timer complete from production logs when executions are missing", async () => {
    const service = createService(
      {
        work_plans: {
          findMany: vi.fn().mockResolvedValue([
            { id: 501, job_code: "235026", job_name: "Sample", production_date: new Date("2026-06-01T00:00:00+07:00") },
          ]),
        },
        production_batches: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        process_executions: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        production_costs: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        batch_material_usage: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        batch_production_results: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      {
        getStepTimings: vi.fn().mockImplementation(async (workPlanId: number) => {
          if (workPlanId !== 501) return new Map();
          return new Map([
            [1, { processNumber: 1, completed: true }],
            [2, { processNumber: 2, completed: true }],
          ]);
        }),
      },
    );

    const result = await service.getCompletenessSummary(
      "2026-06-01",
      "2026-06-01",
    );

    expect(result.productionCount).toBe(1);
    expect(result.byField.hasTimerData).toBe(1);
    expect(result.groupsByPattern.find((group) => group.pattern === "0_1_0")?.count).toBe(
      1,
    );
  });

  it("returns production items for a completeness pattern preview", async () => {
    const productionDate = new Date("2026-06-18T00:00:00+07:00");
    const service = createService({
      work_plans: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, job_code: "12345", job_name: "Product A", production_date: productionDate },
          { id: 2, job_code: "12346", job_name: "Product B", production_date: productionDate },
        ]),
      },
      production_batches: {
        findMany: vi.fn().mockResolvedValue([
          { id: 101, work_plan_id: 1 },
          { id: 102, work_plan_id: 2 },
        ]),
      },
      process_executions: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          if ("work_plan_id" in where) {
            return Promise.resolve([
              completedExecution(1, 1),
              completedExecution(1, 2),
            ]);
          }
          if ("batch_id" in where) {
            return Promise.resolve([
              completedExecution(1, undefined, 101),
              completedExecution(1, undefined, 102),
            ]);
          }
          return Promise.resolve([]);
        }),
      },
      production_costs: {
        findMany: vi.fn().mockResolvedValue([
          { work_plan_id: 1n, output_qty: 50, time_used_minutes: 60 },
        ]),
      },
      batch_material_usage: {
        findMany: vi.fn().mockResolvedValue([
          { batch_id: 101, unit_price: 10 },
          { batch_id: 102, unit_price: 0 },
        ]),
      },
      batch_production_results: {
        findMany: vi.fn().mockResolvedValue([{ batch_id: 101, good_qty: 50 }]),
      },
    });

    const result = await service.getProductionPatternPreview(
      "2026-06-18",
      "2026-06-18",
      "1_1_1",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      jobCode: "12345",
      jobName: "Product A",
      pattern: "1_1_1",
      hasPrice: true,
      hasTimer: true,
      hasOutput: true,
    });
  });

  it("counts unverified conversion jobs from saved snapshot", async () => {
    const productionDate = new Date("2026-06-18T00:00:00+07:00");
    const resolveProductOutputConfig = vi.fn();

    const service = createService(
      {
        work_plans: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 1,
              job_code: "12345",
              job_name: "Product A",
              production_date: productionDate,
            },
            {
              id: 2,
              job_code: "99999",
              job_name: "Product B",
              production_date: productionDate,
            },
          ]),
        },
        production_batches: {
          findMany: vi.fn().mockResolvedValue([
            { id: 101, work_plan_id: 1, product_code: "12345" },
            { id: 102, work_plan_id: 2, product_code: "99999" },
          ]),
        },
        process_executions: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        production_costs: {
          findMany: vi.fn().mockResolvedValue([
            {
              work_plan_id: 1n,
              output_qty: 10,
              time_used_minutes: 0,
              material_details: {
                materials: [],
                outputSnapshot: {
                  conversionVerified: true,
                  conversionWarnings: [],
                  conversionInfos: [],
                  masterUnit: "ชิ้น",
                  baseUnit: "กก.",
                  fgCode: "12345",
                  outputVariants: [
                    { label: "ชิ้น", unit: "ชิ้น", conversionRate: 0.04 },
                  ],
                },
              },
            },
            {
              work_plan_id: 2n,
              output_qty: 20,
              time_used_minutes: 0,
              material_details: {
                materials: [],
                outputSnapshot: {
                  conversionVerified: false,
                  conversionWarnings: ["ยังไม่มีน้ำหนักต่อแพ็คในระบบ"],
                  conversionInfos: [],
                  masterUnit: "แพ็ค",
                  baseUnit: "กก.",
                  fgCode: null,
                  outputVariants: [
                    { label: "แพ็ค", unit: "แพ็ค", conversionRate: 1 },
                  ],
                },
              },
            },
          ]),
        },
        batch_material_usage: { findMany: vi.fn().mockResolvedValue([]) },
        batch_production_results: { findMany: vi.fn().mockResolvedValue([]) },
      },
      undefined,
      { resolveProductOutputConfig },
    );

    const summary = await service.getCompletenessSummary(
      "2026-06-18",
      "2026-06-18",
    );

    expect(summary.byField.hasVerifiedConversion).toBe(1);
    expect(summary.unverifiedConversionCount).toBe(1);
    expect(resolveProductOutputConfig).not.toHaveBeenCalled();

    const preview = await service.getUnverifiedConversionPreview(
      "2026-06-18",
      "2026-06-18",
    );
    expect(preview).toHaveLength(1);
    expect(preview[0]?.jobCode).toBe("99999");
  });
});
