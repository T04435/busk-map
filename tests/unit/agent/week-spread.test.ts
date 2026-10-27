import { describe, expect, it } from "vitest";
import { allowedPitches, enforceSpread, spreadProblems, WEEK_MIN_SPACING_M, type SpreadDay, type SpreadPitch } from "@/server/agent/week-spread";

const P = (id: string, lat: number, lon: number, score: number, name = id): SpreadPitch => ({ id, name, lat, lon, score });
const DATES = Array.from({ length: 7 }, (_, i) => `2026-11-${String(15 + i).padStart(2, "0")}`);

describe("a metro: each day a different area while one is left", () => {
  // Three areas by longitude: West (< 0.01), Centre (0.01–0.02), East (> 0.02).
  const areaOf = (p: { lon: number }) => (p.lon < 0.01 ? "West" : p.lon < 0.02 ? "Centre" : "East");
  const pool = [P("c1", 0, 0.015, 90), P("c2", 0, 0.016, 88), P("w1", 0, 0.005, 70), P("e1", 0, 0.025, 60)];
  const days = new Map<string, SpreadDay>(DATES.map((d) => [d, { pool, areaOf }]));

  it("sends back a second day in a used area, naming the areas used, while an unused one is left", () => {
    const problems = spreadProblems([{ day: DATES[0], pitchId: "c1", why: "" }, { day: DATES[1], pitchId: "c2", why: "" }], days);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/2026-11-16's pick c2 is in Centre, already used on 2026-11-15. Areas used so far: Centre\. .*Try 2026-11-16: w1, e1\./);
  });

  it("over 7 days: three distinct areas first, then the least-used one, never the day before's", () => {
    const answer = DATES.map((day) => ({ day, pitchId: "c1", why: "insisted" }));
    const { picks, changed } = enforceSpread(answer, days);
    const areas = picks.map((p) => areaOf(pool.find((x) => x.id === p.pitchId)!));
    expect(new Set(areas.slice(0, 3)).size).toBe(3);
    for (let i = 1; i < areas.length; i++) expect(areas[i]).not.toBe(areas[i - 1]);
    const counts = ["West", "Centre", "East"].map((a) => areas.filter((x) => x === a).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(changed.length).toBeGreaterThan(0);
    // A replaced day's why is left to the data.
    expect(picks.filter((p) => changed.includes(p.day)).every((p) => p.why === "")).toBe(true);
    expect(spreadProblems(picks, days)).toEqual([]);
  });

  it("lets a day repeat an area when its pool has no other", () => {
    const only = new Map<string, SpreadDay>([
      [DATES[0], { pool: [P("c1", 0, 0.015, 90)], areaOf }],
      [DATES[1], { pool: [P("c2", 0, 0.016, 80)], areaOf }],
    ]);
    expect(spreadProblems([{ day: DATES[0], pitchId: "c1", why: "" }, { day: DATES[1], pitchId: "c2", why: "" }], only)).toEqual([]);
  });
});

describe("a city without areas: no pitch twice, 400 m apart", () => {
  const pool = [P("a", -37.81, 144.96, 90), P("a-near", -37.8102, 144.9603, 89), P("b", -37.815, 144.966, 70), P("c", -37.82, 144.97, 60)];
  const days = new Map<string, SpreadDay>(DATES.slice(0, 3).map((d) => [d, { pool, areaOf: null }]));

  it("sends back a repeat and a pick within 400 m, with what to try", () => {
    expect(WEEK_MIN_SPACING_M).toBe(400);
    const problems = spreadProblems(
      [
        { day: DATES[0], pitchId: "a", why: "" },
        { day: DATES[1], pitchId: "a", why: "" },
        { day: DATES[2], pitchId: "a-near", why: "" },
      ],
      days,
    );
    expect(problems[0]).toMatch(/never the same pitch twice.*Try 2026-11-16: b, c\./);
    expect(problems[1]).toMatch(/within 400 m of 2026-11-15's pick \(a\)/);
  });

  it("enforces: the best pitch that keeps the rule", () => {
    const { picks } = enforceSpread(DATES.slice(0, 3).map((day) => ({ day, pitchId: "a", why: "x" })), days);
    expect(picks.map((p) => p.pitchId)).toEqual(["a", "b", "c"]);
  });

  it("relaxes spacing, then repeats, only when nothing keeps the rule", () => {
    const tight = { pool: [P("a", -37.81, 144.96, 90), P("a-near", -37.8102, 144.9603, 89)], areaOf: null };
    const earlier = [{ day: DATES[0], pitch: tight.pool[0], area: null }];
    expect(allowedPitches(tight, earlier).map((p) => p.id)).toEqual(["a-near"]);
    const one = { pool: [P("a", -37.81, 144.96, 90)], areaOf: null };
    expect(allowedPitches(one, earlier).map((p) => p.id)).toEqual(["a"]);
  });
});
