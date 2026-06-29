import { describe, expect, it } from "vitest";
import {
  detectConversionWarnings,
  parseOutputVariantsFromDescription,
  resolveProductOutput,
} from "./output-quantity.util";

describe("parseOutputVariantsFromDescription", () => {
  it("parses JSON variants", () => {
    const variants = parseOutputVariantsFromDescription(
      JSON.stringify([
        {
          label: "แพ็ค 450g",
          unit: "แพ็ค",
          conversionRate: 0.45,
          packSize: "450 กรัม",
        },
        {
          label: "แพ็ค 1 กก.",
          unit: "แพ็ค",
          conversionRate: 1,
          packSize: "1 กก.",
        },
      ]),
    );

    expect(variants).toHaveLength(2);
    expect(variants?.[0]?.conversionRate).toBe(0.45);
  });

  it("returns null for plain text", () => {
    expect(parseOutputVariantsFromDescription("450 กรัม/แพ็ค")).toBeNull();
  });
});

describe("resolveProductOutput", () => {
  it("uses conversion_description variants when present", () => {
    const config = resolveProductOutput({
      FG_Unit: "แพ็ค",
      conversion_rate: 0.45,
      base_unit: "กก.",
      FG_Size: "450 กรัม",
      conversion_description: JSON.stringify([
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
    });

    expect(config.outputVariants).toHaveLength(2);
    expect(config.unitOptions.some((option) => option.conversionRate === 1)).toBe(
      true,
    );
    expect(config.conversionVerified).toBe(true);
    expect(config.conversionSource).toBe("description");
  });

  it("marks pack with default rate as unverified", () => {
    const config = resolveProductOutput({
      FG_Unit: "แพ็ค",
      conversion_rate: 1,
      base_unit: "กก.",
      FG_Size: "1*5 แพ็ค",
    });

    expect(config.conversionVerified).toBe(false);
    expect(config.conversionWarnings.length).toBeGreaterThan(0);
    expect(config.conversionSource).toBe("default");
  });

  it("derives rate from FG_Size when master rate is default", () => {
    const config = resolveProductOutput({
      FG_Unit: "แพ็ค",
      conversion_rate: 1,
      base_unit: "กก.",
      FG_Size: "450 กรัม",
    });

    expect(config.conversionRate).toBe(0.45);
    expect(config.outputVariants[0]?.conversionRate).toBe(0.45);
    expect(config.conversionVerified).toBe(true);
    expect(config.conversionSource).toBe("fg_size");
    expect(config.conversionInfos[0]).toContain("450 กรัม");
  });

  it("is verified for kg master unit", () => {
    const config = resolveProductOutput({
      FG_Unit: "กก.",
      conversion_rate: 1,
      base_unit: "กก.",
      FG_Size: "1 กก.",
    });

    expect(config.conversionVerified).toBe(true);
    expect(config.conversionWarnings).toEqual([]);
  });

  it("warns when FG is missing and product unit is pack", () => {
    const config = resolveProductOutput(null, "แพ็ค", { fgCode: null });

    expect(config.conversionVerified).toBe(false);
    expect(config.conversionWarnings).toContain(
      "ไม่พบข้อมูล FG — อัตราแปลงอาจไม่ถูกต้อง",
    );
  });

  it("passes fgCode through config", () => {
    const config = resolveProductOutput(
      {
        FG_Unit: "แพ็ค",
        conversion_rate: 0.45,
        base_unit: "กก.",
        FG_Size: "450 กรัม",
      },
      undefined,
      { fgCode: "135012" },
    );

    expect(config.fgCode).toBe("135012");
    expect(config.conversionVerified).toBe(true);
  });

  it("converts 50 packs to correct kg for verified vs unverified rate", () => {
    const verified = resolveProductOutput({
      FG_Unit: "แพ็ค",
      conversion_rate: 0.45,
      base_unit: "กก.",
      FG_Size: "450 กรัม",
    });
    const unverified = resolveProductOutput({
      FG_Unit: "แพ็ค",
      conversion_rate: 1,
      base_unit: "กก.",
      FG_Size: "1*5 แพ็ค",
    });

    const qty = 50;
    const verifiedKg = qty * verified.outputVariants[0]!.conversionRate;
    const unverifiedKg = qty * unverified.outputVariants[0]!.conversionRate;

    expect(verifiedKg).toBeCloseTo(22.5, 2);
    expect(unverifiedKg).toBe(50);
    expect(verified.conversionVerified).toBe(true);
    expect(unverified.conversionVerified).toBe(false);
  });
});

describe("detectConversionWarnings", () => {
  it("returns info when source is fg_size", () => {
    const result = detectConversionWarnings({
      fg: {
        FG_Unit: "แพ็ค",
        conversion_rate: 1,
        FG_Size: "450 กรัม",
      },
      fgCode: "135012",
      masterUnit: "แพ็ค",
      masterConversionRate: 0.45,
      outputVariants: [
        {
          label: "450 กรัม",
          unit: "แพ็ค",
          conversionRate: 0.45,
          packSize: "450 กรัม",
        },
      ],
      conversionSource: "fg_size",
      hasParsedVariants: false,
    });

    expect(result.conversionVerified).toBe(true);
    expect(result.conversionInfos[0]).toContain("450 กรัม");
  });
});
