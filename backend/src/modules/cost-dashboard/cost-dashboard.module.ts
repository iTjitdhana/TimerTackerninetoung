import { Module } from "@nestjs/common";
import { CostDashboardController } from "./cost-dashboard.controller";
import { CostDashboardService } from "./cost-dashboard.service";
import { AuthSharedModule } from "../../shared/auth/auth-shared.module";

@Module({
  imports: [AuthSharedModule],
  controllers: [CostDashboardController],
  providers: [CostDashboardService],
})
export class CostDashboardModule {}
