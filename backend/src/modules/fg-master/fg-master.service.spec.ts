import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FgMasterService } from "./fg-master.service";

describe("FgMasterService", () => {
  const prisma = {
    fg: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  let service: FgMasterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FgMasterService(prisma as never);
  });

  const sampleFg = {
    FG_Code: "135012",
    FG_Name: "น้ำแกงส้ม 450 กรัม",
    FG_Unit: "แพ็ค",
    FG_Size: "450 กรัม",
    base_unit: "กก.",
    conversion_rate: { toNumber: () => 0.45 },
    conversion_description: null,
  };

  it("lists fg records with conversion status", async () => {
    prisma.fg.findMany.mockResolvedValue([sampleFg]);

    const result = await service.list("135", 10);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.fgCode).toBe("135012");
    expect(result.items[0]?.conversionVerified).toBe(true);
  });

  it("throws when fg not found", async () => {
    prisma.fg.findUnique.mockResolvedValue(null);

    await expect(service.getByCode("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("updates fg and returns preview config", async () => {
    prisma.fg.findUnique.mockResolvedValue(sampleFg);
    prisma.fg.update.mockResolvedValue({
      ...sampleFg,
      conversion_rate: { toNumber: () => 0.45 },
    });

    const result = await service.update("135012", {
      conversionRate: 0.45,
      fgUnit: "แพ็ค",
    });

    expect(result.outputConfig.conversionVerified).toBe(true);
    expect(result.fgCode).toBe("135012");
  });

  it("rejects invalid conversionDescription JSON", async () => {
    prisma.fg.findUnique.mockResolvedValue(sampleFg);

    await expect(
      service.update("135012", {
        conversionDescription: "not-json",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts valid conversionDescription JSON", async () => {
    prisma.fg.findUnique.mockResolvedValue(sampleFg);
    prisma.fg.update.mockResolvedValue({
      ...sampleFg,
      conversion_description: JSON.stringify([
        { label: "แพ็ค 450g", unit: "แพ็ค", conversionRate: 0.45 },
      ]),
    });

    const result = await service.update("135012", {
      conversionDescription: JSON.stringify([
        { label: "แพ็ค 450g", unit: "แพ็ค", conversionRate: 0.45 },
      ]),
    });

    expect(result.outputConfig.outputVariants).toHaveLength(1);
  });
});
