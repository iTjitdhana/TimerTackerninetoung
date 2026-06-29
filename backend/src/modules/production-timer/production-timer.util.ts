import { process_executions_status } from "@prisma/client";
import type { TimerStepDto } from "./dto/production-timer.dto";

export function resolveExecutionStatus(
  step: Pick<TimerStepDto, "completed" | "startTime">,
  currentStatus: process_executions_status,
): process_executions_status {
  if (step.completed) {
    return process_executions_status.completed;
  }
  if (step.startTime) {
    return process_executions_status.in_progress;
  }
  return currentStatus;
}

/** Admin correction: explicit reset to pending when times are cleared. */
export function resolveAdminExecutionStatus(
  step: Pick<TimerStepDto, "completed" | "startTime" | "endTime">,
): process_executions_status {
  if (step.completed) {
    return process_executions_status.completed;
  }
  if (step.startTime) {
    return process_executions_status.in_progress;
  }
  return process_executions_status.pending;
}

export function findExecutionForStep<
  T extends { process_description: string },
>(executions: T[], stepName: string): T | undefined {
  return executions.find((row) => row.process_description === stepName);
}
