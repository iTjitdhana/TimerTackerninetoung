import { describe, expect, it } from "vitest";
import {
  formatQuantity,
  normalizeBatchCount,
  scaleBomQuantity,
} from "./batch-quantity.util";

describe("batch-quantity.util", () => {
  describe("normalizeBatchCount", () => {
    it("returns 1 for invalid or missing values", () => {
      expect(normalizeBatchCount(undefined)).toBe(1);
      expect(normalizeBatchCount(null)).toBe(1);
      expect(normalizeBatchCount("")).toBe(1);
      expect(normalizeBatchCount(0)).toBe(1);
      expect(normalizeBatchCount(-2)).toBe(1);
      expect(normalizeBatchCount("abc")).toBe(1);
    });

    it("floors decimal values to at least 1", () => {
      expect(normalizeBatchCount(2.9)).toBe(2);
      expect(normalizeBatchCount("3.7")).toBe(3);
    });

    it("accepts valid integers", () => {
      expect(normalizeBatchCount(1)).toBe(1);
      expect(normalizeBatchCount(2)).toBe(2);
      expect(normalizeBatchCount("5")).toBe(5);
    });
  });

  describe("scaleBomQuantity", () => {
    it("multiplies base by batch count", () => {
      expect(scaleBomQuantity(8, 2)).toBe(16);
      expect(scaleBomQuantity(8, 1)).toBe(8);
      expect(scaleBomQuantity(2.5, 3)).toBe(7.5);
    });

    it("treats invalid base as 0", () => {
      expect(scaleBomQuantity(Number.NaN, 2)).toBe(0);
    });
  });

  describe("formatQuantity", () => {
    it("formats integers without decimals", () => {
      expect(formatQuantity(16)).toBe("16");
      expect(formatQuantity(8)).toBe("8");
    });

    it("keeps up to 3 decimal places", () => {
      expect(formatQuantity(2.5)).toBe("2.5");
      expect(formatQuantity(1.2345)).toBe("1.235");
    });

    it("handles non-finite values", () => {
      expect(formatQuantity(Number.NaN)).toBe("0");
    });
  });
});
