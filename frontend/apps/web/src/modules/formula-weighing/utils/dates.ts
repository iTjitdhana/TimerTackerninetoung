const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
]

const THAI_WEEKDAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."]

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return startOfLocalDay(next)
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getTomorrow(from = new Date()): Date {
  return addDays(startOfLocalDay(from), 1)
}

export function buildDateRange(center: Date, before: number, after: number): Date[] {
  const dates: Date[] = []
  for (let offset = -before; offset <= after; offset += 1) {
    dates.push(addDays(center, offset))
  }
  return dates
}

export function getRelativeDateLabel(date: Date, today = startOfLocalDay(new Date())): string | null {
  const diffDays = Math.round(
    (startOfLocalDay(date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diffDays === -1) return "เมื่อวาน"
  if (diffDays === 0) return "วันนี้"
  if (diffDays === 1) return "พรุ่งนี้"
  return null
}

export function formatDateChip(date: Date) {
  return {
    day: date.getDate(),
    month: THAI_MONTHS_SHORT[date.getMonth()] ?? "",
    weekday: THAI_WEEKDAYS_SHORT[date.getDay()] ?? "",
  }
}

export function formatSelectedDateHeading(date: Date, today = startOfLocalDay(new Date())) {
  const relative = getRelativeDateLabel(date, today)
  const { day, month, weekday } = formatDateChip(date)
  const base = `${weekday} ${day} ${month}`
  return relative ? `${relative} (${base})` : base
}
