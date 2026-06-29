import { NestFactory } from "@nestjs/core";
import { AppModule } from "../dist/app.module.js";

const jobId = process.argv[2];

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

  if (jobId) {
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
        })
      : [];
    const ctx = await summary.getByJobId(String(jobId));

    const kgRows = usage.filter((r) => {
      const u = r.unit?.trim();
      return u === "กก." || u?.toLowerCase() === "kg";
    });

    console.log(
      JSON.stringify(
        {
          workPlanId: wp.id,
          jobCode: wp.job_code,
          jobName: wp.job_name,
          batchId: batch?.id ?? null,
          batch_count: batch?.batch_count ?? null,
          apiInputMaterialQty: ctx.costPreview?.inputMaterialQty ?? null,
          summedKgFromUsage: kgRows.reduce(
            (s, r) => s + Number(r.actual_qty),
            0,
          ),
          kgMaterials: kgRows.map((r) => ({
            code: r.materials.material_code,
            name: r.materials.material_name,
            actual_qty: Number(r.actual_qty),
            unit: r.unit,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    const plans = await prisma.work_plans.findMany({
      where: {
        OR: [{ job_code: "135012" }, { job_name: { contains: "น้ำแกงส้ม" } }],
      },
      orderBy: { id: "desc" },
      take: 8,
      select: { id: true, job_code: true, job_name: true },
    });

    for (const wp of plans) {
      const batch = await prisma.production_batches.findFirst({
        where: { work_plan_id: wp.id },
        orderBy: { id: "desc" },
      });
      if (!batch) continue;
      const usage = await prisma.batch_material_usage.findMany({
        where: { batch_id: batch.id },
        include: { materials: true },
      });
      const kgSum = usage
        .filter((r) => r.unit?.trim() === "กก.")
        .reduce((s, r) => s + Number(r.actual_qty), 0);
      if (kgSum <= 0) continue;
      console.log(
        `plan ${wp.id} | batch_count=${batch.batch_count} | input=${kgSum.toFixed(2)} kg | ${wp.job_name?.slice(0, 40)}`,
      );
    }
  }
} finally {
  await app.close();
}
