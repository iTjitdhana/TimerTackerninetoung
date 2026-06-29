const BANGKOK_TIMEZONE = "Asia/Bangkok";

export function formatDurationFromSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDurationWithSecondsFromSeconds(
  totalSeconds: number,
): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatDurationFromMinutes(totalMinutes: number): string {
  return formatDurationFromSeconds(totalMinutes * 60);
}

function getBangkokDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function nowUtc(): Date {
  return new Date();
}

export function toIsoUtc(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

export function formatDateTimeBangkok(
  value: Date | null | undefined,
): string | undefined {
  if (!value) return undefined;

  const { year, month, day, hour, minute, second } = getBangkokDateParts(value);
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * แปลง instant เป็น Date สำหรับเขียนลง MySQL DATETIME ของตาราง logs
 * ให้ตัวเลขในคอลัมน์เป็น wall-clock ไทย (ตรงกับ DATE_FORMAT('%H:%i') ที่ใช้อ่าน logs เดิม)
 */
export function toMySqlNaiveBangkokDateTime(instant: Date): Date {
  const wall = formatDateTimeBangkok(instant);
  if (!wall) {
    throw new Error("Invalid datetime");
  }
  const [datePart, timePart] = wall.split(" ");
  return new Date(`${datePart}T${timePart}.000Z`);
}

export function formatDateOnlyBangkok(value: Date): string {
  const { year, month, day } = getBangkokDateParts(value);
  return `${year}-${month}-${day}`;
}

export function todayDateOnlyBangkok(): string {
  return formatDateOnlyBangkok(new Date());
}

export function parseDateOnlyBangkok(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date-only value: ${dateStr}`);
  }
  return new Date(`${dateStr}T00:00:00+07:00`);
}

export function nextDateOnlyBangkok(dateStr: string): Date {
  const current = parseDateOnlyBangkok(dateStr);
  return new Date(current.getTime() + 24 * 60 * 60 * 1000);
}

export function formatDateAsBangkokHm(
  value: Date | null | undefined,
): string | undefined {
  if (!value) return undefined;

  const { hour, minute } = getBangkokDateParts(value);
  return `${hour}:${minute}`;
}

export function formatDateAsBangkokHms(
  value: Date | null | undefined,
): string | undefined {
  if (!value) return undefined;

  const { hour, minute, second } = getBangkokDateParts(value);
  return `${hour}:${minute}:${second}`;
}

export function formatPrismaDateTimeAsHm(
  value: Date | null | undefined,
): string | undefined {
  return formatDateAsBangkokHm(value);
}

export function formatPrismaDateTimeAsHms(
  value: Date | null | undefined,
): string | undefined {
  return formatDateAsBangkokHms(value);
}

export function parseClockHmToBangkokDate(
  clockHm: string,
  productionDate: Date,
): Date {
  const dateStr = formatDateOnlyBangkok(productionDate);
  const [hours, minutes, seconds = "00"] = clockHm.split(":");
  return new Date(
    `${dateStr}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}+07:00`,
  );
}

export function parseDurationHmToSeconds(value: string): number {
  const parts = value.split(":").map((part) => Number.parseInt(part, 10) || 0);
  if (parts.length >= 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 3600 + parts[1] * 60;
  }
  return 0;
}

export function parseDurationHmToMinutes(value: string): number {
  return Math.floor(parseDurationHmToSeconds(value) / 60);
}

export function resolveExecutionDurationMinutes(execution: {
  start_time: Date | null;
  end_time: Date | null;
  duration_minutes: number | null;
}): number {
  if (execution.start_time && execution.end_time) {
    return Math.max(
      0,
      Math.floor(
        (execution.end_time.getTime() - execution.start_time.getTime()) /
          60000,
      ),
    );
  }

  return execution.duration_minutes ?? 0;
}

export function resolveWallClockSpanMinutes(
  intervals: Array<{
    start_time?: Date | null;
    end_time?: Date | null;
  }>,
): number {
  const startTimes = intervals
    .map((interval) => interval.start_time?.getTime())
    .filter((value): value is number => value != null && Number.isFinite(value));
  const endTimes = intervals
    .map((interval) => interval.end_time?.getTime())
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (startTimes.length === 0 || endTimes.length === 0) {
    return 0;
  }

  const earliestStart = Math.min(...startTimes);
  const latestEnd = Math.max(...endTimes);

  return Math.max(0, Math.floor((latestEnd - earliestStart) / 60000));
}

export function parseIsoOrDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }
  return parsed;
}
