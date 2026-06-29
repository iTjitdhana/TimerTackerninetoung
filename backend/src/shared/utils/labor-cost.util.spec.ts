import { describe, expect, it } from "vitest";
import {
  calculateHourlyRateFromDailyWage,
  calculateLaborCostFromDailyWage,
  deriveDailyWageFromHourlyRate,
  getStandardWorkMinutes,
  resolveLaborPersistence,
  buildProductionCostMaterialDetails,
  parseProductionCostMaterialDetails,
} from "./labor-cost.util";

describe("getStandardWorkMinutes", () => {
  it("returns env value when valid", () => {
    expect(getStandardWorkMinutes("480")).toBe(480);
  });

  it("falls back to 495 when env is invalid", () => {
    expect(getStandardWorkMinutes("")).toBe(495);
    expect(getStandardWorkMinutes("abc")).toBe(495);
  });
});

describe("calculateHourlyRateFromDailyWage", () => {
  it("derives hourly rate from daily wage", () => {
    expect(calculateHourlyRateFromDailyWage(450, 495)).toBeCloseTo(54.545, 2);
  });

  it("returns 0 for invalid wage", () => {
    expect(calculateHourlyRateFromDailyWage(0, 495)).toBe(0);
  });
});

describe("deriveDailyWageFromHourlyRate", () => {
  it("reverses hourly rate back to daily wage", () => {
    const hourly = calculateHourlyRateFromDailyWage(450, 495);
    expect(deriveDailyWageFromHourlyRate(hourly, 495)).toBeCloseTo(450, 2);
  });

  it("drifts when hourly rate is rounded to 2 decimals in DB", () => {
    expect(deriveDailyWageFromHourlyRate(54.55, 495)).toBeCloseTo(450.0375, 4);
  });
});

describe("production cost material_details payload", () => {
  it("round-trips daily wage without precision loss", () => {
    const materials = [
      {
        name: "Flour",
        code: "F001",
        qty: 1,
        unit: "กก.",
        unitPrice: 10,
        cost: 10,
      },
    ];
    const payload = buildProductionCostMaterialDetails(materials, 450);
    const parsed = parseProductionCostMaterialDetails(payload);
    expect(parsed.dailyWagePerPerson).toBe(450);
    expect(parsed.materials).toHaveLength(1);
  });

  it("round-trips output lines", () => {
    const payload = buildProductionCostMaterialDetails(
      [],
      450,
      [
        {
          kind: "sellable",
          label: "แพ็ค 450g",
          qty: 150,
          unit: "แพ็ค",
          conversionRate: 0.45,
          weightKg: 67.5,
        },
      ],
    );
    const parsed = parseProductionCostMaterialDetails(payload);
    expect(parsed.outputLines).toHaveLength(1);
  });

  it("round-trips output snapshot", () => {
    const payload = buildProductionCostMaterialDetails(
      [],
      undefined,
      [
        {
          kind: "sellable",
          label: "ชิ้น",
          qty: 300,
          unit: "ชิ้น",
          conversionRate: 0.04,
          weightKg: 12,
        },
      ],
      {
        conversionVerified: true,
        conversionWarnings: [],
        conversionInfos: [],
        masterUnit: "แพ็ค",
        baseUnit: "กก.",
        fgCode: "FG001",
        outputVariants: [
          { label: "ชิ้น", unit: "ชิ้น", conversionRate: 0.04, packSize: null },
        ],
      },
    );
    const parsed = parseProductionCostMaterialDetails(payload);
    expect(parsed.outputSnapshot?.fgCode).toBe("FG001");
    expect(parsed.outputSnapshot?.outputVariants[0]?.conversionRate).toBe(0.04);
  });

  it("supports legacy array-only material_details", () => {
    const materials = [{ name: "Flour", code: "F001", qty: 1, unit: "กก.", unitPrice: 10, cost: 10 }];
    const parsed = parseProductionCostMaterialDetails(materials);
    expect(parsed.dailyWagePerPerson).toBeNull();
    expect(parsed.materials).toHaveLength(1);
  });
});

describe("calculateLaborCostFromDailyWage", () => {
  it("calculates labor cost for multiple operators", () => {
    expect(calculateLaborCostFromDailyWage(450, 2, 520, 495)).toBeCloseTo(
      945.45,
      1,
    );
  });

  it("returns 0 when job time is zero", () => {
    expect(calculateLaborCostFromDailyWage(450, 2, 0, 495)).toBe(0);
  });
});

describe("resolveLaborPersistence", () => {
  it("persists hourly rate from daily wage", () => {
    const result = resolveLaborPersistence(520, 2, 450, 495);
    expect(result.laborRatePerHour).toBeCloseTo(54.545, 2);
    expect(result.laborCost).toBeCloseTo(945.45, 1);
    expect(result.timeUsedMinutes).toBe(520);
    expect(result.operatorsCount).toBe(2);
  });

  it("uses 60 minutes when timer data is missing", () => {
    const result = resolveLaborPersistence(0, 1, 450, 495);
    expect(result.timeUsedMinutes).toBe(60);
    expect(result.laborCost).toBeCloseTo(
      calculateLaborCostFromDailyWage(450, 1, 60, 495),
      2,
    );
  });

  it("returns zero labor when daily wage is zero", () => {
    const result = resolveLaborPersistence(520, 2, 0, 495);
    expect(result.laborRatePerHour).toBe(0);
    expect(result.laborCost).toBe(0);
  });
});
