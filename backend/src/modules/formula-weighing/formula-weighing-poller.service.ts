import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { FormulaWeighingEventsService } from "./formula-weighing-events.service";
import { FormulaWeighingService } from "./formula-weighing.service";

const POLL_INTERVAL_MS = 8000;

/**
 * เฝ้า DB เฉพาะงานที่มีคนเปิดหน้าตวงสูตรอยู่ — push เมื่อข้อมูลเปลี่ยนจริง (dedup ใน EventsService)
 */
@Injectable()
export class FormulaWeighingPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FormulaWeighingPollerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly events: FormulaWeighingEventsService,
    private readonly service: FormulaWeighingService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    const jobIds = this.events.getActiveJobIds();
    if (jobIds.length === 0) {
      return;
    }

    this.running = true;
    try {
      for (const jobId of jobIds) {
        try {
          const record = await this.service.getByJobId(jobId);
          this.events.emit(jobId, record);
        } catch (error) {
          this.logger.debug(
            `poll failed for job ${jobId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
