import { describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { JobAccessService } from "./job-access.service";
import type { PrismaService } from "../prisma/prisma.module";

function createService(
  findUnique: ReturnType<typeof vi.fn>,
  isConnected = true,
) {
  const prisma = {
    isConnected,
    work_plans: { findUnique },
  } as unknown as PrismaService;
  return new JobAccessService(prisma);
}

const viewer = {
  idCode: "EMP002",
  name: "สาม",
  canReadAll: false,
  canReadAllWeighingJobs: false,
};

describe("JobAccessService.assertCanAccessJob", () => {
  it("allows users with canReadAll without hitting the database", async () => {
    const findUnique = vi.fn();
    const service = createService(findUnique);
    await expect(
      service.assertCanAccessJob("1", { ...viewer, canReadAll: true }),
    ).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("allows when the viewer is assigned to the job", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 1,
      work_plan_operators: [
        { id_code: "EMP002", users: { id_code: "EMP002", name: "สาม" } },
      ],
      operators: null,
    });
    const service = createService(findUnique);
    await expect(service.assertCanAccessJob("1", viewer)).resolves.toBeUndefined();
  });

  it("throws Forbidden when the viewer is not assigned", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 1,
      work_plan_operators: [
        { id_code: "EMP999", users: { id_code: "EMP999", name: "อื่น" } },
      ],
      operators: null,
    });
    const service = createService(findUnique);
    await expect(service.assertCanAccessJob("1", viewer)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("passes through when the job is not found (let downstream 404)", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const service = createService(findUnique);
    await expect(service.assertCanAccessJob("1", viewer)).resolves.toBeUndefined();
  });

  it("skips the check when the database is disconnected", async () => {
    const findUnique = vi.fn();
    const service = createService(findUnique, false);
    await expect(service.assertCanAccessJob("1", viewer)).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("allows weighing staff to access any job for weighing", async () => {
    const findUnique = vi.fn();
    const service = createService(findUnique);
    await expect(
      service.assertCanAccessWeighingJob("1", {
        ...viewer,
        canReadAllWeighingJobs: true,
      }),
    ).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("skips the check for a non-numeric job id", async () => {
    const findUnique = vi.fn();
    const service = createService(findUnique);
    await expect(
      service.assertCanAccessJob("abc", viewer),
    ).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
