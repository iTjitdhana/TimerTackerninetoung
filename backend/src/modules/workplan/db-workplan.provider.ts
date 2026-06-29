import { Injectable } from "@nestjs/common";
import { process_executions_status } from "@prisma/client";
import { ProfileAvatarService } from "../auth/profile-avatar.service";
import { PrismaService } from "../../shared/prisma/prisma.module";
import type { JobOperatorProfile } from "../../shared/dto/job-operator.dto";
import {
  collectUnresolvedOperatorIdCodes,
  hasInProgressExecution,
  isWorkPlanVisibleToViewer,
  toProductionJobDto,
} from "../../shared/mappers/job.mapper";
import { ProductionJobDto } from "../../shared/dto/production-job.dto";
import { WorkplanProvider, WorkplanJobFilters } from "./workplan.interface";

@Injectable()
export class DbWorkplanProvider implements WorkplanProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileAvatarService: ProfileAvatarService,
  ) {}

  private async buildStatusContext(workPlanIds: number[]) {
    if (workPlanIds.length === 0) {
      return new Map<number, Parameters<typeof toProductionJobDto>[1]>();
    }

    const batches = await this.prisma.production_batches.findMany({
      where: { work_plan_id: { in: workPlanIds } },
      include: { batch_production_results: true },
      orderBy: { id: "desc" },
    });

    const executions = await this.prisma.process_executions.findMany({
      where: { work_plan_id: { in: workPlanIds } },
      select: { work_plan_id: true, status: true },
    });

    const contextByWorkPlan = new Map<
      number,
      Parameters<typeof toProductionJobDto>[1]
    >();

    for (const workPlanId of workPlanIds) {
      const batch = batches.find((row) => row.work_plan_id === workPlanId);
      const executionStatuses = executions
        .filter((row) => row.work_plan_id === workPlanId)
        .map((row) => row.status);

      contextByWorkPlan.set(workPlanId, {
        batchStatus: batch?.status ?? null,
        hasProductionResult: Boolean(batch?.batch_production_results),
        hasInProgressExecution: hasInProgressExecution(executionStatuses),
      });
    }

    return contextByWorkPlan;
  }

  private async buildOperatorNameMap(
    workPlans: Parameters<typeof collectUnresolvedOperatorIdCodes>[0],
  ): Promise<Map<string, string>> {
    const idCodes = collectUnresolvedOperatorIdCodes(workPlans);
    if (idCodes.length === 0) {
      return new Map();
    }

    const users = await this.prisma.users.findMany({
      where: {
        id_code: { in: idCodes },
        is_active: true,
      },
      select: { id_code: true, name: true },
    });

    return new Map(users.map((user) => [user.id_code, user.name]));
  }

  private enrichOperatorAvatars(
    operators: JobOperatorProfile[],
  ): JobOperatorProfile[] {
    return operators.map((operator) => ({
      ...operator,
      hasAvatar: operator.employeeId
        ? this.profileAvatarService.hasAvatar(operator.employeeId)
        : false,
    }));
  }

  async getJobsForDate(
    date: Date,
    filters?: WorkplanJobFilters,
  ): Promise<ProductionJobDto[]> {
    if (!this.prisma.isConnected) {
      return [];
    }

    const workPlans = await this.prisma.work_plans.findMany({
      where: {
        production_date: date,
        ...(filters?.buId != null ? { bu_id: filters.buId } : {}),
      },
      include: {
        business_units: true,
        work_plan_operators: {
          include: { users: true },
        },
      },
      orderBy: [{ start_time: "asc" }, { id: "asc" }],
    });

    const viewer = filters?.viewer;
    const visiblePlans =
      viewer && !viewer.canReadAll
        ? workPlans.filter((plan) => isWorkPlanVisibleToViewer(plan, viewer))
        : workPlans;

    const contextByWorkPlan = await this.buildStatusContext(
      visiblePlans.map((plan) => plan.id),
    );
    const nameByIdCode = await this.buildOperatorNameMap(visiblePlans);

    return visiblePlans.map((plan) => {
      const job = toProductionJobDto(
        plan,
        contextByWorkPlan.get(plan.id),
        nameByIdCode,
      );
      return {
        ...job,
        operators: this.enrichOperatorAvatars(job.operators),
      };
    });
  }

  async getJobById(id: string): Promise<ProductionJobDto | null> {
    if (!this.prisma.isConnected) {
      return null;
    }

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      return null;
    }

    const workPlan = await this.prisma.work_plans.findUnique({
      where: { id: numericId },
      include: {
        business_units: true,
        work_plan_operators: {
          include: { users: true },
        },
      },
    });

    if (!workPlan) {
      return null;
    }

    const contextByWorkPlan = await this.buildStatusContext([workPlan.id]);
    const nameByIdCode = await this.buildOperatorNameMap([workPlan]);
    const job = toProductionJobDto(
      workPlan,
      contextByWorkPlan.get(workPlan.id),
      nameByIdCode,
    );
    return {
      ...job,
      operators: this.enrichOperatorAvatars(job.operators),
    };
  }
}
