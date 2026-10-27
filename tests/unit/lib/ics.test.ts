import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "@/lib/ics";

describe("ics", () => {
  it("escapes text (semicolons too) and folds long lines at 75 octets", () => {
    expect(escapeText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
    expect(foldLine("short")).toBe("short");
    const folded = foldLine(`DESCRIPTION:${"é".repeat(60)}`);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
  });

  it("builds a calendar with one event per day", () => {
    const ics = buildIcs(
      [
        { uid: "w-2026-10-17@buskmap.app", start: new Date("2026-10-17T08:00:00Z"), end: new Date("2026-10-17T11:00:00Z"), summary: "Busk: Pitch, CBD", location: "Pitch, Melbourne", description: "Line one\nLine two", geo: { lat: -37.8, lon: 144.96 }, url: "https://example.com/p/abc" },
        { uid: "b", start: new Date(0), end: new Date(1000), summary: "x", location: "y", description: "z" },
      ],
      new Date("2026-10-15T00:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTSTART:20261017T080000Z");
    expect(ics).toContain("DTSTAMP:20261015T000000Z");
    expect(ics).toContain("SUMMARY:Busk: Pitch\\, CBD");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
    expect(ics).toContain("GEO:-37.800000;144.960000");
    expect(ics).toContain("X-WR-CALNAME:Busk Map sessions");
  });
});
