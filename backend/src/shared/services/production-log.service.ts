import { Injectable } from "@nestjs/common";
import { logs_status } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import {
  formatDurationFromSeconds,
  formatDurationWithSecondsFromSeconds,
  formatPrismaDateTimeAsHms,
  toMySqlNaiveBangkokDateTime,
} from "../utils/datetime.util";

export interface StepLogTiming {
  processNumber: number;
  startTime?: string;
  endTime?: string;
  duration?: string;
  completed: boolean;
}

export type AdminLogStepTiming = {
  processNumber: number;
  startTime: Date | null;
  endTime: Date | null;
};

type LogTimingRow = {
  process_number: number;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: bigint | number | null;
};

@Injectable()
export class ProductionLogService {
  constructor(private readonly prisma: PrismaService) {}

  async getStepTimings(workPlanId: number): Promise<Map<number, StepLogTiming>> {
    const rows = await this.prisma.$queryRaw<LogTimingRow[]>`
      SELECT
        s.process_number,
        DATE_FORMAT(s.timestamp, '%H:%i') AS start_time,
        DATE_FORMAT(e.timestamp, '%H:%i') AS end_time,
        TIMESTAMPDIFF(SECOND, s.timestamp, e.timestamp) AS duration_seconds
      FROM logs s
      LEFT JOIN logs e
        ON e.work_plan_id = s.work_plan_id
       AND e.process_number = s.process_number
       AND e.status = 'stop'
       AND e.timestamp = (
         SELECT MIN(l2.timestamp)
         FROM logs l2
         WHERE l2.work_plan_id = s.work_plan_id
           AND l2.process_number = s.process_number
           AND l2.status = 'stop'
           AND l2.timestamp >= s.timestamp
       )
      WHERE s.work_plan_id = ${workPlanId}
        AND s.status = 'start'
      ORDER BY s.process_number ASC
    `;

    const byProcess = new Map<number, StepLogTiming>();

    for (const row of rows) {
      const durationSeconds =
        row.duration_seconds == null ? null : Number(row.duration_seconds);

      byProcess.set(row.process_number, {
        processNumber: row.process_number,
        startTime: row.start_time ?? undefined,
        endTime: row.end_time ?? undefined,
        duration:
          durationSeconds != null
            ? formatDurationFromSeconds(durationSeconds)
            : undefined,
        completed: Boolean(row.start_time && row.end_time),
      });
    }

    return byProcess;
  }

  async getWorkPlanWallClockMinutes(workPlanId: number): Promise<number> {
    const rows = await this.prisma.$queryRaw<
      Array<{ earliest_start: Date | null; latest_end: Date | null }>
    >`
      SELECT
        MIN(s.timestamp) AS earliest_start,
        MAX(e.timestamp) AS latest_end
      FROM logs s
      INNER JOIN logs e
        ON e.work_plan_id = s.work_plan_id
       AND e.process_number = s.process_number
       AND e.status = 'stop'
       AND e.timestamp = (
         SELECT MIN(l2.timestamp)
         FROM logs l2
         WHERE l2.work_plan_id = s.work_plan_id
           AND l2.process_number = s.process_number
           AND l2.status = 'stop'
           AND l2.timestamp >= s.timestamp
       )
      WHERE s.work_plan_id = ${workPlanId}
        AND s.status = 'start'
    `;

    const earliestStart = rows[0]?.earliest_start;
    const latestEnd = rows[0]?.latest_end;
    if (!earliestStart || !latestEnd) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor((latestEnd.getTime() - earliestStart.getTime()) / 60000),
    );
  }

  formatExecutionTime(value: Date | null | undefined): string | undefined {
    return formatPrismaDateTimeAsHms(value);
  }

  formatExecutionDuration(
    startTime: Date | null | undefined,
    endTime: Date | null | undefined,
    durationMinutes: number | null | undefined,
  ): string | undefined {
    if (startTime && endTime) {
      const diffSeconds = Math.max(
        0,
        Math.floor((endTime.getTime() - startTime.getTime()) / 1000),
      );
      return formatDurationWithSecondsFromSeconds(diffSeconds);
    }

    if (durationMinutes != null) {
      return formatDurationWithSecondsFromSeconds(durationMinutes * 60);
    }

    return undefined;
  }

  async hasLogs(workPlanId: number): Promise<boolean> {
    const count = await this.prisma.logs.count({
      where: { work_plan_id: workPlanId },
    });
    return count > 0;
  }

  async getLoggedStepNumbers(workPlanId: number): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<Array<{ process_number: number }>>`
      SELECT DISTINCT process_number
      FROM logs
      WHERE work_plan_id = ${workPlanId}
        AND process_number IS NOT NULL
      ORDER BY process_number ASC
    `;

    return rows.map((row) => row.process_number);
  }

  /**
   * แทนที่ logs ของแต่ละขั้นตอนด้วยเวลาที่ admin แก้
   * (ลบ start/stop เดิมของ process_number นั้น แล้วสร้างคู่ใหม่)
   */
  async syncAdminStepTimings(
    workPlanId: number,
    steps: AdminLogStepTiming[],
    options?: { userId?: number; batchId?: number | null },
  ): Promise<void> {
    if (steps.length === 0) {
      return;
    }

    const processNumbers = steps.map((step) => step.processNumber);
    const batchId =
      options?.batchId != null ? String(options.batchId) : null;

    await this.prisma.logs.deleteMany({
      where: {
        work_plan_id: workPlanId,
        process_number: { in: processNumbers },
      },
    });

    const creates: Array<{
      work_plan_id: number;
      process_number: number;
      status: logs_status;
      timestamp: Date;
      user_id: number | null;
      batch_id: string | null;
    }> = [];

    for (const step of steps) {
      if (step.startTime) {
        creates.push({
          work_plan_id: workPlanId,
          process_number: step.processNumber,
          status: logs_status.start,
          timestamp: toMySqlNaiveBangkokDateTime(step.startTime),
          user_id: options?.userId ?? null,
          batch_id: batchId,
        });
      }
      if (step.endTime) {
        creates.push({
          work_plan_id: workPlanId,
          process_number: step.processNumber,
          status: logs_status.stop,
          timestamp: toMySqlNaiveBangkokDateTime(step.endTime),
          user_id: options?.userId ?? null,
          batch_id: batchId,
        });
      }
    }

    if (creates.length > 0) {
      await this.prisma.logs.createMany({ data: creates });
    }
  }
}
