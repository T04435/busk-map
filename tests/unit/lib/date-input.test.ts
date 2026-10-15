import { describe, expect, it } from "vitest";
import { formatIsoDate, isoToLocalDate, localDateToIso } from "@/lib/date-input";

describe("date picker values", () => {
  it("round-trips YYYY-MM-DD through local dates", () => {
    const date = isoToLocalDate("2026-10-24")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 24, 0]);
    expect(localDateToIso(date)).toBe("2026-10-24");
    expect(localDateToIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("rejects malformed and impossible dates", () => {
    expect(isoToLocalDate("24/10/2026")).toBeNull();
    expect(isoToLocalDate("2026-02-30")).toBeNull();
    expect(isoToLocalDate("")).toBeNull();
  });

  it("formats a short, readable label", () => {
    expect(formatIsoDate("2026-10-24")).toMatch(/Sat\.? 24 Oct\.? 2026/);
    expect(formatIsoDate("nope")).toBe("nope");
  });
});
