import type { StepRecord } from "../types"

export interface StepDisplayTimes {
  startTime: string
  endTime: string
  duration: string
  inProgress: boolean
}

export function isEmptyClockTime(value?: string): boolean {
  if (!value) return true
  return value === "00:00" || value === "00:00:00"
}

export function isStepInProgress(record?: StepRecord): boolean {
  if (!record) return false
  return !isEmptyClockTime(record.startTime) && isEmptyClockTime(record.endTime)
}

export function formatDurationFromSeconds(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}

export function formatDurationWithSeconds(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function formatClockHm(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatClockHms(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function ensureClockWithSeconds(value: string): string {
  const parts = value.split(":")
  if (parts.length >= 3) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`
  }
  if (parts.length === 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:00`
  }
  return "00:00:00"
}

function ensureDurationWithSeconds(value: string): string {
  const parts = value.split(":")
  if (parts.length >= 3) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`
  }
  if (parts.length === 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:00`
  }
  return "00:00:00"
}

function getBangkokNowParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(now)

  return {
    hours: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minutes: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
    seconds: Number(parts.find((part) => part.type === "second")?.value ?? 0),
  }
}

function getElapsedSecondsFromClockStart(startTime: string, now = new Date()): number {
  const [startH, startM, startS = 0] = startTime.split(":").map(Number)
  const { hours: nowH, minutes: nowM, seconds: nowS } = getBangkokNowParts(now)

  const startSeconds = startH * 3600 + startM * 60 + startS
  let nowSeconds = nowH * 3600 + nowM * 60 + nowS

  if (nowSeconds < startSeconds) {
    nowSeconds += 24 * 3600
  }

  return Math.max(0, nowSeconds - startSeconds)
}

export function parseClockToBangkokDate(clockHm: string, now = new Date()): Date {
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
  const [hours, minutes, seconds = "00"] = clockHm.split(":")
  return new Date(`${dateStr}T${hours}:${minutes}:${seconds.padStart(2, "0")}+07:00`)
}

function clockToSeconds(clock: string): number | null {
  if (isEmptyClockTime(clock)) return null

  const parts = clock.split(":").map((part) => Number.parseInt(part, 10) || 0)
  if (parts.length >= 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 3600 + parts[1] * 60
  }
  return null
}

export function resolveWallClockSpanMinutesFromDisplayTimes(
  displayTimesList: Array<Pick<StepDisplayTimes, "startTime" | "endTime" | "inProgress">>,
  now = new Date(),
): number {
  let earliestStart: number | null = null
  let latestEnd: number | null = null

  for (const times of displayTimesList) {
    const startSeconds = clockToSeconds(times.startTime)
    if (startSeconds != null) {
      earliestStart =
        earliestStart == null ? startSeconds : Math.min(earliestStart, startSeconds)
    }

    if (times.inProgress) {
      const { hours, minutes, seconds } = getBangkokNowParts(now)
      const nowSeconds = hours * 3600 + minutes * 60 + seconds
      latestEnd = latestEnd == null ? nowSeconds : Math.max(latestEnd, nowSeconds)
      continue
    }

    const endSeconds = clockToSeconds(times.endTime)
    if (endSeconds != null) {
      latestEnd = latestEnd == null ? endSeconds : Math.max(latestEnd, endSeconds)
    }
  }

  if (earliestStart == null || latestEnd == null) {
    return 0
  }

  let adjustedLatestEnd = latestEnd
  if (adjustedLatestEnd < earliestStart) {
    adjustedLatestEnd += 24 * 3600
  }

  return Math.floor((adjustedLatestEnd - earliestStart) / 60)
}

export function resolveStepDisplayTimes(
  record: StepRecord | undefined,
  options?: {
    isActive?: boolean
    isRunning?: boolean
    stepStartTime?: Date | null
    now?: Date
    withSeconds?: boolean
  },
): StepDisplayTimes {
  const now = options?.now ?? new Date()
  const withSeconds = options?.withSeconds ?? false
  const emptyTime = withSeconds ? "00:00:00" : "00:00"
  const formatDuration = withSeconds ? formatDurationWithSeconds : formatDurationFromSeconds
  const formatClock = withSeconds ? formatClockHms : formatClockHm

  if (options?.isActive && options.isRunning && options.stepStartTime) {
    const elapsed = Math.floor((now.getTime() - options.stepStartTime.getTime()) / 1000)
    return {
      startTime: formatClock(options.stepStartTime),
      endTime: emptyTime,
      duration: formatDuration(elapsed),
      inProgress: true,
    }
  }

  if (!record) {
    return { startTime: emptyTime, endTime: emptyTime, duration: emptyTime, inProgress: false }
  }

  if (isStepInProgress(record)) {
    const elapsed = options?.stepStartTime
      ? Math.max(0, Math.floor((now.getTime() - options.stepStartTime.getTime()) / 1000))
      : getElapsedSecondsFromClockStart(record.startTime, now)
    const startDisplay = options?.stepStartTime
      ? formatClock(options.stepStartTime)
      : withSeconds
        ? ensureClockWithSeconds(record.startTime)
        : record.startTime

    return {
      startTime: startDisplay,
      endTime: emptyTime,
      duration: formatDuration(elapsed),
      inProgress: true,
    }
  }

  return {
    startTime: withSeconds
      ? ensureClockWithSeconds(record.startTime ?? emptyTime)
      : (record.startTime ?? emptyTime),
    endTime: withSeconds
      ? ensureClockWithSeconds(record.endTime ?? emptyTime)
      : (record.endTime ?? emptyTime),
    duration: withSeconds
      ? ensureDurationWithSeconds(record.duration ?? emptyTime)
      : (record.duration ?? emptyTime),
    inProgress: false,
  }
}

export function normalizeClockFromApi(value?: string): string {
  if (!value) return "00:00"
  const parts = value.trim().split(":")
  if (parts.length >= 3) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0").slice(0, 2)}`
  }
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`
  }
  return "00:00"
}

export function mapApiStepToRecord(step: {
  stepName: string
  startTime?: string
  endTime?: string
  duration?: string | number
  completed?: boolean
}): StepRecord {
  return {
    stepName: step.stepName,
    startTime: normalizeClockFromApi(step.startTime),
    endTime: normalizeClockFromApi(step.endTime),
    duration:
      typeof step.duration === "string"
        ? normalizeClockFromApi(step.duration)
        : step.duration != null
          ? formatDurationWithSeconds(Number(step.duration) * 60)
          : "00:00",
    completed: Boolean(step.completed),
  }
}

// ---- Admin time-edit helpers (รูปแบบ 24 ชม. HH:MM:SS ให้ตรงกับที่แสดงในตาราง) ----

// แปลงค่าจาก record ให้เป็น HH:MM:SS สำหรับช่องแก้ไข หรือคืนค่าว่างถ้าไม่มีเวลา
export function clockToInputValue(value?: string): string {
  if (!value || value === "00:00" || value === "00:00:00") return ""
  const parts = value.split(":")
  const hours = (parts[0] ?? "00").padStart(2, "0").slice(0, 2)
  const minutes = (parts[1] ?? "00").padStart(2, "0").slice(0, 2)
  const seconds = (parts[2] ?? "00").padStart(2, "0").slice(0, 2)
  return `${hours}:${minutes}:${seconds}`
}

// ใส่ ":" อัตโนมัติขณะพิมพ์ บังคับรูปแบบ HH:MM:SS จากตัวเลขที่กรอก
export function maskClockInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6)
  const segments: string[] = [digits.slice(0, 2)]
  if (digits.length > 2) segments.push(digits.slice(2, 4))
  if (digits.length > 4) segments.push(digits.slice(4, 6))
  return segments.join(":")
}

// เติมให้ครบ HH:MM:SS ก่อนส่งบันทึก (รับค่าว่างได้, ผลลัพธ์ผ่าน regex backend /^\d{2}:\d{2}(:\d{2})?$/)
export function finalizeClockForSave(value: string): string {
  if (!value) return ""
  const parts = value.split(":")
  const hours = (parts[0] ?? "0").padStart(2, "0").slice(0, 2)
  const minutes = (parts[1] ?? "0").padStart(2, "0").slice(0, 2)
  const seconds = (parts[2] ?? "0").padStart(2, "0").slice(0, 2)
  return `${hours}:${minutes}:${seconds}`
}

export function getDateDisplay(dateString: string) {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
  const [, month, day] = dateString.split("-")
  return {
    day,
    month: months[Number.parseInt(month, 10) - 1],
  }
}
