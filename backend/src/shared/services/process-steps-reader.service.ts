import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { createPool, Pool, RowDataPacket } from "mysql2/promise";
import { PrismaService } from "../prisma/prisma.module";

export interface ProcessStepRecord {
  process_number: number;
  process_description: string;
}

interface ProcessStepRow extends RowDataPacket {
  process_number: number;
  process_description: string;
}

@Injectable()
export class ProcessStepsReaderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessStepsReaderService.name);
  private pool: Pool | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const stepsDatabaseUrl = process.env.STEPS_DATABASE_URL;
    const mainDatabaseName = process.env.DB_NAME;
    const stepsDatabaseName = process.env.STEPS_DB_NAME;

    if (
      !stepsDatabaseUrl ||
      !stepsDatabaseName ||
      stepsDatabaseName === mainDatabaseName
    ) {
      return;
    }

    this.pool = createPool({
      uri: stepsDatabaseUrl,
      connectionLimit: 5,
      waitForConnections: true,
    });

    this.logger.log(
      `Using external process steps database "${stepsDatabaseName}"`,
    );
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  async findSteps(
    jobCode: string,
    jobName?: string | null,
  ): Promise<ProcessStepRecord[]> {
    if (this.pool) {
      const byCode = await this.queryExternalSteps(jobCode);
      if (byCode.length > 0) {
        return byCode;
      }

      if (jobName) {
        return this.queryExternalStepsByName(jobName);
      }

      return [];
    }

    return this.queryMainDatabaseSteps(jobCode, jobName);
  }

  private async queryMainDatabaseSteps(
    jobCode: string,
    jobName?: string | null,
  ): Promise<ProcessStepRecord[]> {
    const byCode = await this.queryPrismaSteps({ job_code: jobCode });
    if (byCode.length > 0) {
      return byCode;
    }

    if (!jobName) {
      return [];
    }

    return this.queryPrismaSteps({ job_name: jobName });
  }

  private async queryPrismaSteps(
    where: { job_code: string } | { job_name: string },
  ): Promise<ProcessStepRecord[]> {
    const latest = await this.prisma.process_steps.findFirst({
      where,
      orderBy: [{ date_recorded: "desc" }, { process_number: "desc" }],
      select: { date_recorded: true },
    });

    if (!latest) {
      return [];
    }

    const rows = await this.prisma.process_steps.findMany({
      where: {
        ...where,
        date_recorded: latest.date_recorded,
      },
      orderBy: { process_number: "asc" },
      select: {
        process_number: true,
        process_description: true,
      },
    });

    return rows;
  }

  private async queryExternalSteps(jobCode: string): Promise<ProcessStepRecord[]> {
    if (!this.pool) {
      return [];
    }

    const [rows] = await this.pool.query<ProcessStepRow[]>(
      `SELECT process_number, process_description
       FROM process_steps
       WHERE job_code = ?
         AND date_recorded = (
           SELECT MAX(date_recorded)
           FROM process_steps
           WHERE job_code = ?
         )
       ORDER BY process_number ASC`,
      [jobCode, jobCode],
    );

    return rows;
  }

  private async queryExternalStepsByName(
    jobName: string,
  ): Promise<ProcessStepRecord[]> {
    if (!this.pool) {
      return [];
    }

    const [rows] = await this.pool.query<ProcessStepRow[]>(
      `SELECT process_number, process_description
       FROM process_steps
       WHERE job_name = ?
         AND date_recorded = (
           SELECT MAX(date_recorded)
           FROM process_steps
           WHERE job_name = ?
         )
       ORDER BY process_number ASC`,
      [jobName, jobName],
    );

    return rows;
  }
}
