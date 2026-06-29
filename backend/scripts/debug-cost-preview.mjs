import { NestFactory } from "@nestjs/core";
import { AppModule } from "../dist/app.module.js";

const jobId = process.argv[2] ?? "11249";

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const { PrismaService } = await import("../dist/shared/prisma/prisma.module.js");
  const { ProductionSummaryService } = await import(
    "../dist/modules/production-summary/production-summary.service.js"
  );
  const prisma = app.get(PrismaService);
  const summary = app.get(ProductionSummaryService);

  const wp = await prisma.work_plans.findUnique({ where: { id: Number(jobId) } });
  if (!wp) throw new Error(`work plan ${jobId} not found`);

  const batch = await prisma.production_batches.findFirst({
    where: { work_plan_id: wp.id },
    orderBy: { id: "desc" },
  });

  const usage = batch
    ? await prisma.batch_material_usage.findMany({
        where: { batch_id: batch.id },
        include: { materials: true },
        orderBy: { id: "asc" },
      })
    : [];

  const executions = batch
    ? await prisma.process_executions.findMany({
        where: { batch_id: batch.id },
        orderBy: { id: "asc" },
      })
    : [];

  const executionsByWorkPlan = await prisma.process_executions.findMany({
    where: { work_plan_id: wp.id },
    orderBy: { id: "asc" },
  });

  const recentLogs = await prisma.logs.findMany({
    where: { work_plan_id: wp.id },
    orderBy: { id: "desc" },
    take: 20,
  });

  const materialMaster = await prisma.material.findMany({
    where: {
      Mat_Id: {
        in: usage.map((row) => row.materials.material_code),
      },
    },
    select: { Mat_Id: true, Mat_Name: true, price: true },
  });

  const operatorCount = await prisma.work_plan_operators.count({
    where: { work_plan_id: wp.id },
  });

  const ctx = await summary.getByJobId(String(jobId));

  const usageDetails = usage.map((row) => ({
    code: row.materials.material_code,
    name: row.materials.material_name,
    actual_qty: Number(row.actual_qty),
    unit: row.unit,
    unit_price_in_usage: Number(row.unit_price),
    price_in_materials_table: Number(row.materials.price ?? 0),
    line_cost: Number(row.actual_qty) * Number(row.unit_price),
  }));

  const kgSum = usageDetails
    .filter((r) => r.unit?.trim() === "กก.")
    .reduce((s, r) => s + r.actual_qty, 0);

  const executionDetails = executions.map((row) => ({
    id: row.id,
    step: row.process_description,
    duration_minutes: row.duration_minutes,
    status: row.status,
    start_time: row.start_time,
    end_time: row.end_time,
  }));

  const totalMinutes = executions.reduce(
    (s, row) => s + (row.duration_minutes ?? 0),
    0,
  );

  console.log(
    JSON.stringify(
      {
        workPlanId: wp.id,
        jobCode: wp.job_code,
        jobName: wp.job_name,
        batchId: batch?.id ?? null,
        batch_count: batch?.batch_count ?? null,
        batch_status: batch?.status ?? null,
        apiCostPreview: ctx.costPreview,
        summedKgFromUsage: Math.round(kgSum * 100) / 100,
        materialUsage: usageDetails,
        materialCostSum: usageDetails.reduce((s, r) => s + r.line_cost, 0),
        allUnitPricesZero: usageDetails.every((r) => r.unit_price_in_usage === 0),
        processExecutions: executionDetails,
        processExecutionsByWorkPlan: executionsByWorkPlan.map((row) => ({
          id: row.id,
          batch_id: row.batch_id,
          step: row.process_description,
          duration_minutes: row.duration_minutes,
          status: row.status,
        })),
        recentLogs: recentLogs.map((row) => ({
          id: row.id,
          process_number: row.process_number,
          status: row.status,
          timestamp: row.timestamp,
        })),
        materialMasterPrices: materialMaster.map((row) => ({
          code: row.Mat_Id,
          name: row.Mat_Name,
          price: Number(row.price ?? 0),
        })),
        totalDurationMinutes: totalMinutes,
        operatorCountFromTable: operatorCount,
        operatorsFromWorkPlan: wp.operators,
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
