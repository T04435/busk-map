import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, isUnavailable, scoreWeek, selectSessions, typicalForSlot, WEEK_SLOTS } from "@/server/scoring";
import type { Candidate, TypicalSensor, WeekCell, WeekDay } from "@/server/scoring";

const here = { lat: -37.815, lon: 144.965 };
const candidate: Candidate = { id: "c1", name: "Pitch", ...here, kind: "footpath", amplification: "allowed", permit: "general", rules: "", rulesUrl: null, cautions: [] };
const sensor: TypicalSensor = {
  id: 1,
  name: "S",
  ...here,
  byWeekdayHour: { saturday: { 10: 100, 11: 200, 19: 3000, 20: 3200 }, sunday: { 10: 50 } },
};

const day = (date: string, weekday: string): WeekDay => ({
  date,
  weekday,
  slots: WEEK_SLOTS.map((s, i) => ({ ...s, startMs: i * 1000, endMs: i * 1000 + 999 })),
});

describe("typicalForSlot", () => {
  it("averages the hours that have data, or returns null", () => {
    expect(typicalForSlot(sensor, "saturday", 10, 13)).toBe(150);
    expect(typicalForSlot(sensor, "saturday", 13, 16)).toBeNull();
    expect(typicalForSlot(sensor, "monday", 10, 13)).toBeNull();
  });
});

describe("scoreWeek", () => {
  it("scores every day and slot, using per-slot footfall and forecast", () => {
    const grid = scoreWeek(
      [candidate],
      {
        days: [day("2026-10-17", "saturday"), day("2026-10-18", "sunday")],
        cells: [{ ...here, affinity: 1 }],
        sensors: [sensor],
        places: [],
        events: [],
        weather: { "2026-10-17": [{ hour: 19, precipitationProbability: 100, windKmh: 0, temperatureC: 20 }] },
      },
      DEFAULT_WEIGHTS,
    );
    expect(grid).toHaveLength(8);
    const satEvening = grid.find((c) => c.date === "2026-10-17" && c.startHour === 19)!;
    const satMorning = grid.find((c) => c.date === "2026-10-17" && c.startHour === 10)!;
    expect(satEvening.best?.factors.weatherPenalty).toBeCloseTo(0.7);
    expect(satMorning.best?.factors.weatherPenalty).toBeNull(); // no forecast hours in that slot
    // Scaled against the week's busiest slot (Saturday 7–10 pm), not this slot's.
    expect(satMorning.best?.factors.footfall).toBeCloseTo(Math.log1p(150) / Math.log1p(3100));
    expect(satEvening.best?.factors.footfall).toBeCloseTo(1);
    expect(grid.find((c) => c.date === "2026-10-18" && c.startHour === 13)!.best?.factors.footfall).toBeNull();
    // No candidates: no best pitch.
    expect(scoreWeek([], { days: [day("2026-10-17", "saturday")], cells: [], sensors: [], places: [], events: [], weather: {} }, DEFAULT_WEIGHTS)[0].best).toBeNull();
  });
});

describe("selectSessions", () => {
  const cell = (date: string, startHour: number, score: number | null): WeekCell => ({
    date,
    weekday: "x",
    startHour,
    endHour: startHour + 3,
    best: score === null ? null : ({ score } as WeekCell["best"]),
  });
  const grid = [
    cell("2026-10-17", 19, 90),
    cell("2026-10-17", 16, 85),
    cell("2026-10-18", 19, 85),
    cell("2026-10-19", 10, 70),
    cell("2026-10-20", 10, 0),
    cell("2026-10-21", 10, null),
  ];

  it("takes the best slots within max sessions and max per day", () => {
    expect(selectSessions(grid, { maxSessions: 5, maxPerDay: 1, unavailable: [] }).map((c) => `${c.date}@${c.startHour}`)).toEqual([
      "2026-10-17@19",
      "2026-10-18@19",
      "2026-10-19@10",
    ]);
    // Ties go to the earlier date.
    expect(selectSessions(grid, { maxSessions: 2, maxPerDay: 2, unavailable: [] }).map((c) => `${c.date}@${c.startHour}`)).toEqual([
      "2026-10-17@19",
      "2026-10-17@16",
    ]);
  });

  it("skips unavailable times", () => {
    const unavailable = [{ date: "2026-10-17", startHour: 20, endHour: 21 }];
    expect(isUnavailable(grid[0], unavailable)).toBe(true);
    expect(isUnavailable(grid[1], unavailable)).toBe(false);
    expect(selectSessions(grid, { maxSessions: 1, maxPerDay: 1, unavailable })[0].startHour).toBe(16);
  });
});
