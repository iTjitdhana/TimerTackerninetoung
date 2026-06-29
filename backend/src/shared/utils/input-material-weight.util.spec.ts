import { describe, expect, it } from "vitest";
import {
  buildUnitConversionLookup,
  convertQtyToKg,
  sumInputMaterialKg,
} from "./input-material-weight.util";

describe("input-material-weight.util", () => {
  const lookup = buildUnitConversionLookup([
    {
      from_unit: "ฟอง",
      to_unit: "กก.",
      conversion_rate: 0.07,
      material_code: "RG101",
    },
    {
      from_unit: "แพ็ค",
      to_unit: "กก.",
      conversion_rate: 0.142,
      material_code: "RG107",
    },
  ]);

  it("converts kg and gram units directly", () => {
    expect(convertQtyToKg(1, "กก.", "RG106", lookup)).toBe(1);
    expect(convertQtyToKg(200, "กรัม", "RG103", lookup)).toBe(0.2);
  });

  it("converts material-specific units via unit_conversions", () => {
    expect(convertQtyToKg(54, "ฟอง", "RG101", lookup)).toBeCloseTo(3.78);
    expect(convertQtyToKg(18, "แพ็ค", "RG107", lookup)).toBeCloseTo(2.556);
  });

  it("sums RG001-like usage rows to full batch input kg", () => {
    const total = sumInputMaterialKg(
      [
        { qty: 54, unit: "ฟอง", materialCode: "RG101" },
        { qty: 0.2, unit: "กก.", materialCode: "RG103" },
        { qty: 0.08, unit: "กก.", materialCode: "RG104" },
        { qty: 1, unit: "กก.", materialCode: "RG106" },
        { qty: 18, unit: "แพ็ค", materialCode: "RG107" },
      ],
      lookup,
    );

    expect(total).toBeCloseTo(7.616, 3);
  });
});
