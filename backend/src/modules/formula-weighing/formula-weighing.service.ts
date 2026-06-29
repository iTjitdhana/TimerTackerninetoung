import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Observable, defer, from, interval, merge, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { BatchResolverService } from "../../shared/services/batch-resolver.service";
import { BomService } from "../../shared/services/bom.service";
import { MaterialResolverService } from "../../shared/services/material-resolver.service";
import { UserResolverService } from "../../shared/services/user-resolver.service";
import { PrismaService } from "../../shared/prisma/prisma.module";
import type { JobViewerContext } from "../../shared/auth/job-viewer";
import { withWeighingJobVisibility } from "../../shared/auth/job-viewer";
import { JobsService } from "../jobs/jobs.service";
import {
  CreateWeighingRecordDto,
  UpdateFormulaWeighingJobSettingsDto,
} from "./dto/formula-weighing.dto";
import {
  canonicalWeighingUnit,
  isValidWeighingUnit,
} from "../../shared/utils/weighing-unit.util";
import { normalizeBatchCount } from "../../shared/utils/batch-quantity.util";
import {
  resolveMaterialUnitPrice,
} from "../../shared/utils/material-unit-price.util";
import {
  formatDateTimeBangkok,
  nowUtc,
  toIsoUtc,
} from "../../shared/utils/datetime.util";
import { FormulaWeighingEventsService } from "./formula-weighing-events.service";

type SseMessage = { data: { type: "record" | "ping"; payload?: unknown } };

const SSE_HEARTBEAT_MS = 25000;

export interface FormulaWeighingJobSettingView {
  jobCode: string;
  jobName: string;
  requiresWeighing: boolean;
}

export interface MaterialSearchResult {
  code: string;
  name: string;
  unit: string;
}

@Injectable()
export class FormulaWeighingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batchResolver: BatchResolverService,
    private readonly bomService: BomService,
    private readonly materialResolver: MaterialResolverService,
    private readonly userResolver: UserResolverService,
    private readonly jobsService: JobsService,
    private readonly events: FormulaWeighingEventsService,
  ) {}

  private parseTargetDate(date?: string): Date {
    if (date) {
      return new Date(`${date}T00:00:00.000Z`);
    }
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  private async getExcludedJobCodes(): Promise<Set<string>> {
    try {
      const rows = await this.prisma.formula_weighing_job_settings.findMany({
        where: { requires_weighing: false },
        select: { job_code: true },
      });
      return new Set(rows.map((row) => row.job_code));
    } catch {
      return new Set();
    }
  }

  private async isJobWeighingRequired(jobCode: string): Promise<boolean> {
    try {
      const setting = await this.prisma.formula_weighing_job_settings.findUnique({
        where: { job_code: jobCode },
      });
      return setting?.requires_weighing ?? true;
    } catch {
      return true;
    }
  }

  async getJobsForWeighing(
    date?: string,
    buId?: number,
    viewer?: JobViewerContext,
  ) {
    const weighingViewer = viewer ? withWeighingJobVisibility(viewer) : undefined;
    const jobs = await this.jobsService.getJobsForDate(this.parseTargetDate(date), {
      buId,
      viewer: weighingViewer,
    });
    const excluded = await this.getExcludedJobCodes();
    return jobs.filter((job) => !excluded.has(job.jobCode));
  }

  async getJobSettings(): Promise<FormulaWeighingJobSettingView[]> {
    const workPlans = await this.prisma.work_plans.findMany({
      distinct: ["job_code"],
      select: {
        job_code: true,
        job_name: true,
      },
      orderBy: [{ job_name: "asc" }, { job_code: "asc" }],
    });

    let settings = new Map<string, boolean>();
    try {
      const rows = await this.prisma.formula_weighing_job_settings.findMany();
      settings = new Map(
        rows.map((row) => [row.job_code, row.requires_weighing]),
      );
    } catch {
      settings = new Map();
    }

    return workPlans.map((plan) => ({
      jobCode: plan.job_code,
      jobName: plan.job_name ?? plan.job_code,
      requiresWeighing: settings.get(plan.job_code) ?? true,
    }));
  }

  async updateJobSettings(dto: UpdateFormulaWeighingJobSettingsDto) {
    for (const item of dto.items) {
      await this.prisma.formula_weighing_job_settings.upsert({
        where: { job_code: item.jobCode },
        create: {
          job_code: item.jobCode,
          job_name: item.jobName ?? item.jobCode,
          requires_weighing: item.requiresWeighing,
        },
        update: {
          job_name: item.jobName ?? item.jobCode,
          requires_weighing: item.requiresWeighing,
        },
      });
    }

    return this.getJobSettings();
  }

  async getPopularUnits(limit = 30): Promise<string[]> {
    const take = Math.min(Math.max(limit, 1), 50);
    const counts = new Map<string, number>();

    const usageRows = await this.prisma.batch_material_usage.groupBy({
      by: ["unit"],
      _count: { id: true },
    });
    for (const row of usageRows) {
      const unit = row.unit?.trim();
      if (!isValidWeighingUnit(unit)) continue;
      counts.set(unit!, (counts.get(unit!) ?? 0) + row._count.id);
    }

    const materialUnits = await this.prisma.material.findMany({
      select: { Mat_Unit: true },
      distinct: ["Mat_Unit"],
      take: 50,
    });
    for (const row of materialUnits) {
      const unit = row.Mat_Unit?.trim();
      if (!isValidWeighingUnit(unit)) continue;
      counts.set(unit!, (counts.get(unit!) ?? 0) + 1);
    }

    const merged = new Map<string, number>();
    for (const [unit, count] of counts.entries()) {
      const canonical = canonicalWeighingUnit(unit);
      if (!isValidWeighingUnit(canonical)) continue;
      merged.set(canonical, (merged.get(canonical) ?? 0) + count);
    }

    return [...merged.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"))
      .slice(0, take)
      .map(([unit]) => unit);
  }

  async searchMaterials(query?: string, limit = 30): Promise<MaterialSearchResult[]> {
    const trimmed = query?.trim();
    const take = Math.min(Math.max(limit, 1), 50);

    const rows = await this.prisma.material.findMany({
      where: trimmed
        ? {
            OR: [
              { Mat_Id: { contains: trimmed } },
              { Mat_Name: { contains: trimmed } },
            ],
          }
        : undefined,
      orderBy: { Mat_Name: "asc" },
      take,
    });

    return rows.map((row) => ({
      code: row.Mat_Id,
      name: row.Mat_Name,
      unit: row.Mat_Unit,
    }));
  }

  async createRecord(dto: CreateWeighingRecordDto) {
    const workPlan = await this.batchResolver.resolveWorkPlan(dto.jobId);
    if (!(await this.isJobWeighingRequired(workPlan.job_code))) {
      throw new NotFoundException(
        `Job ${dto.jobId} (${workPlan.job_code}) is not configured for formula weighing`,
      );
    }

    const batch = await this.batchResolver.resolveOrCreateBatch(dto.jobId);
    const weighedById = await this.userResolver.resolveUserId(dto.weighedBy);
    const nextBatchCount = normalizeBatchCount(dto.batchCount);

    if (
      batch.status === "producing" ||
      batch.status === "completed"
    ) {
      const currentBatchCount = normalizeBatchCount(batch.batch_count);
      if (nextBatchCount !== currentBatchCount) {
        throw new BadRequestException(
          "ไม่สามารถเปลี่ยนจำนวนแบทช์ได้หลังยืนยันสูตรแล้ว",
        );
      }
    } else if (nextBatchCount !== normalizeBatchCount(batch.batch_count)) {
      await this.prisma.production_batches.update({
        where: { id: batch.id },
        data: { batch_count: nextBatchCount },
      });
    }

    const saved = [];
    for (const ingredient of dto.ingredients) {
      const measuredWeightRaw = ingredient.measuredWeight?.trim() ?? "";
      const parsedWeight = measuredWeightRaw
        ? parseFloat(measuredWeightRaw.replace(/,/g, ""))
        : NaN;
      const hasWeight =
        measuredWeightRaw !== "" &&
        Number.isFinite(parsedWeight) &&
        parsedWeight > 0;
      const hasPlannedQty = !!ingredient.quantity?.trim();
      const isManual = ingredient.isManual === true;
      const note = ingredient.note?.trim().slice(0, 500) || null;
      const priceSource =
        ingredient.unitPriceSource === "api" || ingredient.unitPriceSource === "manual"
          ? ingredient.unitPriceSource
          : null;
      const hasNote = note != null;

      if (!hasWeight && !isManual && !hasPlannedQty && !hasNote) {
        continue;
      }

      const materialId = await this.materialResolver.resolveOrCreateMaterialId(
        ingredient.code,
        ingredient.name,
        ingredient.unit,
      );
      const actualQty = hasWeight ? parsedWeight : 0;
      const plannedQty = parseFloat(ingredient.quantity) || 0;
      const trimmedUnit = canonicalWeighingUnit(ingredient.unit);
      if (hasWeight && !isValidWeighingUnit(trimmedUnit)) {
        throw new BadRequestException(
          `หน่วย "${ingredient.unit?.trim() || "(ว่าง)"}" ไม่ถูกต้อง — กรุณาเลือกหน่วยจากรายการ`,
        );
      }
      const weighingUnit = trimmedUnit.slice(0, 16);

      const material = await this.prisma.materials.findUnique({
        where: { id: materialId },
      });

      const existing = await this.prisma.batch_material_usage.findFirst({
        where: { batch_id: batch.id, material_id: materialId },
      });

      const unitPrice = resolveMaterialUnitPrice(
        ingredient.unitPrice,
        existing?.unit_price,
        material?.price,
      );

      const row = existing
        ? await this.prisma.batch_material_usage.update({
            where: { id: existing.id },
            data: {
              planned_qty: plannedQty,
              actual_qty: actualQty,
              unit: weighingUnit,
              unit_price: unitPrice,
              note,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              price_source: priceSource ?? (existing as any).price_source,
              weighed_by: hasWeight ? weighedById : existing.weighed_by,
              weighed_at: hasWeight ? nowUtc() : existing.weighed_at,
            },
          })
        : await this.prisma.batch_material_usage.create({
            data: {
              batch_id: batch.id,
              material_id: materialId,
              planned_qty: plannedQty,
              actual_qty: actualQty,
              unit: weighingUnit,
              unit_price: unitPrice,
              note,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              price_source: priceSource as any,
              weighed_by: hasWeight ? weighedById : null,
              weighed_at: hasWeight ? nowUtc() : null,
            },
          });

      saved.push(row);
    }

    return this.publishRecord(dto.jobId);
  }

  async removeManualIngredient(jobId: string, materialCode: string) {
    const workPlan = await this.batchResolver.resolveWorkPlan(jobId);
    const bomRows = await this.prisma.fg_bom.findMany({
      where: { FG_Code: workPlan.job_code },
      select: { Raw_Code: true },
    });

    if (bomRows.some((row) => row.Raw_Code === materialCode)) {
      throw new BadRequestException("Cannot remove BOM ingredient");
    }

    const batch = await this.batchResolver.findLatestBatch(workPlan.id);
    if (!batch) {
      return { jobId, materialCode, removed: false };
    }

    const materialId = await this.materialResolver.resolveMaterialId(materialCode);
    const result = await this.prisma.batch_material_usage.deleteMany({
      where: { batch_id: batch.id, material_id: materialId },
    });

    if (result.count > 0) {
      await this.publishRecord(jobId);
    }

    return { jobId, materialCode, removed: result.count > 0 };
  }

  async verify(jobId: string, verifiedBy: string) {
    const batch = await this.batchResolver.resolveOrCreateBatch(jobId);
    await this.userResolver.resolveUserId(verifiedBy);

    await this.prisma.batch_material_usage.updateMany({
      where: { batch_id: batch.id },
      data: { weighed_at: nowUtc() },
    });

    await this.prisma.production_batches.update({
      where: { id: batch.id },
      data: { status: "producing" },
    });

    return this.publishRecord(jobId);
  }

  async getByJobId(jobId: string) {
    const { workPlan, batch } =
      await this.batchResolver.ensureBatchReadyForProduction(jobId);

    if (!(await this.isJobWeighingRequired(workPlan.job_code))) {
      throw new NotFoundException(
        `Job ${jobId} (${workPlan.job_code}) is not configured for formula weighing`,
      );
    }
    const batchCount = normalizeBatchCount(batch?.batch_count);
    const [ingredients, hasFormula] = await Promise.all([
      this.bomService.getIngredientsForWorkPlan(
        workPlan.job_code,
        batch?.id,
        batchCount,
      ),
      this.bomService.hasFormula(workPlan.job_code),
    ]);

    let weighedBy: string | undefined;
    if (batch) {
      const usage = await this.prisma.batch_material_usage.findFirst({
        where: { batch_id: batch.id },
        include: { users: true },
        orderBy: { weighed_at: "desc" },
      });
      weighedBy = usage?.users?.name ?? undefined;
    }

    const verifiedAt =
      batch?.status === "producing" ? toIsoUtc(batch.updated_at) : null;

    return {
      jobId,
      jobCode: workPlan.job_code,
      batchId: batch?.id ?? null,
      batchCount,
      productName: workPlan.job_name ?? workPlan.job_code,
      ingredients,
      hasFormula,
      weighedBy,
      verifiedAt,
      verifiedAtBangkok: batch?.status === "producing"
        ? formatDateTimeBangkok(batch.updated_at)
        : undefined,
    };
  }

  streamRecord(jobId: string): Observable<SseMessage> {
    const initial$ = defer(() => from(this.getByJobId(jobId))).pipe(
      map((record): SseMessage => ({ data: { type: "record", payload: record } })),
      catchError(() => of<SseMessage>({ data: { type: "ping" } })),
    );

    const updates$ = this.events.onJob(jobId).pipe(
      map((record): SseMessage => ({ data: { type: "record", payload: record } })),
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

  private async publishRecord(jobId: string) {
    const record = await this.getByJobId(jobId);
    this.events.emit(jobId, record);
    return record;
  }
}
