import { describe, expect, it, vi } from "vitest";
import { BomService } from "./bom.service";
import type { PrismaService } from "../prisma/prisma.module";
import type { OnhandCostPriceService } from "./onhand-cost-price.service";
import type { BomSourceProvider } from "./bom-source/bom-source.interface";

function createBomService(
  bomRows: Array<{ id: number; Raw_Code: string; Raw_Qty: number; Raw_Unit: string }>,
  usageRows: Array<{
    id: number;
    material_code: string;
    actual_qty: string;
    planned_qty: string;
    unit: string;
    unit_price: string;
    weighed_by: number | null;
  }>,
  onhandPrices: Map<
    string,
    { unitCost: number | null; status: "found" | "fallback" | "default" | "no_data" }
  >,
) {
  const prisma = {
    material: {
      findMany: vi.fn().mockResolvedValue(
        bomRows.map((row) => ({
          Mat_Id: row.Raw_Code,
          Mat_Name: `Material ${row.Raw_Code}`,
          Mat_Unit: row.Raw_Unit,
        })),
      ),
    },
    materials: {
      findMany: vi.fn().mockResolvedValue(
        bomRows.map((row) => ({
          material_code: row.Raw_Code,
          material_name: `Material ${row.Raw_Code}`,
          price: 5,
        })),
      ),
      findUnique: vi.fn(),
    },
    batch_material_usage: {
      findMany: vi.fn().mockResolvedValue(
        usageRows.map((row) => ({
          id: row.id,
          actual_qty: row.actual_qty,
          planned_qty: row.planned_qty,
          unit: row.unit,
          unit_price: row.unit_price,
          weighed_by: row.weighed_by,
          materials: { material_code: row.material_code },
        })),
      ),
    },
  } as unknown as PrismaService;

  const onhandCostPrice = {
    resolvePrices: vi.fn().mockResolvedValue(onhandPrices),
  } as unknown as OnhandCostPriceService;

  const bomSource = {
    getFormula: vi.fn().mockResolvedValue(
      bomRows.length === 0
        ? null
        : {
            fgCode: "FG001",
            components: bomRows.map((row, index) => ({
              rawCode: row.Raw_Code,
              rawQty: row.Raw_Qty,
              rawUnit: row.Raw_Unit,
              lineOrder: index + 1,
            })),
          },
    ),
  } as unknown as BomSourceProvider;

  return {
    service: new BomService(prisma, onhandCostPrice, bomSource),
    onhandCostPrice,
    bomSource,
  };
}

describe("BomService onhand integration", () => {
  it("uses onhand price for BOM lines without weighed usage", async () => {
    const onhandPrices = new Map([
      ["RM105001", { unitCost: 85.5, status: "found" as const }],
    ]);
    const { service } = createBomService(
      [{ id: 1, Raw_Code: "RM105001", Raw_Qty: 1, Raw_Unit: "กก." }],
      [],
      onhandPrices,
    );

    const ingredients = await service.getIngredientsForWorkPlan("FG001");
    expect(ingredients[0]?.unitPrice).toBe(85.5);
    expect(ingredients[0]?.unitPriceStatus).toBe("found");
  });

  it("uses onhand default price for materials like น้ำเปล่า (206004)", async () => {
    const onhandPrices = new Map([
      [
        "206004",
        {
          unitCost: 2,
          status: "default" as const,
          fallbackReason: "ใช้ราคาเริ่มต้นจากการตั้งค่าระบบ",
        },
      ],
    ]);
    const { service } = createBomService(
      [{ id: 1, Raw_Code: "206004", Raw_Qty: 13.8, Raw_Unit: "กก." }],
      [],
      onhandPrices,
    );

    const ingredients = await service.getIngredientsForWorkPlan("FG001");
    expect(ingredients[0]?.unitPrice).toBe(2);
    expect(ingredients[0]?.unitPriceStatus).toBe("default");
    expect(ingredients[0]?.unitPriceSource).toBe("api");
  });

  it("keeps batch snapshot after weighing", async () => {
    const onhandPrices = new Map([
      ["RM105001", { unitCost: 99, status: "found" as const }],
    ]);
    const { service, onhandCostPrice } = createBomService(
      [{ id: 1, Raw_Code: "RM105001", Raw_Qty: 1, Raw_Unit: "กก." }],
      [
        {
          id: 10,
          material_code: "RM105001",
          actual_qty: "2",
          planned_qty: "1",
          unit: "กก.",
          unit_price: "42",
          weighed_by: 1,
        },
      ],
      onhandPrices,
    );

    const ingredients = await service.getIngredientsForWorkPlan("FG001", 1);
    expect(ingredients[0]?.unitPrice).toBe(42);
    expect(ingredients[0]?.unitPriceStatus).toBeUndefined();
    expect(onhandCostPrice.resolvePrices).toHaveBeenCalledWith([]);
  });
});

describe("BomService.findBomComponent", () => {
  it("returns component from configured BOM source", async () => {
    const { service } = createBomService(
      [{ id: 1, Raw_Code: "206004", Raw_Qty: 13.8, Raw_Unit: "กก." }],
      [],
      new Map(),
    );

    const component = await service.findBomComponent("135129", "206004");
    expect(component?.rawCode).toBe("206004");
    expect(component?.rawQty).toBe(13.8);
  });

  it("returns null when material is not in formula", async () => {
    const { service } = createBomService(
      [{ id: 1, Raw_Code: "206004", Raw_Qty: 13.8, Raw_Unit: "กก." }],
      [],
      new Map(),
    );

    await expect(service.findBomComponent("135129", "999999")).resolves.toBeNull();
  });
});
