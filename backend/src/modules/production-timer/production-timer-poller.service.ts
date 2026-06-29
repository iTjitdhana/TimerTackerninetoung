import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ProductionTimerEventsService } from "./production-timer-events.service";
import { ProductionTimerService } from "./production-timer.service";

const POLL_INTERVAL_MS = 8000;

/**
 * Poller กลาง "ตัวเดียว" ของทั้ง backend สำหรับจับการเปลี่ยนแปลงที่ไม่ได้ผ่าน mutation
 * ของแอปนี้ (เช่น logs ภายนอก / การ sync work_plans).
 *
 * คุม Too-many-connections:
 * - ทำงานเฉพาะ job ที่ "มีคนเปิดดูอยู่" (active subscriber) เท่านั้น
 * - 1 รอบ = อ่าน session ผ่าน Prisma pool เดิม (ไม่เปิด connection ต่อ client)
 * - dedup อยู่ใน EventsService.emit แล้ว ถ้าไม่เปลี่ยนจะไม่ push
 */
@Injectable()
export class ProductionTimerPollerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProductionTimerPollerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly events: ProductionTimerEventsService,
    private readonly service: ProductionTimerService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    // อย่าให้ timer กัน process ปิด (สำคัญเวลา test/shutdown)
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
          const session = await this.service.getByJobId(jobId);
          this.events.emit(jobId, session);
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
