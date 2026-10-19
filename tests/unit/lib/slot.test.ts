import { describe, expect, it } from "vitest";
import {
  addDays,
  describeSlot,
  formatHour,
  localToday,
  nextWeekday,
  nextSlotDate,
  localHour,
  localNow,
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

  it("finds the local hour and date in the city's zone", () => {
    expect(localHour("Australia/Melbourne", new Date("2026-10-16T09:30:00Z"))).toBe(20);
    expect(localHour("Australia/Melbourne", new Date("2026-10-15T13:00:00Z"))).toBe(0);
    expect(localNow("Australia/Melbourne", new Date("2026-10-16T09:30:00Z"))).toEqual({ today: "2026-10-16", hour: 20 });
  });

  describe("nextSlotDate: the next slot that hasn't ended", () => {
    // 2026-10-16 is a Friday. The sax example is Friday 17-20.
    it("keeps today before the slot and during it", () => {
      expect(nextSlotDate("friday", 17, 20, "2026-10-16", 9)).toBe("2026-10-16");
      expect(nextSlotDate("friday", 17, 20, "2026-10-16", 17)).toBe("2026-10-16");
      expect(nextSlotDate("friday", 17, 20, "2026-10-16", 19)).toBe("2026-10-16");
    });
    it("moves to next week once the slot has ended (the end hour is exclusive)", () => {
      expect(nextSlotDate("friday", 17, 20, "2026-10-16", 20)).toBe("2026-10-23");
      expect(nextSlotDate("friday", 17, 20, "2026-10-16", 23)).toBe("2026-10-23");
    });
    it("is the plain next weekday on other days, whatever the hour", () => {
      expect(nextSlotDate("saturday", 18, 21, "2026-10-16", 23)).toBe("2026-10-17");
      expect(nextSlotDate("thursday", 18, 21, "2026-10-16", 1)).toBe("2026-10-22");
      expect(nextSlotDate("saturday", 18, 21, "2026-10-17", 21)).toBe("2026-10-24");
      expect(nextSlotDate("saturday", 18, 21, "2026-10-17", 20)).toBe("2026-10-17");
    });
    it("handles a slot ending at midnight (24) and slots that run over midnight", () => {
      expect(nextSlotDate("friday", 21, 24, "2026-10-16", 23)).toBe("2026-10-16");
      // 22 to 2 am: Friday's slot is still on at 1 am Saturday.
      expect(nextSlotDate("friday", 22, 2, "2026-10-17", 1)).toBe("2026-10-16");
      expect(nextSlotDate("friday", 22, 2, "2026-10-17", 2)).toBe("2026-10-23");
      expect(nextSlotDate("friday", 22, 2, "2026-10-16", 23)).toBe("2026-10-16");
    });
  });

  it("formats slots", () => {
    expect(formatHour(0)).toBe("12 am");
    expect(formatHour(12)).toBe("12 pm");
    expect(formatHour(24)).toBe("12 am");
    expect(formatHour(9)).toBe("9 am");
    expect(describeSlot({ date: "2026-10-17", startHour: 18, endHour: 21 })).toBe("Saturday 2026-10-17, 6 pm–9 pm");
  });
});
