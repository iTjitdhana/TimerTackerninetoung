export function formatMinutesAsThaiDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 นาที"

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.floor(minutes % 60)

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} ชม. ${remainingMinutes} นาที`
  }
  if (hours > 0) return `${hours} ชม.`
  return `${remainingMinutes} นาที`
}

export function parseDurationClockToSeconds(value?: string): number {
  if (!value?.trim()) return 0

  const parts = value.trim().split(":").map((part) => Number.parseInt(part, 10) || 0)
  if (parts.length >= 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 3600 + parts[1] * 60
  }
  return 0
}
