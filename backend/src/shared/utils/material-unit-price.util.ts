const UNIT_PRICE_DECIMALS = 2;

export function roundUnitPrice(value: number): number {
  const factor = 10 ** UNIT_PRICE_DECIMALS;
  return Math.round(value * factor) / factor;
}

export function resolveMaterialUnitPrice(
  userInput: number | undefined,
  existingPrice: { toNumber?: () => number } | number | string | null | undefined,
  masterPrice: { toNumber?: () => number } | number | string | null | undefined,
): number {
  if (userInput != null && Number.isFinite(userInput) && userInput >= 0) {
    return roundUnitPrice(userInput);
  }
  if (existingPrice != null) {
    const existing = Number(existingPrice);
    if (Number.isFinite(existing)) return roundUnitPrice(existing);
  }
  const master = Number(masterPrice ?? 0);
  return Number.isFinite(master) ? roundUnitPrice(master) : 0;
}

export function computeLineMaterialCost(qty: number, unitPrice: number): number {
  return qty * unitPrice;
}
