import { describe, expect, it } from "vitest";
import {
  addDays,
  baselineDates,
  describeSlot,
  formatHour,
  localToday,
  nextWeekday,
  slotHours,
  slotSchema,
  slotUtcRange,
  timeZoneOffsetMinutes,
  weekdayOf,
  zonedHourToUtc,
} from "@/lib/slot";

describe("slot", () => {
  it("validates slots", () => {
    expect(slotSchema.safeParse({ date: "2026-10-17", startHour: 18, endHour: 21 }).success).toBe(true);
    expect(slotSchema.safeParse({ date: "2026-10-17", startHour: 21, endHour: 18 }).success).toBe(false);
    expect(slotSchema.safeParse({ date: "2026-10-17", startHour: 8, endHour: 20 }).success).toBe(false);
    expect(slotSchema.safeParse({ date: "17/10/2026", startHour: 8, endHour: 9 }).success).toBe(false);
  });

  it("knows weekdays and hours", () => {
    expect(weekdayOf("2026-10-17")).toBe("saturday");
    expect(slotHours({ date: "2026-10-17", startHour: 18, endHour: 21 })).toEqual([18, 19, 20]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("picks recent same-weekday dates strictly before today", () => {
    expect(baselineDates("2026-10-17", "2026-10-15", 3)).toEqual(["2026-10-10", "2026-10-03", "2026-09-26"]);
    // Slot on the same weekday as today: today itself is excluded.
    expect(baselineDates("2026-10-22", "2026-10-15", 1)).toEqual(["2026-10-08"]);
    // A past slot works too.
    expect(baselineDates("2026-10-12", "2026-10-15", 1)).toEqual(["2026-10-12"]);
  });

  it("converts local hours to UTC across daylight saving", () => {
    // Melbourne is UTC+11 in October (daylight saving) and UTC+10 in June.
    expect(zonedHourToUtc("2026-10-17", 18, "Australia/Melbourne").toISOString()).toBe("2026-10-17T07:00:00.000Z");
    expect(zonedHourToUtc("2026-06-13", 18, "Australia/Melbourne").toISOString()).toBe("2026-06-13T08:00:00.000Z");
    expect(timeZoneOffsetMinutes("Australia/Melbourne", Date.UTC(2026, 9, 17))).toBe(660);
    const range = slotUtcRange({ date: "2026-10-17", startHour: 18, endHour: 24 }, "Australia/Melbourne");
    expect(range.end.toISOString()).toBe("2026-10-17T13:00:00.000Z");
  });

  it("finds today and the next weekday", () => {
    expect(localToday("Australia/Melbourne", new Date("2026-10-14T14:30:00Z"))).toBe("2026-10-15");
    expect(nextWeekday("saturday", "2026-10-15")).toBe("2026-10-17");
    expect(nextWeekday("thursday", "2026-10-15")).toBe("2026-10-15");
  });

  it("formats slots", () => {
    expect(formatHour(0)).toBe("12 am");
    expect(formatHour(12)).toBe("12 pm");
    expect(formatHour(24)).toBe("12 am");
    expect(formatHour(9)).toBe("9 am");
    expect(describeSlot({ date: "2026-10-17", startHour: 18, endHour: 21 })).toBe("Saturday 2026-10-17, 6 pm–9 pm");
  });
});
