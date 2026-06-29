function formatDisplayNumber(value: string): string {
  const n = Number.parseFloat(value.replace(/,/g, ""));
  if (!Number.isFinite(n)) return value.trim();
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

function scaleBaseQuantity(base: string, batchCount: number): string {
  const n = Number.parseFloat(base.replace(/,/g, ""));
  if (!Number.isFinite(n)) return base.trim();
  return formatDisplayNumber(String(n * batchCount));
}

export function applyBatchCountToBomLines(
  lines: Array<{
    plannedQuantity: string
    baseQuantity?: string
    isManual?: boolean
  }>,
  batchCount: number,
): Array<{ plannedQuantity: string; baseQuantity?: string; isManual?: boolean }> {
  const count = Math.max(1, Math.floor(batchCount) || 1);
  return lines.map((line) => {
    if (line.isManual || !line.baseQuantity?.trim()) {
      return line;
    }
    return {
      ...line,
      plannedQuantity: scaleBaseQuantity(line.baseQuantity, count),
    };
  });
}

export function formatPlannedQuantityDisplay(options: {
  total: string
  base?: string
  unit?: string
  batchCount: number
  isManual?: boolean
}): { main: string; sub?: string } {
  const unit = options.unit?.trim() ?? "";
  const unitSuffix = unit ? ` ${unit}` : "";
  const total = formatDisplayNumber(options.total);
  const main = `${total}${unitSuffix}`.trim();

  if (
    options.isManual ||
    options.batchCount <= 1 ||
    !options.base?.trim()
  ) {
    return { main };
  }

  const base = formatDisplayNumber(options.base);
  const sub = `${base}${unitSuffix} × ${options.batchCount}`.trim();
  return { main, sub };
}

export function normalizeBatchCountInput(value: string | number): number {
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}
