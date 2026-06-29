import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BomFormula, BomSourceProvider } from "./bom-source.interface";
import { DbBomSourceProvider } from "./db-bom-source.provider";

interface BomStandardComponent {
  rm_code: string;
  rm_name?: string;
  qty: number;
  unit: string;
  line_order?: number;
}

interface BomStandardItem {
  product_code: string;
  product_name?: string;
  found: boolean;
  batch_size?: number;
  batch_unit?: string;
  components?: BomStandardComponent[];
  error?: string;
}

interface BomStandardResponse {
  success: boolean;
  items?: BomStandardItem[];
  error?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 10_000;

@Injectable()
export class HttpBomSourceProvider implements BomSourceProvider {
  private readonly logger = new Logger(HttpBomSourceProvider.name);
  private readonly cache = new Map<string, { expires: number; value: BomFormula | null }>();

  constructor(
    private readonly config: ConfigService,
    private readonly dbProvider: DbBomSourceProvider,
  ) {}

  private isEnabled(): boolean {
    const url = this.config.get<string>("BOM_STANDARD_API_URL")?.trim();
    const token = this.config.get<string>("BOM_STANDARD_API_TOKEN")?.trim();
    return Boolean(url && token);
  }

  async getFormula(fgCode: string): Promise<BomFormula | null> {
    const code = fgCode?.trim();
    if (!code) return null;

    if (!this.isEnabled()) {
      return this.dbProvider.getFormula(code);
    }

    const cached = this.cache.get(code);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    const value = await this.fetchFormula(code);
    this.cache.set(code, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  }

  private async fetchFormula(code: string): Promise<BomFormula | null> {
    const apiUrl = this.config.get<string>("BOM_STANDARD_API_URL")!.trim();
    const token = this.config.get<string>("BOM_STANDARD_API_TOKEN")!.trim();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify({ product_code: code }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        this.logger.warn(
          `BOM standard API returned HTTP ${response.status} for "${code}" — falling back to DB`,
        );
        return this.dbProvider.getFormula(code);
      }

      const data = (await response.json()) as BomStandardResponse;
      if (!data.success || !Array.isArray(data.items)) {
        this.logger.warn(
          `BOM standard API error for "${code}": ${data.error ?? "unknown error"} — falling back to DB`,
        );
        return this.dbProvider.getFormula(code);
      }

      const item = data.items.find((entry) => entry.product_code?.trim() === code);
      if (!item || !item.found || !Array.isArray(item.components)) {
        return null;
      }

      return {
        fgCode: code,
        productName: item.product_name,
        batchSize: item.batch_size,
        batchUnit: item.batch_unit,
        components: item.components
          .filter((component) => component.rm_code?.trim())
          .map((component) => ({
            rawCode: component.rm_code.trim(),
            rawName: component.rm_name,
            rawQty:
              component.qty != null && Number.isFinite(component.qty)
                ? component.qty
                : 0,
            rawUnit: component.unit ?? "",
            lineOrder: component.line_order,
          })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `BOM standard API request failed for "${code}": ${message} — falling back to DB`,
      );
      return this.dbProvider.getFormula(code);
    }
  }
}
