import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  process_executions_status,
  production_batches_status,
} from "@prisma/client";
import { ProductionTimerService } from "./production-timer.service";
import type { PrismaService } from "../../shared/prisma/prisma.module";
import type { BatchResolverService } from "../../shared/services/batch-resolver.service";
import type { BomService } from "../../shared/services/bom.service";
import type { ProcessStepsReaderService } from "../../shared/services/process-steps-reader.service";
import type { ProcessTemplatesReaderService } from "../../shared/services/process-templates-reader.service";
import type { ProductionLogService } from "../../shared/services/production-log.service";
import type { UserResolverService } from "../../shared/services/user-resolver.service";
import type { MaterialResolverService } from "../../shared/services/material-resolver.service";
import type { ProductionTimerEventsService } from "./production-timer-events.service";

function createService(overrides: {
  processExecutionsUpdate?: ReturnType<typeof vi.fn>;
  processExecutionsCreateMany?: ReturnType<typeof vi.fn>;
  processExecutionsFindMany?: ReturnType<typeof vi.fn>;
  processTemplatesFindFirst?: ReturnType<typeof vi.fn>;
  syncAdminStepTimings?: ReturnType<typeof vi.fn>;
  externalTemplates?: Array<{
    id: number;
    process_number: number;
    process_description: string;
  }>;
}) {
  const processExecutionsUpdate =
    overrides.processExecutionsUpdate ?? vi.fn().mockResolvedValue({});
  const processExecutionsCreateMany =
    overrides.processExecutionsCreateMany ?? vi.fn().mockResolvedValue({ count: 1 });
  const processExecutionsFindMany =
    overrides.processExecutionsFindMany ?? vi.fn().mockResolvedValue([]);

  const prisma = {
    process_executions: {
      findMany: processExecutionsFindMany,
      update: processExecutionsUpdate,
      createMany: processExecutionsCreateMany,
    },
    process_templates: {
      findFirst: overrides.processTemplatesFindFirst ?? vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ id: 1, process_number: 1 }]),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    products: {
      findUnique: vi.fn().mockResolvedValue({ product_code: "135012" }),
      create: vi.fn().mockResolvedValue({ product_code: "135012" }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    production_batches: {
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;

  const batchResolver = {
    resolveWorkPlan: vi.fn().mockResolvedValue({
      id: 597,
      job_code: "135012",
      job_name: "Test Product",
      production_date: new Date("2025-08-26T00:00:00.000Z"),
    }),
    ensureBatchReadyForProduction: vi.fn().mockResolvedValue({
      workPlan: {
        id: 597,
        job_code: "135012",
        job_name: "Test Product",
        production_date: new Date("2025-08-26T00:00:00.000Z"),
      },
      batch: {
        id: 53,
        status: production_batches_status.producing,
      },
    }),
    resolveOrCreateBatch: vi.fn().mockResolvedValue({
      id: 53,
      status: production_batches_status.producing,
    }),
    findLatestBatch: vi.fn().mockResolvedValue(null),
    resolveProductOutputConfig: vi.fn().mockResolvedValue(undefined),
  } as unknown as BatchResolverService;

  const processTemplatesReader = {
    findTemplates: vi.fn().mockResolvedValue(overrides.externalTemplates ?? []),
  } as unknown as ProcessTemplatesReaderService;

  const syncAdminStepTimings =
    overrides.syncAdminStepTimings ?? vi.fn().mockResolvedValue(undefined);

  const service = new ProductionTimerService(
    prisma,
    batchResolver,
    {} as BomService,
    {} as ProcessStepsReaderService,
    processTemplatesReader,
    {
      getStepTimings: vi.fn().mockResolvedValue(new Map()),
      formatExecutionTime: vi.fn(),
      formatExecutionDuration: vi.fn(),
      syncAdminStepTimings,
    } as unknown as ProductionLogService,
    {
      resolveUserId: vi.fn().mockResolvedValue(1),
    } as unknown as UserResolverService,
    {} as MaterialResolverService,
    { emit: vi.fn() } as unknown as ProductionTimerEventsService,
    {
      hasAvatar: vi.fn().mockReturnValue(false),
    } as unknown as import("../auth/profile-avatar.service").ProfileAvatarService,
  );

  vi.spyOn(service, "getByJobId").mockResolvedValue({
    jobId: "597",
    started: true,
    steps: [],
  } as never);

  return {
    service,
    processExecutionsUpdate,
    processExecutionsCreateMany,
    syncAdminStepTimings,
    prisma,
  };
}

describe("ProductionTimerService.updateSession", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not write duration_minutes (generated column)", async () => {
    const processExecutionsUpdate = vi.fn().mockResolvedValue({});
    const { service, processExecutionsUpdate: updateMock } = createService({
      processExecutionsUpdate,
      processExecutionsFindMany: vi.fn().mockResolvedValue([
        {
          id: 10,
          process_description: "เตรียมอุปกรณ์",
          process_number: 1,
          start_time: null,
          end_time: null,
          duration_minutes: null,
          status: process_executions_status.pending,
        },
      ]),
    });

    await service.updateSession("597", {
      steps: [
        {
          stepName: "เตรียมอุปกรณ์",
          startTime: "10:00:00",
          endTime: "10:05:00",
          duration: "00:05",
          completed: true,
        },
      ],
    });

    expect(updateMock).toHaveBeenCalledOnce();
    const updateData = updateMock.mock.calls[0][0].data;
    expect(updateData).toHaveProperty("start_time");
    expect(updateData).toHaveProperty("end_time");
    expect(updateData).toHaveProperty("status");
    expect(updateData).not.toHaveProperty("duration_minutes");
  });
});

describe("ProductionTimerService.startSession", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses local template_id from resolveTemplateId, not external template id", async () => {
    const processExecutionsCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const processTemplatesFindFirst = vi
      .fn()
      .mockResolvedValue({ id: 4318, process_number: 1 });

    const { service, processExecutionsCreateMany: createManyMock } =
      createService({
        processExecutionsCreateMany,
        processTemplatesFindFirst,
        externalTemplates: [
          {
            id: 99999,
            process_number: 1,
            process_description: "เตรียมอุปกรณ์",
          },
        ],
      });

    await service.startSession({ jobId: "597", startedBy: "แมน" });

    expect(createManyMock).toHaveBeenCalledOnce();
    const rows = createManyMock.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0].template_id).toBe(4318);
    expect(rows[0].template_id).not.toBe(99999);
  });

  it("adds missing steps without recreating existing executions", async () => {
    const processExecutionsCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const processTemplatesFindFirst = vi
      .fn()
      .mockResolvedValue({ id: 4319, process_number: 2 });

    const { service, processExecutionsCreateMany: createManyMock } =
      createService({
        processExecutionsCreateMany,
        processTemplatesFindFirst,
        externalTemplates: [
          {
            id: 1,
            process_number: 1,
            process_description: "ประกอบอาหาร",
          },
          {
            id: 2,
            process_number: 2,
            process_description: "แพ็ค",
          },
        ],
        processExecutionsFindMany: vi.fn().mockResolvedValue([
          {
            id: 10,
            process_number: 1,
            process_description: "ประกอบอาหาร",
            start_time: new Date("2026-06-02T09:00:00.000Z"),
            end_time: new Date("2026-06-02T09:30:00.000Z"),
            status: process_executions_status.completed,
          },
        ]),
      });

    await service.startSession({ jobId: "597", startedBy: "พี่สร" });

    expect(createManyMock).toHaveBeenCalledOnce();
    const rows = createManyMock.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0].process_number).toBe(2);
    expect(rows[0].process_description).toBe("แพ็ค");
  });
});

describe("ProductionTimerService.adminUpdateSession", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("clears times and resets status without touching recorded_by", async () => {
    const processExecutionsUpdate = vi.fn().mockResolvedValue({});
    const syncAdminStepTimings = vi.fn().mockResolvedValue(undefined);
    const { service, processExecutionsUpdate: updateMock, syncAdminStepTimings: syncMock } =
      createService({
      processExecutionsUpdate,
      syncAdminStepTimings,
      processExecutionsFindMany: vi.fn().mockResolvedValue([
        {
          id: 10,
          process_number: 1,
          process_description: "ประกอบอาหาร",
          start_time: new Date("2026-06-02T02:00:00.000Z"),
          end_time: new Date("2026-06-02T02:30:00.000Z"),
          duration_minutes: 30,
          status: process_executions_status.completed,
          recorded_by: 42,
        },
      ]),
    });

    await service.adminUpdateSession("597", {
      steps: [
        {
          stepName: "ประกอบอาหาร",
          startTime: "09:15",
          endTime: "09:45",
          completed: true,
        },
      ],
    });

    expect(updateMock).toHaveBeenCalledOnce();
    const updateData = updateMock.mock.calls[0][0].data;
    expect(updateData.status).toBe(process_executions_status.completed);
    expect(updateData).not.toHaveProperty("recorded_by");
    expect(updateData).not.toHaveProperty("duration_minutes");
    expect(syncMock).toHaveBeenCalledOnce();
  });

  it("can reset a step to pending when times are cleared", async () => {
    const processExecutionsUpdate = vi.fn().mockResolvedValue({});
    const { service, processExecutionsUpdate: updateMock } = createService({
      processExecutionsUpdate,
      processExecutionsFindMany: vi.fn().mockResolvedValue([
        {
          id: 11,
          process_description: "แพ็ค",
          process_number: 2,
          start_time: new Date("2026-06-02T03:00:00.000Z"),
          end_time: new Date("2026-06-02T03:15:00.000Z"),
          duration_minutes: 15,
          status: process_executions_status.completed,
          recorded_by: 42,
        },
      ]),
    });

    await service.adminUpdateSession("597", {
      steps: [
        {
          stepName: "แพ็ค",
          startTime: "",
          endTime: "",
          completed: false,
        },
      ],
    });

    const updateData = updateMock.mock.calls[0][0].data;
    expect(updateData.start_time).toBeNull();
    expect(updateData.end_time).toBeNull();
    expect(updateData.status).toBe(process_executions_status.pending);
  });

  it("bootstraps process_executions when missing but batch exists", async () => {
    const processExecutionsUpdate = vi.fn().mockResolvedValue({});
    const processExecutionsCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    let findManyCalls = 0;
    const processExecutionsFindMany = vi.fn().mockImplementation(async () => {
      findManyCalls += 1;
      if (findManyCalls === 1) {
        return [];
      }
      return [
        {
          id: 20,
          process_description: "ต้ม",
          process_number: 1,
          start_time: null,
          end_time: null,
          duration_minutes: null,
          status: process_executions_status.pending,
          recorded_by: 1,
        },
      ];
    });

    const { service, processExecutionsCreateMany: createManyMock, processExecutionsUpdate: updateMock } =
      createService({
        processExecutionsUpdate,
        processExecutionsCreateMany,
        processExecutionsFindMany,
        externalTemplates: [
          { id: 1, process_number: 1, process_description: "ต้ม" },
        ],
      });

    const batchResolver = (service as unknown as { batchResolver: BatchResolverService })
      .batchResolver;
    vi.mocked(batchResolver.findLatestBatch).mockResolvedValue({
      id: 53,
      status: production_batches_status.producing,
    } as never);

    await service.adminUpdateSession(
      "597",
      {
        steps: [
          {
            stepName: "ต้ม",
            startTime: "08:30:15",
            endTime: "09:00:00",
            completed: true,
          },
        ],
      },
      "admin-user",
    );

    expect(createManyMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledOnce();
  });
});
