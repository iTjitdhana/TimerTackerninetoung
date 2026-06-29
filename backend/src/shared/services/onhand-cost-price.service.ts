import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type OnhandCostPriceStatus = "found" | "fallback" | "default" | "no_data";

export interface OnhandCostPriceResult {
  unitCost: number | null;
  status: OnhandCostPriceStatus;
  fallbackReason?: string;
  sessionName?: string;
}

interface OnhandCostPriceItem {
  product_code: string;
  unit_cost: number | null;
  status: OnhandCostPriceStatus;
  fallback_reason?: string;
  session_name?: string;
}

interface OnhandCostPriceResponse {
  success: boolean;
  items?: OnhandCostPriceItem[];
  error?: string;
}

const CHUNK_SIZE = 20;
const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class OnhandCostPriceService {
  private readonly logger = new Logger(OnhandCostPriceService.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    const url = this.config.get<string>("ONHAND_COST_PRICE_API_URL")?.trim();
    const token = this.config.get<string>("ONHAND_COST_PRICE_API_TOKEN")?.trim();
    return Boolean(url && token);
  }

  async resolvePrices(codes: string[]): Promise<Map<string, OnhandCostPriceResult>> {
    const result = new Map<string, OnhandCostPriceResult>();
    if (!this.isEnabled()) {
      return result;
    }

    const uniqueCodes = [
      ...new Set(
        codes
          .map((code) => code?.trim())
          .filter((code): code is string => Boolean(code)),
      ),
    ];
    if (uniqueCodes.length === 0) {
      return result;
    }

    const apiUrl = this.config.get<string>("ONHAND_COST_PRICE_API_URL")!.trim();
    const token = this.config.get<string>("ONHAND_COST_PRICE_API_TOKEN")!.trim();

    for (let i = 0; i < uniqueCodes.length; i += CHUNK_SIZE) {
      const chunk = uniqueCodes.slice(i, i + CHUNK_SIZE);
      const chunkResult = await this.fetchChunk(apiUrl, token, chunk);
      for (const [code, entry] of chunkResult.entries()) {
        result.set(code, entry);
      }
    }

    return result;
  }

  private async fetchChunk(
    apiUrl: string,
    token: string,
    productCodes: string[],
  ): Promise<Map<string, OnhandCostPriceResult>> {
    const result = new Map<string, OnhandCostPriceResult>();

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
          body: JSON.stringify({ product_codes: productCodes }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        this.logger.warn(
          `Onhand cost price API returned HTTP ${response.status} for ${productCodes.length} codes`,
        );
        return result;
      }

      const data = (await response.json()) as OnhandCostPriceResponse;
      if (!data.success || !Array.isArray(data.items)) {
        this.logger.warn(
          `Onhand cost price API error: ${data.error ?? "unknown error"}`,
        );
        return result;
      }

      for (const item of data.items) {
        const code = item.product_code?.trim();
        if (!code) continue;

        result.set(code, {
          unitCost:
            item.unit_cost != null && Number.isFinite(item.unit_cost)
              ? item.unit_cost
              : null,
          status: item.status,
          fallbackReason: item.fallback_reason,
          sessionName: item.session_name,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Onhand cost price API request failed: ${message}`);
    }

    return result;
  }
}
