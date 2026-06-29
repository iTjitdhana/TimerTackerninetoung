import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { production_batches, production_batches_status, work_plans } from "@prisma/client";

/** Business unit id for โรงแกง — skips staff formula verification before timer start */
export const ROGANG_BU_ID = 2;
import { PrismaService } from "../prisma/prisma.module";
import { formatDateOnly } from "../mappers/job.mapper";
import {
  ProductOutputConfig,
  resolveProductOutput,
} from "../utils/output-quantity.util";

@Injectable()
export class BatchResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mutex ในหน่วยความจำต่อ work_plan_id เพื่อ serialize การสร้าง batch
   * กัน race ที่ทำให้เกิด batch ซ้ำเมื่อมี request พร้อมกัน (เช่น ตวงสูตร + สรุปผล)
   * หมายเหตุ: ครอบเฉพาะ instance เดียว — ถ้า deploy หลาย instance ควรเพิ่ม
   * unique constraint บน production_batches(work_plan_id) ที่ระดับ DB ด้วย
   */
  private readonly batchLocks = new Map<number, Promise<unknown>>();

  private withBatchLock<T>(key: number, fn: () => Promise<T>): Promise<T> {
    const previous = this.batchLocks.get(key) ?? Promise.resolve();
    const result = previous.then(fn, fn);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.batchLocks.set(key, tail);
    void tail.then(() => {
      if (this.batchLocks.get(key) === tail) {
        this.batchLocks.delete(key);
      }
    });
    return result;
  }

  parseWorkPlanId(jobId: string): number {
    const id = Number(jobId);
    if (Number.isNaN(id)) {
      throw new BadRequestException(`Invalid jobId "${jobId}"`);
    }
    return id;
  }

  async resolveWorkPlan(jobId: string): Promise<work_plans> {
    const workPlanId = this.parseWorkPlanId(jobId);
    const workPlan = await this.prisma.work_plans.findUnique({
      where: { id: workPlanId },
    });

    if (!workPlan) {
      throw new NotFoundException(`Work plan ${jobId} not found`);
    }

    return workPlan;
  }

  async findLatestBatch(workPlanId: number): Promise<production_batches | null> {
    return this.prisma.production_batches.findFirst({
      where: { work_plan_id: workPlanId },
      orderBy: { id: "desc" },
    });
  }

  async resolveProductOutputConfig(
    jobCode: string,
    productCode?: string | null,
    jobName?: string | null,
  ): Promise<ProductOutputConfig> {
    const fg = await this.resolveFgRecord(jobCode, productCode, jobName);

    if (fg) {
      return resolveProductOutput(fg, undefined, { fgCode: fg.FG_Code });
    }

    const product = await this.prisma.products.findUnique({
      where: { product_code: (productCode ?? jobCode).trim().slice(0, 20) },
    });

    return resolveProductOutput(null, product?.unit, { fgCode: null });
  }

  private normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  private buildFgNameSearchTerms(jobName: string | null | undefined): string[] {
    if (!jobName?.trim()) return [];

    const normalized = this.normalizeWhitespace(jobName);
    const withoutParens = this.normalizeWhitespace(
      normalized.replace(/\s*\([^)]*\)\s*/g, " "),
    );

    const terms = [
      normalized,
      withoutParens,
      withoutParens.split("(")[0]?.trim(),
      normalized.slice(0, 40),
      normalized.slice(0, 30),
      normalized.slice(0, 20),
      withoutParens.slice(0, 30),
    ].filter((term): term is string => Boolean(term && term.length >= 4));

    return [...new Set(terms)];
  }

  private pickBestFgByName<T extends { FG_Name: string | null }>(
    candidates: T[],
    term: string,
  ): T | null {
    if (candidates.length === 0) return null;

    const normalizedTerm = this.normalizeWhitespace(term);
    const score = (name: string | null): number => {
      const normalized = this.normalizeWhitespace(name ?? "");
      if (normalized === normalizedTerm) return 0;
      if (normalized.startsWith(normalizedTerm)) return 1;
      return 2;
    };

    return candidates.reduce((best, current) => {
      const bestScore = score(best.FG_Name);
      const currentScore = score(current.FG_Name);
      if (currentScore !== bestScore) {
        return currentScore < bestScore ? current : best;
      }
      // คะแนนเท่ากัน — เลือกชื่อที่สั้นกว่า (เฉพาะเจาะจงกว่า)
      const bestLen = this.normalizeWhitespace(best.FG_Name ?? "").length;
      const currentLen = this.normalizeWhitespace(current.FG_Name ?? "").length;
      return currentLen < bestLen ? current : best;
    });
  }

  private extractNumericFgCodes(...values: Array<string | null | undefined>): string[] {
    const codes = new Set<string>();
    for (const value of values) {
      if (!value) continue;
      const matches = value.match(/\d{4,}/g);
      if (!matches) continue;
      for (const match of matches) {
        codes.add(match.slice(0, 16));
      }
    }
    return [...codes];
  }

  private async resolveFgRecord(
    jobCode: string,
    productCode?: string | null,
    jobName?: string | null,
  ) {
    const candidates = [
      jobCode.trim(),
      productCode?.trim(),
      jobCode.trim().slice(0, 16),
      jobCode.trim().slice(0, 11),
      productCode?.trim().slice(0, 16),
      productCode?.trim().slice(0, 11),
      ...this.extractNumericFgCodes(jobCode, productCode, jobName),
    ].filter((code): code is string => Boolean(code));

    const uniqueCandidates = [...new Set(candidates)];

    for (const code of uniqueCandidates) {
      const fg = await this.prisma.fg.findUnique({
        where: { FG_Code: code },
      });
      if (fg) return fg;
    }

    const bomRow = await this.prisma.fg_bom.findFirst({
      where: { FG_Code: { in: uniqueCandidates } },
      select: { FG_Code: true },
    });
    if (bomRow) {
      return this.prisma.fg.findUnique({
        where: { FG_Code: bomRow.FG_Code },
      });
    }

    const fgFromCandidates = await this.prisma.fg.findFirst({
      where: { FG_Code: { in: uniqueCandidates } },
    });
    if (fgFromCandidates) return fgFromCandidates;

    const trimmedName = jobName?.trim();
    if (trimmedName) {
      const fgByExactName = await this.prisma.fg.findFirst({
        where: { FG_Name: this.normalizeWhitespace(trimmedName) },
      });
      if (fgByExactName) return fgByExactName;

      for (const term of this.buildFgNameSearchTerms(trimmedName)) {
        // หยิบหลาย candidate แล้วเลือก match ที่ "เฉพาะเจาะจงที่สุด" แบบ deterministic
        // (prefix match ก่อน, แล้วชื่อที่สั้นที่สุด) แทนการใช้ id asc ที่อาจได้ FG ผิด
        const candidates = await this.prisma.fg.findMany({
          where: { FG_Name: { contains: term } },
          orderBy: { id: "asc" },
          take: 25,
        });
        const best = this.pickBestFgByName(candidates, term);
        if (best) return best;
      }
    }

    return null;
  }

  async ensureBatchReadyForProduction(jobId: string): Promise<{
    workPlan: work_plans;
    batch: production_batches;
  }> {
    const workPlan = await this.resolveWorkPlan(jobId);
    let batch = await this.resolveOrCreateBatch(jobId);

    if (
      workPlan.bu_id === ROGANG_BU_ID &&
      batch.status !== production_batches_status.producing
    ) {
      batch = await this.prisma.production_batches.update({
        where: { id: batch.id },
        data: { status: production_batches_status.producing },
      });
    }

    return { workPlan, batch };
  }

  async resolveOrCreateBatch(jobId: string): Promise<production_batches> {
    const workPlan = await this.resolveWorkPlan(jobId);
    return this.withBatchLock(workPlan.id, () =>
      this.resolveOrCreateBatchLocked(workPlan),
    );
  }

  private async resolveOrCreateBatchLocked(
    workPlan: work_plans,
  ): Promise<production_batches> {
    const existing = await this.findLatestBatch(workPlan.id);
    if (existing) {
      return existing;
    }

    const productCode = workPlan.job_code.slice(0, 20);
    let product = await this.prisma.products.findUnique({
      where: { product_code: productCode },
    });

    if (!product) {
      try {
        product = await this.prisma.products.create({
          data: {
            product_code: productCode,
            product_name: (workPlan.job_name ?? workPlan.job_code).slice(0, 100),
            product_type: "FG",
            is_active: true,
          },
        });
      } catch {
        product = await this.prisma.products.findUnique({
          where: { product_code: productCode },
        });
      }
    }

    if (!product) {
      throw new BadRequestException(
        `Product "${workPlan.job_code}" not found in products — cannot create production batch`,
      );
    }

    const datePart = formatDateOnly(workPlan.production_date).replace(/-/g, "");
    return this.prisma.production_batches.create({
      data: {
        work_plan_id: workPlan.id,
        batch_code: `TT-${workPlan.id}-${datePart}`,
        product_code: productCode,
        batch_count: 1,
        planned_qty: 0,
        start_time: new Date(),
        status: "preparing",
      },
    });
  }
}
