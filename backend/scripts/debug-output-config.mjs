import { NestFactory } from "@nestjs/core";
import { AppModule } from "../dist/app.module.js";

const jobId = process.argv[2] ?? "8445";
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const { BatchResolverService } = await import(
    "../dist/shared/services/batch-resolver.service.js"
  );
  const { ProductionTimerService } = await import(
    "../dist/modules/production-timer/production-timer.service.js"
  );
  const batchResolver = app.get(BatchResolverService);
  const timer = app.get(ProductionTimerService);

  const wp = await batchResolver.resolveWorkPlan(jobId);
  const config = await batchResolver.resolveProductOutputConfig(
    wp.job_code,
    wp.job_code,
    wp.job_name,
  );
  console.log("plan", wp.id, wp.job_code, wp.job_name);
  console.log("unitOptions", config.unitOptions);

  const timerData = await timer.getByJobId(jobId);
  console.log("timer unitOptions", timerData.outputConfig?.unitOptions);
} finally {
  await app.close();
}
