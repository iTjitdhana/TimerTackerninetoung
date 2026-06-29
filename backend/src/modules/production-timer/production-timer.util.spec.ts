import { describe, expect, it } from "vitest";
import { process_executions_status } from "@prisma/client";
import {
  findExecutionForStep,
  resolveExecutionStatus,
} from "./production-timer.util";

describe("resolveExecutionStatus", () => {
  it("sets in_progress when startTime is present and not completed", () => {
    expect(
      resolveExecutionStatus(
        { startTime: "10:00", completed: false },
        process_executions_status.pending,
      ),
    ).toBe(process_executions_status.in_progress);
  });

  it("sets completed when step is completed", () => {
    expect(
      resolveExecutionStatus(
        { startTime: "10:00", completed: true },
        process_executions_status.in_progress,
      ),
    ).toBe(process_executions_status.completed);
  });

  it("keeps current status when no startTime and not completed", () => {
    expect(
      resolveExecutionStatus({}, process_executions_status.pending),
    ).toBe(process_executions_status.pending);
  });
});

describe("findExecutionForStep", () => {
  it("matches by step name not array index", () => {
    const executions = [
      { process_description: "ต้ม", process_number: 2 },
      { process_description: "เตรียม", process_number: 1 },
    ];
    expect(findExecutionForStep(executions, "ต้ม")?.process_number).toBe(2);
    expect(findExecutionForStep(executions, "ไม่มี")).toBeUndefined();
  });
});
