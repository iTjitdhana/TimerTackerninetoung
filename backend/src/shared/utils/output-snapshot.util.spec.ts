import { describe, expect, it } from "vitest";
import {
  buildLegacyOutputLinesFromBatchResult,
  buildOutputSnapshot,
  deriveSnapshotFromOutputLines,
  resolveSavedConversionStatus,
  resolveSavedOutputSnapshot,
} from "./output-snapshot.util";
import type { ProductOutputConfig } from "./output-quantity.util";

const baseConfig: ProductOutputConfig = {
  defaultOutputUnit: "ชิ้น",
  baseUnit: "กก.",
  packSize: "40 กรัม",
  unitOptions: [{ unit: "ชิ้น", conversionRate: 0.04 }],
  outputVariants: [
    { label: "ชิ้น (40 ก.)", unit: "ชิ้น", conversionRate: 0.04, packSize: "40 กรัม" },
  ],
  masterUnit: "แพ็ค",
  outputUnit: "แพ็ค",
  conversionRate: 0.24,
  conversionVerified: true,
  conversionWarnings: [],
  conversionInfos: [],
  conversionSource: "master",
  fgCode: "FG001",
};

describe("buildOutputSnapshot", () => {
  it("captures conversion metadata and variants from saved lines", () => {
    const snapshot = buildOutputSnapshot(baseConfig, [
      {
        kind: "sellable",
        label: "ชิ้น (40 ก.)",
        qty: 300,
        unit: "ชิ้น",
        conversionRate: 0.04,
        weightKg: 12,
      },
    ]);

    expect(snapshot.conversionVerified).toBe(true);
    expect(snapshot.fgCode).toBe("FG001");
    expect(snapshot.outputVariants).toEqual([
      expect.objectContaining({ unit: "ชิ้น", conversionRate: 0.04 }),
    ]);
  });
});

describe("buildLegacyOutputLinesFromBatchResult", () => {
  it("derives conversion rate from saved secondary qty without FG master", () => {
    const lines = buildLegacyOutputLinesFromBatchResult({
      good_qty: 300,
      good_secondary_qty: 12,
      good_secondary_unit: "ชิ้น",
      defect_qty: 1,
    });

    const sellable = lines.find((line) => line.kind === "sellable");
    expect(sellable?.qty).toBe(300);
    expect(sellable?.conversionRate).toBeCloseTo(0.04, 4);
    expect(sellable?.weightKg).toBe(12);
  });
});

describe("resolveSavedConversionStatus", () => {
  it("uses stored snapshot verification state", () => {
    const status = resolveSavedConversionStatus({
      outputSnapshot: {
        conversionVerified: true,
        conversionWarnings: [],
        conversionInfos: [],
        masterUnit: "ชิ้น",
        baseUnit: "กก.",
        fgCode: "FG001",
        outputVariants: [
          { label: "ชิ้น", unit: "ชิ้น", conversionRate: 0.04, packSize: null },
        ],
      },
    });

    expect(status.conversionVerified).toBe(true);
    expect(status.fgCode).toBe("FG001");
  });

  it("derives verification from output lines when snapshot is missing", () => {
    const status = resolveSavedConversionStatus({
      outputLines: [
        {
          kind: "sellable",
          label: "ชิ้น",
          qty: 100,
          unit: "ชิ้น",
          conversionRate: 0.04,
          weightKg: 4,
        },
      ],
    });

    expect(status.conversionVerified).toBe(true);
  });
});

describe("resolveSavedOutputSnapshot", () => {
  it("prefers stored snapshot over live config", () => {
    const snapshot = resolveSavedOutputSnapshot({
      storedSnapshot: deriveSnapshotFromOutputLines(
        [
          {
            kind: "sellable",
            label: "ชิ้น",
            qty: 50,
            unit: "ชิ้น",
            conversionRate: 0.04,
          },
        ],
        { conversionVerified: true, fgCode: "FG001" },
      ),
      outputConfig: {
        ...baseConfig,
        conversionVerified: false,
        outputVariants: [
          { label: "ชิ้น", unit: "ชิ้น", conversionRate: 0.05, packSize: null },
        ],
      },
    });

    expect(snapshot?.outputVariants[0]?.conversionRate).toBe(0.04);
    expect(snapshot?.conversionVerified).toBe(true);
  });
});
