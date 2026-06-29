import { NestFactory } from "@nestjs/core";
import { AppModule } from "../dist/app.module.js";

const jobId = process.argv[2] ?? "11249";

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const { ProductionSummaryService } = await import(
    "../dist/modules/production-summary/production-summary.service.js"
  );
  const summary = app.get(ProductionSummaryService);

  const result = await summary.create({
    jobId,
    outputQty: 150,
    outputUnit: "แพ็ค",
    scrapQty: 28.5,
  });

  console.log(
    JSON.stringify(
      {
        jobId: result.jobId,
        batchId: result.batchId,
        summary: {
          good_qty: Number(result.summary.good_qty),
          good_secondary_qty: Number(result.summary.good_secondary_qty),
          good_secondary_unit: result.summary.good_secondary_unit,
          defect_qty: Number(result.summary.defect_qty),
          total_qty: result.summary.total_qty
            ? Number(result.summary.total_qty)
            : null,
        },
        balance: result.balance,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error("SAVE FAILED:", error);
  process.exitCode = 1;
} finally {
  await app.close();
}
