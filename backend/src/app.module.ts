import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module";
import { WorkplanModule } from "./modules/workplan/workplan.module";
import { FormulaWeighingModule } from "./modules/formula-weighing/formula-weighing.module";
import { ProductionTimerModule } from "./modules/production-timer/production-timer.module";
import { ProductionSummaryModule } from "./modules/production-summary/production-summary.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { BusinessUnitsModule } from "./modules/business-units/business-units.module";
import { AdminModule } from "./modules/admin/admin.module";
import { CostDashboardModule } from "./modules/cost-dashboard/cost-dashboard.module";
import { FgMasterModule } from "./modules/fg-master/fg-master.module";
import { AuthSharedModule } from "./shared/auth/auth-shared.module";
import { PrismaModule } from "./shared/prisma/prisma.module";
import { SharedModule } from "./shared/shared.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../.env", "../infra/env/.env.example"],
    }),
    PrismaModule,
    AuthSharedModule,
    SharedModule,
    AuthModule,
    AdminModule,
    CostDashboardModule,
    FgMasterModule,
    JobsModule,
    BusinessUnitsModule,
    WorkplanModule,
    FormulaWeighingModule,
    ProductionTimerModule,
    ProductionSummaryModule,
  ],
})
export class AppModule {}
