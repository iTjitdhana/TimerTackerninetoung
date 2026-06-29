import { describe, expect, it } from "vitest"
import {
  aggregateOutputLines,
  buildOutputLinesFromFormState,
  calculateHourlyRateFromDailyWage,
  calculateLaborCostFromDailyWage,
  calculateMultiOutputCostBreakdown,
  calculateYieldPercent,
  DEFAULT_OUTPUT_CONFIG,
  formatMinutesAsThaiDuration,
  normalizeOutputConfig,
  parseOutputVariantsFromDescription,
} from "./production-summary.api"
import { buildInitialSellableQtys } from "../utils/sellable-qty"
import { resolveOutputDisplayState } from "../utils/resolve-output-display"
import { resolveSummaryViewMode } from "../utils/resolve-summary-view-mode"

describe("parseOutputVariantsFromDescription", () => {
  it("parses JSON variants", () => {
    const variants = parseOutputVariantsFromDescription(
      JSON.stringify([
        {
          label: "แพ็ค 450g",
          unit: "แพ็ค",
          conversionRate: 0.45,
        },
        {
          label: "แพ็ค 1 กก.",
          unit: "แพ็ค",
          conversionRate: 1,
        },
      ]),
    )

    expect(variants).toHaveLength(2)
  })
})

describe("buildOutputLinesFromFormState", () => {
  it("builds sellable lines and auto scrap", () => {
    const lines = buildOutputLinesFromFormState({
      variants: [
        { label: "แพ็ค 450g", unit: "แพ็ค", conversionRate: 0.45 },
        { label: "แพ็ค 1 กก.", unit: "แพ็ค", conversionRate: 1 },
      ],
      sellableQtys: {
        "แพ็ค 450g-แพ็ค-0": "150",
        "แพ็ค 1 กก.-แพ็ค-1": "28",
      },
      scrapQty: "",
      scrapTouched: false,
      inputMaterialKg: 96,
    })

    const aggregated = aggregateOutputLines(lines)
    expect(aggregated.sellableKg).toBeCloseTo(95.5, 2)
    expect(aggregated.scrapKg).toBeCloseTo(0.5, 2)
  })
})

describe("calculateMultiOutputCostBreakdown", () => {
  it("allocates cost per sellable line", () => {
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
    ])

    expect(breakdown.costPerSellableKg).toBeCloseTo(38.456, 2)
    expect(breakdown.sellableLineCosts[0]?.costPerUnit).toBeCloseTo(17.305, 2)
    expect(breakdown.scrapCost).toBeCloseTo(19.23, 1)
  })
})

describe("normalizeOutputConfig", () => {
  it("includes outputVariants from API config", () => {
    const config = normalizeOutputConfig({
      outputVariants: [
        { label: "แพ็ค 450g", unit: "แพ็ค", conversionRate: 0.45 },
      ],
      masterUnit: "แพ็ค",
      conversionRate: 0.45,
    })

    expect(config.outputVariants).toHaveLength(1)
    expect(config.conversionVerified).toBe(true)
    expect(config.conversionWarnings).toEqual([])
  })

  it("preserves conversion metadata from API", () => {
    const config = normalizeOutputConfig({
      masterUnit: "แพ็ค",
      conversionRate: 1,
      conversionVerified: false,
      conversionWarnings: ["ยังไม่มีน้ำหนักต่อแพ็คในระบบ (ใช้ 1:1 ชั่วคราว)"],
      conversionInfos: [],
      conversionSource: "default",
      fgCode: "135012",
    })

    expect(config.conversionVerified).toBe(false)
    expect(config.fgCode).toBe("135012")
  })
})

describe("calculateYieldPercent", () => {
  it("includes scrap in total output", () => {
    expect(calculateYieldPercent(109.98, 95.5, 0.5)).toBeCloseTo(87.29, 0)
  })

  it("returns null when input is zero", () => {
    expect(calculateYieldPercent(0, 67.5, 28.5)).toBeNull()
  })
})

describe("calculateHourlyRateFromDailyWage", () => {
  it("derives hourly rate from daily wage", () => {
    expect(calculateHourlyRateFromDailyWage(450, 495)).toBeCloseTo(54.545, 2)
  })
})

describe("calculateLaborCostFromDailyWage", () => {
  it("calculates labor cost for multiple operators", () => {
    expect(calculateLaborCostFromDailyWage(450, 2, 520, 495)).toBeCloseTo(
      945.45,
      1,
    )
  })
})

describe("formatMinutesAsThaiDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatMinutesAsThaiDuration(270)).toBe("4 ชม. 30 นาที")
  })
})

describe("buildInitialSellableQtys", () => {
  it("matches saved qty when master conversion rate changed", () => {
    const variants = [
      { label: "ชิ้น (40 ก.)", unit: "ชิ้น", conversionRate: 0.05 },
    ]
    const qtys = buildInitialSellableQtys(variants, [
      {
        kind: "sellable",
        label: "ชิ้น (40 ก.)",
        unit: "ชิ้น",
        qty: 300,
        conversionRate: 0.04,
      },
    ])

    expect(qtys["ชิ้น (40 ก.)-ชิ้น-0"]).toBe("300")
  })
})

describe("resolveOutputDisplayState", () => {
  const liveConfig = {
    ...DEFAULT_OUTPUT_CONFIG,
    masterUnit: "ชิ้น",
    conversionVerified: false,
    conversionWarnings: ["master warning"],
    outputVariants: [
      { label: "ชิ้น", unit: "ชิ้น", conversionRate: 0.05, packSize: null },
    ],
  }

  const savedSnapshot = {
    conversionVerified: true,
    conversionWarnings: [],
    conversionInfos: [],
    masterUnit: "แพ็ค",
    baseUnit: "กก.",
    fgCode: "FG001",
    outputVariants: [
      {
        label: "ชิ้น (40 ก.)",
        unit: "ชิ้น",
        conversionRate: 0.04,
        packSize: "40 กรัม",
      },
    ],
  }

  it("uses saved snapshot for completed jobs viewed by non-admin", () => {
    const display = resolveOutputDisplayState({
      hasSavedSummary: true,
      isAdminEditor: false,
      savedSnapshot,
      liveConfig,
    })

    expect(display.useSavedSnapshot).toBe(true)
    expect(display.variants[0]?.conversionRate).toBe(0.04)
    expect(display.conversionVerified).toBe(true)
    expect(display.conversionWarnings).toEqual([])
  })

  it("uses live config when admin re-edits saved job", () => {
    const display = resolveOutputDisplayState({
      hasSavedSummary: true,
      isAdminEditor: true,
      savedSnapshot,
      liveConfig,
    })

    expect(display.useSavedSnapshot).toBe(false)
    expect(display.variants[0]?.conversionRate).toBe(0.05)
    expect(display.conversionVerified).toBe(false)
    expect(display.conversionWarnings).toContain("master warning")
  })
})

describe("resolveSummaryViewMode", () => {
  it("returns entry before first save", () => {
    expect(
      resolveSummaryViewMode({
        hasSavedSummary: false,
        isAdminEditor: false,
        adminEditing: false,
      }),
    ).toBe("entry")
  })

  it("returns saved after save for regular user", () => {
    expect(
      resolveSummaryViewMode({
        hasSavedSummary: true,
        isAdminEditor: false,
        adminEditing: false,
      }),
    ).toBe("saved")
  })

  it("returns adminEditing when admin opens edit panel", () => {
    expect(
      resolveSummaryViewMode({
        hasSavedSummary: true,
        isAdminEditor: true,
        adminEditing: true,
      }),
    ).toBe("adminEditing")
  })

  it("returns saved for admin before opening edit panel", () => {
    expect(
      resolveSummaryViewMode({
        hasSavedSummary: true,
        isAdminEditor: true,
        adminEditing: false,
      }),
    ).toBe("saved")
  })
})
