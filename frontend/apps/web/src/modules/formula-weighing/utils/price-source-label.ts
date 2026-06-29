/** รูปแบบ d/m/yyyy HH:mm (เวลาไทย) เช่น 18/6/2026 15:10 */
export function formatBangkokDateTimeShort(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ""

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""

  const day = Number(pick("day"))
  const month = Number(pick("month"))
  const year = pick("year")

  return `${day}/${month}/${year} ${pick("hour")}:${pick("minute")}`
}

export function formatPriceSourceLabel(
  source: "api" | "manual",
  at?: string,
): string {
  const prefix = source === "api" ? "จาก API" : "คีย์เอง"
  if (!at) return prefix
  const when = formatBangkokDateTimeShort(at)
  return when ? `${prefix} ${when}` : prefix
}

export function nowIso(): string {
  return new Date().toISOString()
}
