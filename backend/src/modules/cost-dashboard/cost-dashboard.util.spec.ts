import { describe, expect, it } from "vitest";
import {
  calculateYieldPercent,
  hasMaterialWeighingData,
  hasOutputQuantityData,
  isExecutionStepComplete,
  resolveProductionDataCompleteness,
  resolveSellableKgFromBatch,
  resolveTimerStatusForCost,
  resolveYieldPercentFromBatch,
} from "./cost-dashboard.util";

describe("calculateYieldPercent", () => {
  it("returns null when input is zero", () => {
    expect(calculateYieldPercent(0, 50, 5)).toBeNull();
  });

  it("calculates yield from kg values", () => {
    expect(calculateYieldPercent(109.98, 95.5, 0.5)).toBeCloseTo(87.29, 1);
  });
});

describe("resolveSellableKgFromBatch", () => {
  it("prefers good_secondary_qty", () => {
    expect(
      resolveSellableKgFromBatch({
        good_qty: 800,
        good_secondary_qty: 95.5,
        defect_qty: 0.5,
      }),
    ).toBe(95.5);
  });

  it("falls back to legacy good_qty when secondary is missing", () => {
    expect(
      resolveSellableKgFromBatch({
        good_qty: 67.5,
        good_secondary_qty: null,
        defect_qty: 2,
      }),
    ).toBe(67.5);
  });
});

describe("isExecutionStepComplete", () => {
  it("marks completed from logs when execution status is not completed", () => {
    expect(
      isExecutionStepComplete(
        {
          process_number: 1,
          status: "in_progress",
          start_time: null,
          end_time: null,
        },
        { completed: true },
      ),
    ).toBe(true);
  });

  it("marks completed when start and end times exist", () => {
    expect(
      isExecutionStepComplete(
        {
          process_number: 1,
          status: "pending",
          start_time: new Date(),
          end_time: new Date(),
        },
      ),
    ).toBe(true);
  });
});

describe("resolveTimerStatusForCost", () => {
  it("prefers work plan executions over batch executions", () => {
    expect(
      resolveTimerStatusForCost({
        batchExecutions: [
          {
            process_number: 1,
            status: "completed",
            start_time: new Date(),
            end_time: new Date(),
          },
        ],
        workPlanExecutions: [
          {
            process_number: 1,
            status: "pending",
            start_time: new Date(),
            end_time: new Date(),
          },
        ],
      }),
    ).toBe("ok");
  });

  it("uses log timings when no executions exist", () => {
    expect(
      resolveTimerStatusForCost({
        batchExecutions: [],
        workPlanExecutions: [],
        logTimings: new Map([
          [1, { completed: true }],
          [2, { completed: true }],
        ]),
      }),
    ).toBe("ok");
  });

  it("falls back to warn when only time_used_minutes exists", () => {
    expect(
      resolveTimerStatusForCost({
        batchExecutions: [],
        workPlanExecutions: [],
        timeUsedMinutes: 120,
      }),
    ).toBe("warn");
  });

  it("returns no_data when there is no timer evidence", () => {
    expect(
      resolveTimerStatusForCost({
        batchExecutions: [],
        workPlanExecutions: [],
        timeUsedMinutes: 0,
      }),
    ).toBe("no_data");
  });
});

describe("resolveProductionDataCompleteness", () => {
  it("returns 100% when material, timer, and output are complete", () => {
    expect(
      resolveProductionDataCompleteness({
        inputMaterialQty: 100,
        materialCost: 500,
        outputQty: 80,
        timerStatus: "ok",
      }),
    ).toEqual({
      percent: 100,
      hasMaterialWeighing: true,
      hasTimerData: true,
      hasOutputQty: true,
    });
  });

  it("returns 67% when one pillar is missing", () => {
    expect(
      resolveProductionDataCompleteness({
        inputMaterialQty: 100,
        outputQty: 80,
        timerStatus: "warn",
      }).percent,
    ).toBe(67);
  });

  it("returns 33% when only material data exists", () => {
    expect(
      resolveProductionDataCompleteness({
        inputMaterialQty: 100,
        timerStatus: "no_data",
      }),
    ).toEqual({
      percent: 33,
      hasMaterialWeighing: true,
      hasTimerData: false,
      hasOutputQty: false,
    });
  });

  it("returns 0% when nothing is recorded", () => {
    expect(
      resolveProductionDataCompleteness({
        timerStatus: "no_data",
      }).percent,
    ).toBe(0);
  });
});

describe("hasMaterialWeighingData", () => {
  it("accepts batch weighing records", () => {
    expect(
      hasMaterialWeighingData({ batchHasWeighingRecords: true }),
    ).toBe(true);
  });
});

describe("hasOutputQuantityData", () => {
  it("accepts batch production results", () => {
    expect(
      hasOutputQuantityData({
        batchResult: {
          good_qty: 0,
          good_secondary_qty: 12,
          defect_qty: 0,
        },
      }),
    ).toBe(true);
  });
});

describe("resolveYieldPercentFromBatch", () => {
  it("ignores misleading DB generated yield and uses kg fields", () => {
    const yieldPercent = resolveYieldPercentFromBatch(100, {
      good_qty: 800,
      good_secondary_qty: 88,
      defect_qty: 12,
    });

    expect(yieldPercent).toBe(100);
  });

  it("returns null when batch result is missing", () => {
    expect(resolveYieldPercentFromBatch(100, null)).toBeNull();
  });
});
