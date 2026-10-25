import { describe, expect, it } from "vitest";
import { cityNow, defaultDateIn } from "@/lib/city-clock";
import { planTimeZone } from "@/lib/plan-url";
import { MELBOURNE } from "@/lib/city";

// 2026-10-25 23:30 in Melbourne (UTC+11 in October) is 12:30 UTC, so 07:30 the same morning in Bogota (UTC-5).
const NIGHT = "2026-10-25T12:30:00Z";

describe("the busk form's clock in a city's time zone", () => {
  it("reads today and the hour in the city, not in Melbourne", () => {
    expect(cityNow("Australia/Melbourne", NIGHT)).toEqual({ today: "2026-10-25", hour: 23 });
    expect(cityNow("America/Bogota", NIGHT)).toEqual({ today: "2026-10-25", hour: 7 });
    // Across midnight: 20:00 UTC on the 25th is the 26th in Melbourne and still the 25th in Bogota.
    expect(cityNow("Australia/Melbourne", "2026-10-25T20:00:00Z")).toEqual({ today: "2026-10-26", hour: 7 });
    expect(cityNow("America/Bogota", "2026-10-25T20:00:00Z")).toEqual({ today: "2026-10-25", hour: 15 });
  });

  it("any-time default: Melbourne at 11 pm opens tomorrow (no window left), Bogota the same instant opens today", () => {
    expect(defaultDateIn({ kind: "any" }, MELBOURNE.timeZone, NIGHT)).toBe("2026-10-26");
    expect(defaultDateIn({ kind: "any" }, "America/Bogota", NIGHT)).toBe("2026-10-25");
  });

  it("planning again on a weekday slot uses the city's own today and hour", () => {
    // 2026-10-25 is a Sunday. Melbourne is already at 23:30, so Sunday's 6 to 9 pm slot has ended: next Sunday. Bogota is at 07:30: today.
    const rule = { kind: "weekday", weekday: "sunday", startHour: 18, endHour: 21 } as const;
    expect(defaultDateIn(rule, MELBOURNE.timeZone, NIGHT)).toBe("2026-11-01");
    expect(defaultDateIn(rule, "America/Bogota", NIGHT)).toBe("2026-10-25");
  });

  it("is the same in Melbourne as the old Melbourne-only clock", () => {
    expect(defaultDateIn({ kind: "any" }, MELBOURNE.timeZone, "2026-10-25T00:00:00Z")).toBe("2026-10-25");
  });
});

describe("a plan link's default-date time zone", () => {
  it("is Melbourne's for an example, a Melbourne link and an unreadable city", () => {
    expect(planTimeZone({ example: "acoustic" })).toBe("Australia/Melbourne");
    expect(planTimeZone({ city: "melbourne" })).toBe("Australia/Melbourne");
    expect(planTimeZone({ city: "tokyo-jp" })).toBe("Australia/Melbourne");
  });

  it("is the link's city when it carries one", () => {
    expect(planTimeZone({ city: "tokyo-jp", place: "Tokyo~JP~35.6895~139.6917~Asia/Tokyo~Japan" })).toBe("Asia/Tokyo");
  });
});
