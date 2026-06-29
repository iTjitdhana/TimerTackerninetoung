import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { createPool, Pool, RowDataPacket } from "mysql2/promise";

export interface ExternalProcessTemplate {
  id: number;
  process_number: number;
  process_description: string;
}

interface TemplateRow extends RowDataPacket {
  id: number;
  process_number: number;
  process_description: string;
}

@Injectable()
export class ProcessTemplatesReaderService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProcessTemplatesReaderService.name);
  private pool: Pool | null = null;

  onModuleInit() {
    const databaseUrl = process.env.TEMPLATES_DATABASE_URL;
    const databaseName = process.env.TEMPLATES_DB_NAME;

    if (!databaseUrl || !databaseName) {
      return;
    }

    this.pool = createPool({
      uri: databaseUrl,
      connectionLimit: 5,
      waitForConnections: true,
    });

    this.logger.log(
      `Using external process templates database "${databaseName}"`,
    );
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  async findTemplates(productCode: string): Promise<ExternalProcessTemplate[]> {
    if (!this.pool) {
      return [];
    }

    const latest = await this.queryLatestView(productCode);
    if (latest.length > 0) {
      return latest;
    }

    return this.queryLatestVersionTemplates(productCode);
  }

  private async queryLatestView(
    productCode: string,
  ): Promise<ExternalProcessTemplate[]> {
    if (!this.pool) {
      return [];
    }

    try {
      const [rows] = await this.pool.query<TemplateRow[]>(
        `SELECT id, process_number, process_description
         FROM v_latest_process_templates
         WHERE product_code = ?
           AND is_active = 1
         ORDER BY process_number ASC`,
        [productCode],
      );
      return rows;
    } catch {
      return [];
    }
  }

  private async queryLatestVersionTemplates(
    productCode: string,
  ): Promise<ExternalProcessTemplate[]> {
    if (!this.pool) {
      return [];
    }

    const [versionRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT MAX(version) AS version
       FROM process_templates
       WHERE product_code = ?
         AND is_active = 1`,
      [productCode],
    );

    const version = versionRows[0]?.version;
    if (version == null) {
      return [];
    }

    const [rows] = await this.pool.query<TemplateRow[]>(
      `SELECT id, process_number, process_description
       FROM process_templates
       WHERE product_code = ?
         AND version = ?
         AND is_active = 1
       ORDER BY process_number ASC`,
      [productCode, version],
    );

    return rows;
  }
}
