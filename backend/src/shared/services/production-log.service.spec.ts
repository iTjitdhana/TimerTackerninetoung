import { describe, expect, it, vi } from "vitest";
import { logs_status } from "@prisma/client";
import { ProductionLogService } from "./production-log.service";
import type { PrismaService } from "../prisma/prisma.module";

function createService() {
  const logsDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const logsCreateMany = vi.fn().mockResolvedValue({ count: 0 });

  const prisma = {
    logs: {
      deleteMany: logsDeleteMany,
      createMany: logsCreateMany,
    },
  } as unknown as PrismaService;

  const service = new ProductionLogService(prisma);

  return { service, logsDeleteMany, logsCreateMany };
}

describe("ProductionLogService.syncAdminStepTimings", () => {
  it("replaces step logs with new start/stop timestamps", async () => {
    const { service, logsDeleteMany, logsCreateMany } = createService();
    const startInstant = new Date("2026-06-16T06:30:00.000Z");
    const endInstant = new Date("2026-06-16T06:35:00.000Z");

    await service.syncAdminStepTimings(
      11545,
      [{ processNumber: 1, startTime: startInstant, endTime: endInstant }],
      { userId: 7, batchId: 135 },
    );

    expect(logsDeleteMany).toHaveBeenCalledWith({
      where: { work_plan_id: 11545, process_number: { in: [1] } },
    });
    expect(logsCreateMany).toHaveBeenCalledWith({
      data: [
        {
          work_plan_id: 11545,
          process_number: 1,
          status: logs_status.start,
          timestamp: new Date("2026-06-16T13:30:00.000Z"),
          user_id: 7,
          batch_id: "135",
        },
        {
          work_plan_id: 11545,
          process_number: 1,
          status: logs_status.stop,
          timestamp: new Date("2026-06-16T13:35:00.000Z"),
          user_id: 7,
          batch_id: "135",
        },
      ],
    });
  });

  it("deletes logs when both times are cleared", async () => {
    const { service, logsDeleteMany, logsCreateMany } = createService();

    await service.syncAdminStepTimings(11545, [
      { processNumber: 2, startTime: null, endTime: null },
    ]);

    expect(logsDeleteMany).toHaveBeenCalledOnce();
    expect(logsCreateMany).not.toHaveBeenCalled();
  });
});
