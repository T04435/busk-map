import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "@/lib/ics";
import { parseWeekParams, weekSearchParams } from "@/lib/week-url";

describe("week URL state", () => {
  it("parses an example week with limits and unavailable slots, and round-trips", () => {
    const parsed = parseWeekParams({ example: "acoustic", max: "3", perDay: "2", off: "2026-10-17@19|bad|2026-10-18@22" }, "2026-10-15");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.startDate).toBe("2026-10-15");
    expect(parsed.request.limits).toEqual({
      maxSessions: 3,
      maxPerDay: 2,
      unavailable: [
        { date: "2026-10-17", startHour: 19, endHour: 22 },
        { date: "2026-10-18", startHour: 22, endHour: 24 },
      ],
    });
    const again = parseWeekParams(Object.fromEntries(weekSearchParams(parsed.request, parsed.exampleId)), "2026-10-15");
    expect(again.ok && again.request).toEqual(parsed.request);
  });

  it("round-trips a custom performer with weights and defaults the limits", () => {
    const parsed = parseWeekParams({ name: "Jess", artists: "A|B", songs: "T~A|Mine~Jess~own", start: "2026-10-16", w: "1,0,0,0,0.5" }, "2026-10-15");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.limits).toEqual({ maxSessions: 5, maxPerDay: 1, unavailable: [] });
    expect(parsed.request.weights).toEqual({ taste: 1, footfall: 0, places: 0, events: 0, weather: 0.5 });
    const params = weekSearchParams(parsed.request, null);
    expect(params.get("songs")).toBe("T~A|Mine~Jess~own");
    const again = parseWeekParams(Object.fromEntries(params), "2026-10-15");
    expect(again.ok && again.request).toEqual(parsed.request);
  });

  it("explains what's wrong", () => {
    expect(parseWeekParams({}, "2026-10-15").ok).toBe(false);
    expect(parseWeekParams({ example: "sax", max: "9" }, "2026-10-15")).toMatchObject({ ok: false, error: expect.stringMatching(/limits\.maxSessions/) });
    expect(parseWeekParams({ example: ["sax"], w: "1,2" }, "2026-10-15")).toMatchObject({ ok: true });
  });
});

describe("ics", () => {
  it("escapes text and folds long lines at 75 octets", () => {
    expect(escapeText("a;b,c\\d\ne")).toBe("a\;b\\,c\\\\d\\ne");
    expect(foldLine("short")).toBe("short");
    const folded = foldLine(`DESCRIPTION:${"é".repeat(60)}`);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
  });

  it("builds a calendar with one event per session", () => {
    const ics = buildIcs(
      [
        {
          uid: "2026-10-17@19-p1@busk-map",
          start: new Date("2026-10-17T08:00:00Z"),
          end: new Date("2026-10-17T11:00:00Z"),
          summary: "Busk: Pitch, CBD",
          location: "Pitch, Melbourne",
          description: "Line one\nLine two",
          geo: { lat: -37.8, lon: 144.96 },
          url: "https://example.com/plan?x=1",
        },
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
