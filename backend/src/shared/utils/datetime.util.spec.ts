import { describe, expect, it } from "vitest";
import {
  formatDateAsBangkokHm,
  formatDateOnlyBangkok,
  formatDateTimeBangkok,
  nowUtc,
  parseClockHmToBangkokDate,
  parseDurationHmToMinutes,
  parseDurationHmToSeconds,
  resolveExecutionDurationMinutes,
  resolveWallClockSpanMinutes,
  toIsoUtc,
  toMySqlNaiveBangkokDateTime,
} from "./datetime.util";

describe("datetime.util", () => {
  it("formats Bangkok clock from UTC date", () => {
    const date = new Date("2026-05-22T07:30:00.000Z");
    expect(formatDateAsBangkokHm(date)).toBe("14:30");
  });

  it("parses clock to Bangkok date using production date", () => {
    const productionDate = new Date("2026-05-21T17:00:00.000Z");
    const parsed = parseClockHmToBangkokDate("14:30", productionDate);
    expect(parsed.toISOString()).toBe("2026-05-22T07:30:00.000Z");
  });

  it("parses duration HH:mm to seconds and minutes", () => {
    expect(parseDurationHmToSeconds("01:23")).toBe(4980);
    expect(parseDurationHmToMinutes("01:23")).toBe(83);
  });

  it("derives execution duration from start/end when minutes are missing", () => {
    const minutes = resolveExecutionDurationMinutes({
      start_time: new Date("2026-05-22T02:07:00.000Z"),
      end_time: new Date("2026-05-22T03:30:00.000Z"),
      duration_minutes: null,
    });
    expect(minutes).toBe(83);
  });

  it("derives wall-clock span across overlapping steps", () => {
    const minutes = resolveWallClockSpanMinutes([
      {
        start_time: new Date("2026-05-27T01:01:41.000Z"),
        end_time: new Date("2026-05-27T01:30:41.000Z"),
      },
      {
        start_time: new Date("2026-05-27T01:23:26.000Z"),
        end_time: new Date("2026-05-27T02:47:41.000Z"),
      },
      {
        start_time: new Date("2026-05-27T07:55:24.000Z"),
        end_time: new Date("2026-05-27T08:18:58.000Z"),
      },
    ]);

    expect(minutes).toBe(437);
  });

  it("formats Bangkok date-only string", () => {
    const date = new Date("2026-05-21T17:00:00.000Z");
    expect(formatDateOnlyBangkok(date)).toBe("2026-05-22");
  });

  it("returns current instant from nowUtc", () => {
    const before = Date.now();
    const value = nowUtc();
    const after = Date.now();
    expect(value.getTime()).toBeGreaterThanOrEqual(before);
    expect(value.getTime()).toBeLessThanOrEqual(after);
  });

  it("serializes to ISO UTC", () => {
    const date = new Date("2026-05-22T07:30:00.000Z");
    expect(toIsoUtc(date)).toBe("2026-05-22T07:30:00.000Z");
    expect(toIsoUtc(null)).toBeNull();
  });

  it("formats full Bangkok datetime", () => {
    const date = new Date("2026-05-22T07:30:45.000Z");
    expect(formatDateTimeBangkok(date)).toBe("2026-05-22 14:30:45");
    expect(formatDateTimeBangkok(undefined)).toBeUndefined();
  });

  it("converts instant to naive Bangkok wall-clock for logs table", () => {
    const instant = new Date("2026-06-16T06:30:00.000Z");
    expect(toMySqlNaiveBangkokDateTime(instant).toISOString()).toBe(
      "2026-06-16T13:30:00.000Z",
    );
  });
});
