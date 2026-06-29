import { describe, expect, it } from "vitest";
import {
  aggregateOutputLines,
  buildOutputLinesFromLegacy,
  calculateMultiOutputCostBreakdown,
  resolvePrimarySellableLine,
  resolveScrapKg,
} from "./production-output.util";

describe("aggregateOutputLines", () => {
  it("aggregates sour soup multi-output example", () => {
    const aggregated = aggregateOutputLines([
      {
        kind: "sellable",
        label: "แพ็ค 450g",
        qty: 150,
        unit: "แพ็ค",
        conversionRate: 0.45,
      },
      {
        kind: "sellable",
        label: "แพ็ค 1 กก.",
        qty: 28,
        unit: "แพ็ค",
        conversionRate: 1,
      },
      {
        kind: "scrap",
        label: "เศษ",
        qty: 0.5,
        unit: "กก.",
        conversionRate: 1,
      },
    ]);

    expect(aggregated.sellableKg).toBeCloseTo(95.5, 2);
    expect(aggregated.scrapKg).toBeCloseTo(0.5, 2);
    expect(aggregated.totalOutputKg).toBeCloseTo(96, 2);
  });
});

describe("calculateMultiOutputCostBreakdown", () => {
  it("allocates cost per sellable kg and per pack line", () => {
    const breakdown = calculateMultiOutputCostBreakdown(3672.58, [
      {
        kind: "sellable",
        label: "แพ็ค 450g",
        qty: 150,
        unit: "แพ็ค",
        conversionRate: 0.45,
      },
      {
        kind: "sellable",
        label: "แพ็ค 1 กก.",
        qty: 28,
        unit: "แพ็ค",
        conversionRate: 1,
      },
      {
        kind: "scrap",
        label: "เศษ",
        qty: 0.5,
        unit: "กก.",
        conversionRate: 1,
      },
    ]);

    expect(breakdown.costPerSellableKg).toBeCloseTo(38.456, 2);
    expect(breakdown.sellableLineCosts[0]?.costPerUnit).toBeCloseTo(17.305, 2);
    expect(breakdown.sellableLineCosts[1]?.costPerUnit).toBeCloseTo(38.456, 2);
    expect(breakdown.scrapCost).toBeCloseTo(19.23, 1);
  });
});

describe("resolvePrimarySellableLine", () => {
  it("picks the heaviest sellable line", () => {
    const aggregated = aggregateOutputLines([
      {
        kind: "sellable",
        label: "แพ็ค 450g",
        qty: 150,
        unit: "แพ็ค",
        conversionRate: 0.45,
      },
      {
        kind: "sellable",
        label: "แพ็ค 1 กก.",
        qty: 28,
        unit: "แพ็ค",
        conversionRate: 1,
      },
    ]);

    const primary = resolvePrimarySellableLine(aggregated.sellableLines);
    expect(primary?.label).toBe("แพ็ค 450g");
  });
});

describe("buildOutputLinesFromLegacy", () => {
  it("builds one sellable line and scrap", () => {
    const lines = buildOutputLinesFromLegacy({
      outputQty: 150,
      outputUnit: "แพ็ค",
      conversionRate: 0.45,
      label: "แพ็ค 450g",
      scrapQty: 0.5,
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]?.kind).toBe("sellable");
    expect(lines[1]?.kind).toBe("scrap");
  });
});

describe("resolveScrapKg", () => {
  it("auto-calculates scrap from input minus sellable", () => {
    expect(
      resolveScrapKg({
        inputMaterialKg: 96,
        sellableKg: 95.5,
      }),
    ).toBeCloseTo(0.5, 2);
  });
});
