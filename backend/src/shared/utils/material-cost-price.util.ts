import type {
  OnhandCostPriceResult,
  OnhandCostPriceStatus,
} from "../services/onhand-cost-price.service";
import { roundUnitPrice } from "./material-unit-price.util";

export interface MaterialUsagePriceContext {
  unitPrice: number;
  weighedBy: number | null;
}

export interface ResolvedIngredientUnitPrice {
  unitPrice: number;
  unitPriceStatus?: OnhandCostPriceStatus;
  unitPriceFallbackReason?: string;
}

function hasOnhandPrice(onhand?: OnhandCostPriceResult): boolean {
  if (!onhand) return false;
  if (
    onhand.status !== "found" &&
    onhand.status !== "fallback" &&
    onhand.status !== "default"
  ) {
    return false;
  }
  return onhand.unitCost != null && Number.isFinite(onhand.unitCost);
}

export function resolveIngredientUnitPrice(
  usage: MaterialUsagePriceContext | undefined,
  onhand: OnhandCostPriceResult | undefined,
  masterPrice: number,
): ResolvedIngredientUnitPrice {
  if (usage?.weighedBy != null) {
    return { unitPrice: roundUnitPrice(usage.unitPrice) };
  }

  if (hasOnhandPrice(onhand)) {
    return {
      unitPrice: roundUnitPrice(onhand!.unitCost!),
      unitPriceStatus: onhand!.status,
      unitPriceFallbackReason:
        onhand!.status === "fallback" || onhand!.status === "default"
          ? onhand!.fallbackReason
          : undefined,
    };
  }

  if (usage) {
    return { unitPrice: roundUnitPrice(usage.unitPrice) };
  }

  if (onhand?.status === "no_data") {
    return {
      unitPrice: roundUnitPrice(masterPrice),
      unitPriceStatus: "no_data",
    };
  }

  return { unitPrice: roundUnitPrice(masterPrice) };
}
