import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { HttpBomSourceProvider } from "./http-bom-source.provider";
import { DbBomSourceProvider } from "./db-bom-source.provider";
import type { BomFormula } from "./bom-source.interface";

function createProvider(
  env: Record<string, string | undefined>,
  dbFormula: BomFormula | null = { fgCode: "FG001", components: [{ rawCode: "DB001", rawQty: 1, rawUnit: "กก." }] },
) {
  const config = { get: (key: string) => env[key] } as ConfigService;
  const dbProvider = {
    getFormula: vi.fn().mockResolvedValue(dbFormula),
  } as unknown as DbBomSourceProvider;
  return {
    provider: new HttpBomSourceProvider(config, dbProvider),
    dbProvider,
  };
}

const enabledEnv = {
  BOM_STANDARD_API_URL: "http://example.com/api/bom_standard.php",
  BOM_STANDARD_API_TOKEN: "test-token",
};

describe("HttpBomSourceProvider", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("falls back to DB when env not configured", async () => {
    const { provider, dbProvider } = createProvider({});
    const formula = await provider.getFormula("FG001");
    expect(dbProvider.getFormula).toHaveBeenCalledWith("FG001");
    expect(formula?.components[0]?.rawCode).toBe("DB001");
  });

  it("maps a found formula from API", async () => {
    const { provider } = createProvider(enabledEnv);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        items: [
          {
            product_code: "301001",
            product_name: "ข้าวผัดกุ้ง",
            found: true,
            batch_size: 10,
            batch_unit: "ถาด",
            components: [
              { rm_code: "105001", rm_name: "กุ้ง", qty: 2.5, unit: "กก.", line_order: 1 },
              { rm_code: "201010", rm_name: "ข้าวสวย", qty: 8, unit: "กก.", line_order: 2 },
            ],
          },
        ],
      }),
    });

    const formula = await provider.getFormula("301001");
    expect(formula).toEqual({
      fgCode: "301001",
      productName: "ข้าวผัดกุ้ง",
      batchSize: 10,
      batchUnit: "ถาด",
      components: [
        { rawCode: "105001", rawName: "กุ้ง", rawQty: 2.5, rawUnit: "กก.", lineOrder: 1 },
        { rawCode: "201010", rawName: "ข้าวสวย", rawQty: 8, rawUnit: "กก.", lineOrder: 2 },
      ],
    });
  });

  it("returns null when found is false (no DB fallback)", async () => {
    const { provider, dbProvider } = createProvider(enabledEnv);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        items: [{ product_code: "999999", found: false, error: "not found" }],
      }),
    });

    await expect(provider.getFormula("999999")).resolves.toBeNull();
    expect(dbProvider.getFormula).not.toHaveBeenCalled();
  });

  it("falls back to DB on HTTP error", async () => {
    const { provider, dbProvider } = createProvider(enabledEnv);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const formula = await provider.getFormula("FG001");
    expect(dbProvider.getFormula).toHaveBeenCalledWith("FG001");
    expect(formula?.components[0]?.rawCode).toBe("DB001");
  });

  it("falls back to DB on network error", async () => {
    const { provider, dbProvider } = createProvider(enabledEnv);
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const formula = await provider.getFormula("FG001");
    expect(dbProvider.getFormula).toHaveBeenCalledWith("FG001");
    expect(formula?.components[0]?.rawCode).toBe("DB001");
  });

  it("caches result to avoid double fetch", async () => {
    const { provider } = createProvider(enabledEnv);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        items: [
          { product_code: "301001", found: true, components: [{ rm_code: "105001", qty: 1, unit: "กก." }] },
        ],
      }),
    });

    await provider.getFormula("301001");
    await provider.getFormula("301001");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
