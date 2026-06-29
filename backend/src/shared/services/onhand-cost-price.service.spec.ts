import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { OnhandCostPriceService } from "./onhand-cost-price.service";

function createService(env: Record<string, string | undefined>) {
  const config = {
    get: (key: string) => env[key],
  } as ConfigService;
  return new OnhandCostPriceService(config);
}

describe("OnhandCostPriceService", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns empty map when env is not configured", async () => {
    const service = createService({});
    expect(service.isEnabled()).toBe(false);
    await expect(service.resolvePrices(["RM105001"])).resolves.toEqual(new Map());
  });

  it("fetches and maps successful response", async () => {
    const service = createService({
      ONHAND_COST_PRICE_API_URL: "http://example.com/api/cost_price.php",
      ONHAND_COST_PRICE_API_TOKEN: "test-token",
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        items: [
          {
            product_code: "RM105001",
            unit_cost: 85.5,
            status: "found",
            session_name: "มิถุนายน 2569",
          },
        ],
      }),
    });

    const result = await service.resolvePrices(["RM105001"]);
    expect(result.get("RM105001")).toEqual({
      unitCost: 85.5,
      status: "found",
      fallbackReason: undefined,
      sessionName: "มิถุนายน 2569",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://example.com/api/cost_price.php",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
        body: JSON.stringify({ product_codes: ["RM105001"] }),
      }),
    );
  });

  it("chunks requests when more than 20 codes", async () => {
    const service = createService({
      ONHAND_COST_PRICE_API_URL: "http://example.com/api/cost_price.php",
      ONHAND_COST_PRICE_API_TOKEN: "test-token",
    });

    const codes = Array.from({ length: 25 }, (_, i) => `RM${String(i).padStart(6, "0")}`);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, items: [] }),
    });

    await service.resolvePrices(codes);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("returns empty map on HTTP error", async () => {
    const service = createService({
      ONHAND_COST_PRICE_API_URL: "http://example.com/api/cost_price.php",
      ONHAND_COST_PRICE_API_TOKEN: "test-token",
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(service.resolvePrices(["RM105001"])).resolves.toEqual(new Map());
  });

  it("dedupes product codes", async () => {
    const service = createService({
      ONHAND_COST_PRICE_API_URL: "http://example.com/api/cost_price.php",
      ONHAND_COST_PRICE_API_TOKEN: "test-token",
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, items: [] }),
    });

    await service.resolvePrices(["RM105001", "RM105001", ""]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ product_codes: ["RM105001"] }),
      }),
    );
  });
});
