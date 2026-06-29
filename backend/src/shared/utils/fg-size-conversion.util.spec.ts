import { describe, expect, it } from "vitest";
import {
  deriveKgPerUnitFromFgSize,
  isDefaultConversionRate,
} from "./fg-size-conversion.util";

describe("deriveKgPerUnitFromFgSize", () => {
  it("parses grams", () => {
    expect(deriveKgPerUnitFromFgSize("450 กรัม")).toBe(0.45);
    expect(deriveKgPerUnitFromFgSize("450g")).toBe(0.45);
    expect(deriveKgPerUnitFromFgSize("450 กรัม/แพ็ค")).toBe(0.45);
  });

  it("parses kilograms", () => {
    expect(deriveKgPerUnitFromFgSize("1 กก.")).toBe(1);
    expect(deriveKgPerUnitFromFgSize("1kg")).toBe(1);
    expect(deriveKgPerUnitFromFgSize("0.5 กก.")).toBe(0.5);
  });

  it("returns null for complex or unknown text", () => {
    expect(deriveKgPerUnitFromFgSize("1*5 แพ็ค")).toBeNull();
    expect(deriveKgPerUnitFromFgSize("")).toBeNull();
    expect(deriveKgPerUnitFromFgSize("แพ็คละ")).toBeNull();
  });
});

describe("isDefaultConversionRate", () => {
  it("detects default rate", () => {
    expect(isDefaultConversionRate(1)).toBe(true);
    expect(isDefaultConversionRate(0.45)).toBe(false);
  });
});
