import { describe, expect, it } from "vitest";
import { resolveIngredientUnitPrice } from "./material-cost-price.util";

describe("resolveIngredientUnitPrice", () => {
  it("locks price when weighed_by is set", () => {
    expect(
      resolveIngredientUnitPrice(
        { unitPrice: 42, weighedBy: 1 },
        { unitCost: 99, status: "found" },
        10,
      ),
    ).toEqual({ unitPrice: 42 });
  });

  it("uses onhand found price before usage when not weighed", () => {
    expect(
      resolveIngredientUnitPrice(
        { unitPrice: 10, weighedBy: null },
        { unitCost: 85.5, status: "found" },
        5,
      ),
    ).toEqual({ unitPrice: 85.5, unitPriceStatus: "found" });
  });

  it("uses onhand default price with reason (e.g. น้ำเปล่า 206004)", () => {
    expect(
      resolveIngredientUnitPrice(
        undefined,
        {
          unitCost: 2,
          status: "default",
          fallbackReason: "ไม่พบราคาใน session ปัจจุบัน ใช้ราคาเริ่มต้นจากการตั้งค่าระบบ",
        },
        0,
      ),
    ).toEqual({
      unitPrice: 2,
      unitPriceStatus: "default",
      unitPriceFallbackReason:
        "ไม่พบราคาใน session ปัจจุบัน ใช้ราคาเริ่มต้นจากการตั้งค่าระบบ",
    });
  });

  it("uses onhand fallback price with reason", () => {
    expect(
      resolveIngredientUnitPrice(
        undefined,
        {
          unitCost: 28,
          status: "fallback",
          fallbackReason: "ไม่มีราคาใน session ปัจจุบัน",
        },
        5,
      ),
    ).toEqual({
      unitPrice: 28,
      unitPriceStatus: "fallback",
      unitPriceFallbackReason: "ไม่มีราคาใน session ปัจจุบัน",
    });
  });

  it("uses usage price when onhand has no price", () => {
    expect(
      resolveIngredientUnitPrice(
        { unitPrice: 15, weighedBy: null },
        { unitCost: null, status: "no_data" },
        5,
      ),
    ).toEqual({ unitPrice: 15 });
  });

  it("marks no_data when onhand reports no_data and no usage", () => {
    expect(
      resolveIngredientUnitPrice(
        undefined,
        { unitCost: null, status: "no_data" },
        7,
      ),
    ).toEqual({ unitPrice: 7, unitPriceStatus: "no_data" });
  });

  it("falls back to master price when onhand is unavailable", () => {
    expect(resolveIngredientUnitPrice(undefined, undefined, 18)).toEqual({
      unitPrice: 18,
    });
  });
});
