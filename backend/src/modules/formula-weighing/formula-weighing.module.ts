import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { FormulaWeighingController } from "./formula-weighing.controller";
import { FormulaWeighingService } from "./formula-weighing.service";
import { FormulaWeighingEventsService } from "./formula-weighing-events.service";
import { FormulaWeighingPollerService } from "./formula-weighing-poller.service";

@Module({
  imports: [JobsModule],
  controllers: [FormulaWeighingController],
  providers: [
    FormulaWeighingService,
    FormulaWeighingEventsService,
    FormulaWeighingPollerService,
  ],
  exports: [FormulaWeighingService],
})
export class FormulaWeighingModule {}
