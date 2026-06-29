import { Module } from "@nestjs/common";
import { ProductionSummaryController } from "./production-summary.controller";
import { ProductionSummaryService } from "./production-summary.service";

@Module({
  controllers: [ProductionSummaryController],
  providers: [ProductionSummaryService],
  exports: [ProductionSummaryService],
})
export class ProductionSummaryModule {}
