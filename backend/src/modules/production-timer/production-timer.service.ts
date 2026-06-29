import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  process_executions_status,
  production_batches_status,
} from "@prisma/client";
import { Observable, defer, from, interval, merge, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { ProductionTimerEventsService } from "./production-timer-events.service";
import { ProfileAvatarService } from "../auth/profile-avatar.service";
import { BatchResolverService } from "../../shared/services/batch-resolver.service";
import { BomService } from "../../shared/services/bom.service";
import { MaterialResolverService } from "../../shared/services/material-resolver.service";
import { ProcessStepsReaderService } from "../../shared/services/process-steps-reader.service";
import { ProcessTemplatesReaderService } from "../../shared/services/process-templates-reader.service";
import { ProductionLogService } from "../../shared/services/production-log.service";
import { UserResolverService } from "../../shared/services/user-resolver.service";
import { PrismaService } from "../../shared/prisma/prisma.module";
import type { JobOperatorProfile } from "../../shared/dto/job-operator.dto";
import {
  formatDateOnly,
  extractOperatorProfiles,
  collectUnresolvedOperatorIdCodes,
  formatTime,
} from "../../shared/mappers/job.mapper";
import {
  parseClockHmToBangkokDate,
  parseDurationHmToMinutes,
  parseIsoOrDate,
  nowUtc,
} from "../../shared/utils/datetime.util";
import {
  normalizeBatchCount,
  scaleBomQuantity,
} from "../../shared/utils/batch-quantity.util";
import {
  resolveMaterialUnitPrice,
} from "../../shared/utils/material-unit-price.util";
import { isOperatorWeighableMaterial } from "../../shared/utils/operator-weighable-material.util";
import {
  canonicalWeighingUnit,
  isValidWeighingUnit,
} from "../../shared/utils/weighing-unit.util";
import {
  CreateProductionSessionDto,
  SaveOperatorWeighingDto,
  TimerStepDto,
  UpdateProductionSessionDto,
} from "./dto/production-timer.dto";
import {
  findExecutionForStep,
  resolveAdminExecutionStatus,
  resolveExecutionStatus,
} from "./production-timer.util";

type ResolvedProductionStep = {
  process_number: number;
  process_description: string;
  template_id?: number;
};

type LatestTemplateRow = {
  id: number;
  process_number: number;
  process_description: string;
};

type SseMessage = { data: { type: "session" | "ping"; payload?: unknown } };

/** keep-alive กัน proxy ตัด idle connection */
const SSE_HEARTBEAT_MS = 25000;

@Injectable()
export class ProductionTimerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batchResolver: BatchResolverService,
    private readonly bomService: BomService,
    private readonly processStepsReader: ProcessStepsReaderService,
    private readonly processTemplatesReader: ProcessTemplatesReaderService,
    private readonly productionLogService: ProductionLogService,
    private readonly userResolver: UserResolverService,
    private readonly materialResolver: MaterialResolverService,
    private readonly events: ProductionTimerEventsService,
    private readonly profileAvatarService: ProfileAvatarService,
  ) {}

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

  /**
   * SSE stream ของ session 1 งาน:
   * - ส่ง snapshot ปัจจุบันทันทีตอน connect
   * - relay payload ที่ EventsService push มา (มาจาก mutation หรือ poller) — ไม่ query DB ซ้ำต่อ client
   * - heartbeat กัน connection ถูกตัด
   * - นับ subscriber เพื่อให้ poller เฝ้าเฉพาะงานที่มีคนดู
   */
  streamSession(jobId: string): Observable<SseMessage> {
    const initial$ = defer(() => from(this.getByJobId(jobId))).pipe(
      map((session): SseMessage => ({ data: { type: "session", payload: session } })),
      catchError(() => of<SseMessage>({ data: { type: "ping" } })),
    );

    const updates$ = this.events.onJob(jobId).pipe(
      map((session): SseMessage => ({ data: { type: "session", payload: session } })),
    );

    const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
      map((): SseMessage => ({ data: { type: "ping" } })),
    );

    return new Observable<SseMessage>((subscriber) => {
      this.events.trackSubscriber(jobId);
      const inner = merge(initial$, updates$, heartbeat$).subscribe(subscriber);
      return () => {
        inner.unsubscribe();
        this.events.untrackSubscriber(jobId);
      };
    });
  }

  private async findProcessTemplates(productCode: string) {
    const externalTemplates =
      await this.processTemplatesReader.findTemplates(productCode);
    if (externalTemplates.length > 0) {
      return externalTemplates;
    }

    const latestTemplates = await this.prisma.$queryRaw<LatestTemplateRow[]>`
      SELECT id, process_number, process_description
      FROM v_latest_process_templates
      WHERE product_code = ${productCode}
        AND is_active = 1
      ORDER BY process_number ASC
    `;

    if (latestTemplates.length > 0) {
      return latestTemplates;
    }

    const preferredVersionRow =
      await this.prisma.product_active_versions.findUnique({
        where: { product_code: productCode },
      });
    const preferredVersion = preferredVersionRow?.active_version ?? 1;

    const preferredTemplates = await this.prisma.process_templates.findMany({
      where: {
        product_code: productCode,
        version: preferredVersion,
        is_active: true,
      },
      orderBy: { process_number: "asc" },
    });

    if (preferredTemplates.length > 0) {
      return preferredTemplates;
    }

    const latestVersion = await this.prisma.process_templates.aggregate({
      where: { product_code: productCode, is_active: true },
      _max: { version: true },
    });

    const fallbackVersion = latestVersion._max.version;
    if (fallbackVersion == null) {
      return [];
    }

    return this.prisma.process_templates.findMany({
      where: {
        product_code: productCode,
        version: fallbackVersion,
        is_active: true,
      },
      orderBy: { process_number: "asc" },
    });
  }

  private async findHistoricalStepDescriptions(
    productCode: string,
  ): Promise<Map<number, string>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ process_number: number; process_description: string }>
    >`
      SELECT process_number, MIN(process_description) AS process_description
      FROM process_executions
      WHERE product_code = ${productCode}
      GROUP BY process_number
      ORDER BY process_number ASC
    `;

    return new Map(
      rows.map((row) => [row.process_number, row.process_description]),
    );
  }

  private async resolveStepsFromLogs(
    workPlanId: number,
    jobCode: string,
  ): Promise<ResolvedProductionStep[]> {
    const stepNumbers =
      await this.productionLogService.getLoggedStepNumbers(workPlanId);
    if (stepNumbers.length === 0) {
      return [];
    }

    const descriptions = await this.findHistoricalStepDescriptions(jobCode);
    const maxStep = Math.max(...stepNumbers);

    return Array.from({ length: maxStep }, (_, index) => {
      const processNumber = index + 1;
      return {
        process_number: processNumber,
        process_description:
          descriptions.get(processNumber) ?? `ขั้นตอนที่ ${processNumber}`,
      };
    });
  }

  private async resolveProductionSteps(
    jobCode: string,
    jobName?: string | null,
    workPlanId?: number,
  ): Promise<ResolvedProductionStep[]> {
    const templates = await this.findProcessTemplates(jobCode);
    if (templates.length > 0) {
      return templates.map((template) => ({
        process_number: template.process_number,
        process_description: template.process_description,
        template_id: template.id,
      }));
    }

    const steps = await this.processStepsReader.findSteps(jobCode, jobName);
    if (steps.length > 0) {
      return steps.map((step) => ({
        process_number: step.process_number,
        process_description: step.process_description,
      }));
    }

    if (workPlanId) {
      return this.resolveStepsFromLogs(workPlanId, jobCode);
    }

    return [];
  }

  private async resolveTemplateId(
    productCode: string,
    processNumber: number,
  ): Promise<number> {
    // 1) ตรง process_number และ active (เวอร์ชันล่าสุดก่อน)
    const exactActive = await this.prisma.process_templates.findFirst({
      where: {
        product_code: productCode,
        process_number: processNumber,
        is_active: true,
      },
      orderBy: { version: "desc" },
    });
    if (exactActive) {
      return exactActive.id;
    }

    // 2) ตรง process_number แต่ไม่สนใจ is_active (กันกรณี flag หาย/เป็น 0)
    const exactAnyState = await this.prisma.process_templates.findFirst({
      where: { product_code: productCode, process_number: processNumber },
      orderBy: { version: "desc" },
    });
    if (exactAnyState) {
      return exactAnyState.id;
    }

    // 3) ไม่มี template ของขั้นตอนนี้เลย — เลือกขั้นตอนที่ "ใกล้ที่สุด" แทนการหยิบขั้นตอนแรกแบบสุ่ม
    //    (กัน template_id ผิดขั้นตอนชัดเจนตามที่พบในการตรวจสอบ)
    const candidates = await this.prisma.process_templates.findMany({
      where: { product_code: productCode },
      orderBy: { version: "desc" },
      select: { id: true, process_number: true, version: true },
    });
    if (candidates.length > 0) {
      const nearest = candidates.reduce((best, current) => {
        const bestDistance = Math.abs(best.process_number - processNumber);
        const currentDistance = Math.abs(current.process_number - processNumber);
        return currentDistance < bestDistance ? current : best;
      });
      return nearest.id;
    }

    throw new NotFoundException(
      `No process template available to start production for ${productCode}`,
    );
  }

  private async ensureProductExists(workPlan: {
    job_code: string;
    job_name: string | null;
  }): Promise<string> {
    const productCode = workPlan.job_code.slice(0, 20);
    const existing = await this.prisma.products.findUnique({
      where: { product_code: productCode },
      select: { product_code: true },
    });
    if (existing) {
      return productCode;
    }

    try {
      await this.prisma.products.create({
        data: {
          product_code: productCode,
          product_name: (workPlan.job_name ?? workPlan.job_code).slice(0, 100),
          product_type: "FG",
          is_active: true,
        },
      });
    } catch {
      const created = await this.prisma.products.findUnique({
        where: { product_code: productCode },
        select: { product_code: true },
      });
      if (!created) {
        throw new NotFoundException(
          `Product "${productCode}" not found — cannot create production session`,
        );
      }
    }

    return productCode;
  }

  /** คัดลอก template จาก DB ภายนอกมาที่ local ก่อนสร้าง process_executions */
  private async ensureLocalProcessTemplates(productCode: string): Promise<void> {
    const existing = await this.prisma.process_templates.findFirst({
      where: { product_code: productCode },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    const external =
      await this.processTemplatesReader.findTemplates(productCode);
    if (external.length === 0) {
      return;
    }

    await this.prisma.process_templates.createMany({
      data: external.map((template) => ({
        product_code: productCode,
        version: 1,
        process_number: template.process_number,
        process_description: template.process_description,
        is_active: true,
      })),
      skipDuplicates: true,
    });
  }

  private async resolveWorkPlanWithOperators(jobId: string) {
    const workPlanId = this.batchResolver.parseWorkPlanId(jobId);
    const workPlan = await this.prisma.work_plans.findUnique({
      where: { id: workPlanId },
      include: {
        work_plan_operators: {
          include: { users: true },
        },
      },
    });

    if (!workPlan) {
      throw new NotFoundException(`Work plan ${jobId} not found`);
    }

    const unresolvedCodes = collectUnresolvedOperatorIdCodes([workPlan]);
    let nameByIdCode: ReadonlyMap<string, string> = new Map();
    if (unresolvedCodes.length > 0) {
      const users = await this.prisma.users.findMany({
        where: { id_code: { in: unresolvedCodes }, is_active: true },
        select: { id_code: true, name: true },
      });
      nameByIdCode = new Map(users.map((u) => [u.id_code, u.name]));
    }

    return { workPlan, nameByIdCode };
  }

  private buildSessionMetadata({
    workPlan,
    nameByIdCode,
  }: Awaited<ReturnType<typeof this.resolveWorkPlanWithOperators>>) {
    return {
      jobId: String(workPlan.id),
      productName: workPlan.job_name ?? workPlan.job_code,
      productionDate: formatDateOnly(workPlan.production_date),
      scheduledStartTime: formatTime(workPlan.start_time) ?? undefined,
      scheduledEndTime: formatTime(workPlan.end_time) ?? undefined,
      operators: this.enrichOperatorAvatars(
        extractOperatorProfiles(workPlan, nameByIdCode),
      ),
      notes: workPlan.notes ?? undefined,
    };
  }

  private executionHasRecordedData(execution: {
    start_time: Date | null;
    end_time: Date | null;
    status: process_executions_status | null;
  }): boolean {
    return (
      execution.start_time != null ||
      execution.end_time != null ||
      execution.status === process_executions_status.in_progress ||
      execution.status === process_executions_status.completed
    );
  }

  private mapLogTimingToStep(
    stepName: string,
    timing?: {
      startTime?: string;
      endTime?: string;
      duration?: string;
      completed?: boolean;
    },
  ): TimerStepDto {
    return {
      stepName,
      startTime: timing?.startTime,
      endTime: timing?.endTime,
      duration: timing?.duration,
      completed: Boolean(timing?.completed),
    };
  }

  private mapExecutionToStep(
    execution: {
      process_description: string;
      start_time: Date | null;
      end_time: Date | null;
      duration_minutes: number | null;
      status: process_executions_status | null;
    },
    logTiming?: {
      startTime?: string;
      endTime?: string;
      duration?: string;
      completed?: boolean;
    },
  ): TimerStepDto {
    const executionStartTime =
      this.productionLogService.formatExecutionTime(execution.start_time);
    const executionEndTime =
      this.productionLogService.formatExecutionTime(execution.end_time);
    const executionDuration =
      this.productionLogService.formatExecutionDuration(
        execution.start_time,
        execution.end_time,
        execution.duration_minutes,
      );

    const preferExecution = this.executionHasRecordedData(execution);

    const startTime = preferExecution
      ? executionStartTime ?? logTiming?.startTime
      : logTiming?.startTime ?? executionStartTime;
    const endTime = preferExecution
      ? executionEndTime ?? logTiming?.endTime
      : logTiming?.endTime ?? executionEndTime;
    const duration = preferExecution
      ? executionDuration ?? logTiming?.duration
      : logTiming?.duration ?? executionDuration;

    return {
      stepName: execution.process_description,
      startTime,
      endTime,
      duration,
      completed:
        execution.status === process_executions_status.completed ||
        Boolean(logTiming?.completed),
    };
  }

  private resolveStepTimes(
    step: TimerStepDto,
    productionDate: Date,
    existing: {
      start_time: Date | null;
      end_time: Date | null;
      duration_minutes: number | null;
    },
  ) {
    const startTime = step.startTime
      ? parseClockHmToBangkokDate(step.startTime, productionDate)
      : existing.start_time;
    const endTime = step.endTime
      ? parseClockHmToBangkokDate(step.endTime, productionDate)
      : existing.end_time;

    let durationMinutes =
      step.duration != null
        ? parseDurationHmToMinutes(step.duration)
        : existing.duration_minutes;

    if (startTime && endTime) {
      durationMinutes = Math.max(
        0,
        Math.floor((endTime.getTime() - startTime.getTime()) / 60000),
      );
    }

    return { startTime, endTime, durationMinutes };
  }

  private parseAdminClockTime(
    value: string | undefined,
    productionDate: Date,
  ): Date | null {
    if (value == null || value.trim() === "") {
      return null;
    }
    return parseClockHmToBangkokDate(value, productionDate);
  }

  private resolveAdminStepTimes(
    step: TimerStepDto,
    productionDate: Date,
  ): { startTime: Date | null; endTime: Date | null } {
    const startTime = this.parseAdminClockTime(step.startTime, productionDate);
    const endTime = this.parseAdminClockTime(step.endTime, productionDate);
    return { startTime, endTime };
  }

  async adminUpdateSession(
    jobId: string,
    dto: UpdateProductionSessionDto,
    adminActor?: string,
  ) {
    const workPlan = await this.batchResolver.resolveWorkPlan(jobId);
    const steps = dto.steps;

    let executions = await this.prisma.process_executions.findMany({
      where: { work_plan_id: workPlan.id },
      orderBy: { process_number: "asc" },
    });

    if (executions.length === 0) {
      executions = await this.bootstrapExecutionsForAdminCorrection(
        workPlan,
        adminActor,
      );
    }

    const batch = await this.batchResolver.findLatestBatch(workPlan.id);
    const adminUserId = adminActor
      ? await this.userResolver.resolveUserId(adminActor)
      : undefined;
    const logSyncSteps: Array<{
      processNumber: number;
      startTime: Date | null;
      endTime: Date | null;
    }> = [];

    for (const step of steps) {
      const execution = findExecutionForStep(executions, step.stepName);
      if (!execution) continue;

      const { startTime, endTime } = this.resolveAdminStepTimes(
        step,
        workPlan.production_date,
      );

      await this.prisma.process_executions.update({
        where: { id: execution.id },
        data: {
          start_time: startTime,
          end_time: endTime,
          status: resolveAdminExecutionStatus(step),
        },
      });

      logSyncSteps.push({
        processNumber: execution.process_number,
        startTime,
        endTime,
      });
    }

    await this.productionLogService.syncAdminStepTimings(
      workPlan.id,
      logSyncSteps,
      { userId: adminUserId, batchId: batch?.id ?? null },
    );

    if (batch) {
      const allCompleted = steps.length > 0 && steps.every((step) => step.completed);
      if (dto.completedAt && allCompleted) {
        await this.prisma.production_batches.update({
          where: { id: batch.id },
          data: {
            end_time: parseIsoOrDate(dto.completedAt),
            status: production_batches_status.completed,
          },
        });
      } else if (!allCompleted && batch.status === production_batches_status.completed) {
        await this.prisma.production_batches.update({
          where: { id: batch.id },
          data: {
            end_time: null,
            status: production_batches_status.producing,
          },
        });
      }
    }

    return this.publishSession(jobId);
  }

  async startSession(dto: CreateProductionSessionDto) {
    const { workPlan, batch } =
      await this.batchResolver.ensureBatchReadyForProduction(dto.jobId);

    if (batch.status !== production_batches_status.producing) {
      throw new BadRequestException(
        "Formula must be verified before starting production",
      );
    }

    const recordedBy = await this.userResolver.resolveUserId(dto.startedBy);
    const existing = await this.prisma.process_executions.findMany({
      where: { work_plan_id: workPlan.id },
    });
    const steps = await this.resolveProductionSteps(
      workPlan.job_code,
      workPlan.job_name,
      workPlan.id,
    );

    if (steps.length === 0) {
      throw new NotFoundException(
        `No production steps found for product ${workPlan.job_code}`,
      );
    }

    const existingNumbers = new Set(
      existing.map((execution) => execution.process_number),
    );
    const missingSteps = steps.filter(
      (step) => !existingNumbers.has(step.process_number),
    );

    if (existing.length === 0) {
      await this.createExecutionsForSteps(
        workPlan.id,
        batch.id,
        workPlan,
        steps,
        recordedBy,
      );
    } else if (missingSteps.length > 0) {
      await this.createExecutionsForSteps(
        workPlan.id,
        batch.id,
        workPlan,
        missingSteps,
        recordedBy,
      );
    }

    await this.prisma.production_batches.update({
      where: { id: batch.id },
      data: { status: production_batches_status.producing },
    });

    return this.publishSession(dto.jobId);
  }

  /**
   * งานที่มีเวลาใน logs แต่ยังไม่มี process_executions (ยังไม่กดเริ่มใน timer ใหม่)
   * — สร้าง execution rows ก่อนให้ admin แก้เวลาได้
   */
  private async bootstrapExecutionsForAdminCorrection(
    workPlan: {
      id: number;
      job_code: string;
      job_name: string | null;
      created_by: number | null;
    },
    adminActor?: string,
  ) {
    const batch = await this.batchResolver.findLatestBatch(workPlan.id);
    if (!batch) {
      throw new NotFoundException(
        `Production session for job ${workPlan.id} not found — complete formula weighing first`,
      );
    }

    const templateSteps = await this.resolveProductionSteps(
      workPlan.job_code,
      workPlan.job_name,
      workPlan.id,
    );
    if (templateSteps.length === 0) {
      throw new NotFoundException(
        `No production steps found for product ${workPlan.job_code}`,
      );
    }

    const recordedBy = adminActor
      ? await this.userResolver.resolveUserId(adminActor)
      : (workPlan.created_by ?? 1);

    await this.createExecutionsForSteps(
      workPlan.id,
      batch.id,
      workPlan,
      templateSteps,
      recordedBy,
    );

    return this.prisma.process_executions.findMany({
      where: { work_plan_id: workPlan.id },
      orderBy: { process_number: "asc" },
    });
  }

  private async createExecutionsForSteps(
    workPlanId: number,
    batchId: number,
    workPlan: { job_code: string; job_name: string | null },
    steps: ResolvedProductionStep[],
    recordedBy: number,
  ) {
    const productCode = await this.ensureProductExists(workPlan);
    await this.ensureLocalProcessTemplates(productCode);

    await this.prisma.process_executions.createMany({
      data: await Promise.all(
        steps.map(async (step) => ({
          work_plan_id: workPlanId,
          batch_id: batchId,
          template_id: await this.resolveTemplateId(
            productCode,
            step.process_number,
          ),
          product_code: productCode,
          process_number: step.process_number,
          process_description: step.process_description,
          status: process_executions_status.pending,
          recorded_by: recordedBy,
        })),
      ),
    });
  }

  async updateSession(jobId: string, dto: UpdateProductionSessionDto) {
    const workPlan = await this.batchResolver.resolveWorkPlan(jobId);
    const steps = dto.steps;

    const executions = await this.prisma.process_executions.findMany({
      where: { work_plan_id: workPlan.id },
      orderBy: { process_number: "asc" },
    });

    if (executions.length === 0) {
      throw new NotFoundException(`Production session for job ${jobId} not found`);
    }

    for (const step of steps) {
      const execution = findExecutionForStep(executions, step.stepName);
      if (!execution) continue;

      const { startTime, endTime } = this.resolveStepTimes(
        step,
        workPlan.production_date,
        execution,
      );

      await this.prisma.process_executions.update({
        where: { id: execution.id },
        data: {
          start_time: startTime,
          end_time: endTime,
          status: resolveExecutionStatus(
            step,
            execution.status ?? process_executions_status.pending,
          ),
        },
      });
    }

    if (dto.completedAt) {
      const batch = await this.batchResolver.findLatestBatch(workPlan.id);
      if (batch) {
        await this.prisma.production_batches.update({
          where: { id: batch.id },
          data: {
            end_time: parseIsoOrDate(dto.completedAt),
            status: production_batches_status.completed,
          },
        });
      }
    }

    return this.publishSession(jobId);
  }

  /** อ่าน session ล่าสุดแล้ว push เข้า event bus (dedup ภายใน) ก่อนส่งกลับ controller */
  private async publishSession(jobId: string) {
    const session = await this.getByJobId(jobId);
    this.events.emit(jobId, session);
    return session;
  }

  async getByJobId(jobId: string) {
    const resolved = await this.resolveWorkPlanWithOperators(jobId);
    const { workPlan } = resolved;
    const batch = await this.batchResolver.findLatestBatch(workPlan.id);
    const metadata = this.buildSessionMetadata(resolved);
    const outputConfig = await this.batchResolver.resolveProductOutputConfig(
      workPlan.job_code,
      batch?.product_code,
      workPlan.job_name,
    );
    const logTimings = await this.productionLogService.getStepTimings(
      workPlan.id,
    );

    const executions = await this.prisma.process_executions.findMany({
      where: { work_plan_id: workPlan.id },
      orderBy: { process_number: "asc" },
    });

    if (executions.length > 0) {
      return {
        ...metadata,
        jobCode: workPlan.job_code,
        outputConfig,
        steps: executions.map((execution) =>
          this.mapExecutionToStep(
            execution,
            logTimings.get(execution.process_number),
          ),
        ),
        started: true,
      };
    }

    const steps = await this.resolveProductionSteps(
      workPlan.job_code,
      workPlan.job_name,
      workPlan.id,
    );

    return {
      ...metadata,
      jobCode: workPlan.job_code,
      outputConfig,
      steps: steps.map((step) =>
        this.mapLogTimingToStep(
          step.process_description,
          logTimings.get(step.process_number),
        ),
      ),
      started: logTimings.size > 0,
    };
  }

  async saveOperatorWeighing(jobId: string, dto: SaveOperatorWeighingDto) {
    const workPlan = await this.batchResolver.resolveWorkPlan(jobId);
    const batch = await this.batchResolver.findLatestBatch(workPlan.id);
    if (!batch) {
      throw new NotFoundException(
        `Production batch for job ${jobId} not found — complete formula weighing first`,
      );
    }

    const materialCode = dto.materialCode.trim();
    const bomComponent = await this.bomService.findBomComponent(
      workPlan.job_code,
      materialCode,
    );
    if (!bomComponent) {
      throw new BadRequestException(
        `Material "${materialCode}" is not in the formula for this job`,
      );
    }

    const mat = await this.prisma.material.findUnique({
      where: { Mat_Id: materialCode },
    });
    const materialName = bomComponent.rawName ?? mat?.Mat_Name ?? materialCode;

    if (!isOperatorWeighableMaterial(materialCode, materialName)) {
      throw new BadRequestException(
        `Material "${materialCode}" cannot be weighed on the production timer`,
      );
    }

    const parsedWeight = Number.parseFloat(
      dto.measuredWeight.trim().replace(/,/g, ""),
    );
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      throw new BadRequestException("Enter a valid withdrawn quantity");
    }

    const weighingUnit = canonicalWeighingUnit(
      bomComponent.rawUnit?.trim() || mat?.Mat_Unit,
    );
    if (!isValidWeighingUnit(weighingUnit)) {
      throw new BadRequestException(
        `Unit for material "${materialCode}" is not configured`,
      );
    }

    const weighedById = await this.userResolver.resolveUserId(dto.weighedBy);
    const materialId = await this.materialResolver.resolveOrCreateMaterialId(
      materialCode,
      materialName,
      weighingUnit,
    );
    const batchCount = normalizeBatchCount(batch.batch_count);
    const plannedQty = scaleBomQuantity(bomComponent.rawQty, batchCount);
    const materialRecord = await this.prisma.materials.findUnique({
      where: { id: materialId },
    });

    const existing = await this.prisma.batch_material_usage.findFirst({
      where: { batch_id: batch.id, material_id: materialId },
    });

    const unitPrice = resolveMaterialUnitPrice(
      dto.unitPrice,
      existing?.unit_price,
      materialRecord?.price,
    );
    const savedUnit = weighingUnit.slice(0, 16);
    const weighedAt = nowUtc();

    const row = existing
      ? await this.prisma.batch_material_usage.update({
          where: { id: existing.id },
          data: {
            actual_qty: parsedWeight,
            unit: savedUnit,
            unit_price: unitPrice,
            weighed_by: weighedById,
            weighed_at: weighedAt,
          },
        })
      : await this.prisma.batch_material_usage.create({
          data: {
            batch_id: batch.id,
            material_id: materialId,
            planned_qty: plannedQty,
            actual_qty: parsedWeight,
            unit: savedUnit,
            unit_price: unitPrice,
            weighed_by: weighedById,
            weighed_at: weighedAt,
          },
        });

    return {
      jobId,
      materialCode,
      measuredWeight: String(parsedWeight),
      unit: savedUnit,
      usageId: row.id,
    };
  }
}
