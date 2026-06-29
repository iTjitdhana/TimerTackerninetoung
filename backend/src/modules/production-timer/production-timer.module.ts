import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProductionTimerController } from "./production-timer.controller";
import { ProductionTimerService } from "./production-timer.service";
import { ProductionTimerEventsService } from "./production-timer-events.service";
import { ProductionTimerPollerService } from "./production-timer-poller.service";

@Module({
  imports: [AuthModule],
  controllers: [ProductionTimerController],
  providers: [
    ProductionTimerService,
    ProductionTimerEventsService,
    ProductionTimerPollerService,
  ],
  exports: [ProductionTimerService],
})
export class ProductionTimerModule {}
