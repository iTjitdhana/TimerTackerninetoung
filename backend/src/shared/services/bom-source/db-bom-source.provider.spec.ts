import { describe, expect, it, vi } from "vitest";
import { DbBomSourceProvider } from "./db-bom-source.provider";
import type { PrismaService } from "../../prisma/prisma.module";

function createProvider(rows: Array<{ Raw_Code: string; Raw_Qty: number; Raw_Unit: string }>) {
  const prisma = {
    fg_bom: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
  } as unknown as PrismaService;
  return new DbBomSourceProvider(prisma);
}

describe("DbBomSourceProvider", () => {
  it("maps fg_bom rows to BomFormula", async () => {
    const provider = createProvider([
      { Raw_Code: "507004", Raw_Qty: 2.5, Raw_Unit: "กก." },
      { Raw_Code: "201010", Raw_Qty: 8, Raw_Unit: "กก." },
    ]);

    const formula = await provider.getFormula("FG001");
    expect(formula).toEqual({
      fgCode: "FG001",
      components: [
        { rawCode: "507004", rawQty: 2.5, rawUnit: "กก.", lineOrder: 1 },
        { rawCode: "201010", rawQty: 8, rawUnit: "กก.", lineOrder: 2 },
      ],
    });
  });

  it("returns null when no rows", async () => {
    const provider = createProvider([]);
    await expect(provider.getFormula("FG001")).resolves.toBeNull();
  });
});
