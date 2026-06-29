import { describe, expect, it } from "vitest";
import {
  computeLineMaterialCost,
  resolveMaterialUnitPrice,
} from "./material-unit-price.util";

describe("resolveMaterialUnitPrice", () => {
  it("prefers user input over existing and master", () => {
    expect(resolveMaterialUnitPrice(55, 40, 30)).toBe(55);
  });

  it("rounds to 2 decimal places", () => {
    expect(resolveMaterialUnitPrice(31.517647, 40, 30)).toBe(31.52);
    expect(resolveMaterialUnitPrice(undefined, 31.517647, 30)).toBe(31.52);
  });

  it("falls back to existing snapshot when user input is omitted", () => {
    expect(resolveMaterialUnitPrice(undefined, 42.5, 30)).toBe(42.5);
  });

  it("falls back to master price when no snapshot exists", () => {
    expect(resolveMaterialUnitPrice(undefined, null, 18)).toBe(18);
  });
});

describe("computeLineMaterialCost", () => {
  it("multiplies quantity by unit price", () => {
    expect(computeLineMaterialCost(10, 12.5)).toBe(125);
  });
});
