import {
  process_executions_status,
  production_batches_status,
  work_plans,
  work_plans_workflow_status,
} from "@prisma/client";
import { ProductionJobDto } from "../dto/production-job.dto";
import type { JobOperatorProfile } from "../dto/job-operator.dto";

type WorkPlanWithOperators = work_plans & {
  business_units?: {
    id: number;
    code: string;
    name: string;
  } | null;
  work_plan_operators?: Array<{
    id_code: string | null;
    users: { name: string; id_code?: string | null } | null;
  }>;
};

export interface JobStatusContext {
  batchStatus?: production_batches_status | null;
  hasProductionResult?: boolean;
  hasInProgressExecution?: boolean;
}

export function formatTime(value: Date | null | undefined): string | null {
  if (!value) return null;
  const hours = value.getUTCHours().toString().padStart(2, "0");
  const minutes = value.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatDateOnly(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function mapJobStatus(
  workflowStatus: work_plans_workflow_status | null | undefined,
  context?: JobStatusContext,
): string {
  if (
    workflowStatus === work_plans_workflow_status.completed ||
    context?.hasProductionResult
  ) {
    return "completed";
  }

  if (
    context?.batchStatus === production_batches_status.producing ||
    context?.hasInProgressExecution
  ) {
    return "in_production";
  }

  return "pending";
}

export function collectUnresolvedOperatorIdCodes(
  workPlans: WorkPlanWithOperators[],
): string[] {
  const codes = new Set<string>();

  for (const workPlan of workPlans) {
    for (const operator of workPlan.work_plan_operators ?? []) {
      if (!operator.users?.name && operator.id_code) {
        codes.add(operator.id_code);
      }
    }
  }

  return [...codes];
}

function resolveOperatorDisplayName(
  operator: NonNullable<WorkPlanWithOperators["work_plan_operators"]>[number],
  nameByIdCode?: ReadonlyMap<string, string>,
): string | null {
  if (operator.users?.name) {
    return operator.users.name;
  }

  if (operator.id_code && nameByIdCode?.has(operator.id_code)) {
    return nameByIdCode.get(operator.id_code) ?? null;
  }

  return operator.id_code ?? null;
}

function resolveOperatorEmployeeId(
  operator: NonNullable<WorkPlanWithOperators["work_plan_operators"]>[number],
): string | undefined {
  const employeeId = operator.users?.id_code ?? operator.id_code ?? undefined;
  return employeeId ?? undefined;
}

export function extractOperatorProfiles(
  workPlan: WorkPlanWithOperators,
  nameByIdCode?: ReadonlyMap<string, string>,
): JobOperatorProfile[] {
  const fromRelations: JobOperatorProfile[] = [];

  for (const operator of workPlan.work_plan_operators ?? []) {
    const name = resolveOperatorDisplayName(operator, nameByIdCode);
    if (!name) continue;
    fromRelations.push({
      name,
      employeeId: resolveOperatorEmployeeId(operator),
    });
  }

  if (fromRelations.length > 0) {
    return fromRelations;
  }

  if (!workPlan.operators || !Array.isArray(workPlan.operators)) {
    return [];
  }

  return workPlan.operators.map((value) => ({
    name: String(value),
  }));
}

export function extractOperators(
  workPlan: WorkPlanWithOperators,
  nameByIdCode?: ReadonlyMap<string, string>,
): string[] {
  return extractOperatorProfiles(workPlan, nameByIdCode).map(
    (profile) => profile.name,
  );
}

/**
 * ตรวจว่า work plan นี้ผู้ดู (viewer) ควรเห็นหรือไม่ (เฉพาะงานที่ตัวเองได้รับมอบหมาย)
 * - ถ้ามีแถวความสัมพันธ์ work_plan_operators: เทียบ id_code โดยตรง หรือผ่าน users.id_code
 * - ถ้าไม่มี (work plan เก่า): fallback เทียบชื่อจาก operators JSON
 */
export function isWorkPlanVisibleToViewer(
  workPlan: WorkPlanWithOperators,
  viewer: { idCode: string; name: string },
): boolean {
  const operators = workPlan.work_plan_operators ?? [];

  if (operators.length > 0) {
    return operators.some(
      (operator) =>
        operator.id_code === viewer.idCode ||
        operator.users?.id_code === viewer.idCode,
    );
  }

  if (Array.isArray(workPlan.operators)) {
    return workPlan.operators.map(String).includes(viewer.name);
  }

  return false;
}

export function toProductionJobDto(
  workPlan: WorkPlanWithOperators,
  context?: JobStatusContext,
  nameByIdCode?: ReadonlyMap<string, string>,
): ProductionJobDto {
  return {
    id: String(workPlan.id),
    workplanRef: String(workPlan.id),
    jobCode: workPlan.job_code,
    productName: workPlan.job_name ?? workPlan.job_code,
    scheduledDate: formatDateOnly(workPlan.production_date),
    startTime: formatTime(workPlan.start_time),
    endTime: formatTime(workPlan.end_time),
    status: mapJobStatus(workPlan.workflow_status, context),
    operators: extractOperatorProfiles(workPlan, nameByIdCode),
    notes: workPlan.notes?.trim() || null,
    buId: workPlan.bu_id,
    buCode: workPlan.business_units?.code,
    buName: workPlan.business_units?.name,
    createdAt: workPlan.created_at?.toISOString(),
  };
}

export function hasInProgressExecution(
  statuses: Array<process_executions_status | null | undefined>,
): boolean {
  return statuses.some(
    (status) => status === process_executions_status.in_progress,
  );
}
