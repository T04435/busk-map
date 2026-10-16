import { describe, expect, it } from "vitest";
import { ANY_TIME_WINDOWS, anyTimeWindowsLeft, nextAnyTimeDate } from "@/lib/slot";
import { DEFAULT_WEIGHTS, bestWindow, footfallReferenceOf, rankPitchesAnyTime, scorePitch, scorePitchAnyTime, scoreWindows, windowInputs } from "@/server/scoring";
import type { AnyTimeBase, Candidate, TypicalSensor } from "@/server/scoring";

const here = { lat: -37.815, lon: 144.965 };
const far = { lat: -37.83, lon: 144.99 };
const cand = (id: string, at: { lat: number; lon: number }): Candidate => ({ id, name: id, ...at, kind: "footpath", origin: "taste", cell: null, usualSpot: null, amplification: "allowed", permit: "general", rules: "", rulesUrl: null, cautions: [] });
const sensorAt = (id: number, at: { lat: number; lon: number }, byHour: Record<number, number>): TypicalSensor => ({ id, name: `S${id}`, ...at, byWeekdayHour: { saturday: byHour } });
const hours = (from: number, to: number, value: number) => Object.fromEntries(Array.from({ length: to - from }, (_, i) => [from + i, value]));

const DATE_MS = Date.parse("2026-10-16T13:00:00Z"); // Saturday 00:00 in Melbourne (UTC+11)
const baseOf = (over: Partial<AnyTimeBase> = {}): AnyTimeBase => ({
  weekday: "saturday",
  cells: [],
  sensors: [sensorAt(1, here, { ...hours(10, 22, 200), 12: 2000, 13: 2000, 14: 2000 }), sensorAt(2, far, { ...hours(10, 22, 100), 20: 3000, 21: 3000 })],
  places: [],
  events: [],
  weather: null,
  hourMs: (h) => DATE_MS + h * 3_600_000,
  ...over,
});

describe("any-time windows (D2)", () => {
  it("are ten 3-hour windows starting every hour from 10 am to 7 pm", () => {
    expect(ANY_TIME_WINDOWS).toHaveLength(10);
    expect(ANY_TIME_WINDOWS[0]).toEqual({ startHour: 10, endHour: 13 });
    expect(ANY_TIME_WINDOWS.at(-1)).toEqual({ startHour: 19, endHour: 22 });
    expect(ANY_TIME_WINDOWS.every((w) => w.endHour - w.startHour === 3)).toBe(true);
  });
  it("on today's date keep only windows that start after the current hour", () => {
    expect(anyTimeWindowsLeft("2026-10-14", "2026-10-14", 12).map((w) => w.startHour)).toEqual([13, 14, 15, 16, 17, 18, 19]);
    expect(anyTimeWindowsLeft("2026-10-14", "2026-10-14", 0)).toHaveLength(10);
    expect(anyTimeWindowsLeft("2026-10-14", "2026-10-14", 19)).toEqual([]);
    expect(anyTimeWindowsLeft("2026-10-14", "2026-10-14", 21)).toEqual([]);
    expect(anyTimeWindowsLeft("2026-10-15", "2026-10-14", 23)).toHaveLength(10);
    expect(anyTimeWindowsLeft("2026-10-13", "2026-10-14", 5)).toEqual([]);
  });
  it("default the date to today while a window can still start, else tomorrow (pinned clocks, 2.5)", () => {
    expect(nextAnyTimeDate("2026-10-14", 12)).toBe("2026-10-14"); // Wed noon (DEV default)
    expect(nextAnyTimeDate("2026-10-17", 0)).toBe("2026-10-17"); // after midnight
    expect(nextAnyTimeDate("2026-10-16", 18)).toBe("2026-10-16");
    expect(nextAnyTimeDate("2026-10-16", 19)).toBe("2026-10-17");
    expect(nextAnyTimeDate("2026-10-16", 21)).toBe("2026-10-17"); // Fri 21:30
  });
});

describe("best window per pitch (D3)", () => {
  it("each pitch gets its own best window, and a pitch at a lunch sensor differs from one at a late-night sensor", () => {
    const base = baseOf();
    const lunch = scorePitchAnyTime(cand("lunch", here), base, ANY_TIME_WINDOWS, DEFAULT_WEIGHTS)!;
    const late = scorePitchAnyTime(cand("late", far), base, ANY_TIME_WINDOWS, DEFAULT_WEIGHTS)!;
    expect(lunch.window).toMatchObject({ startHour: 12, endHour: 15 });
    expect(late.window).toMatchObject({ startHour: 19, endHour: 22 });
    expect(lunch.score).toBeGreaterThan(0);
    expect(lunch.window!.runnersUp).toHaveLength(2);
    expect(lunch.window!.runnersUp[0].score).toBeLessThanOrEqual(lunch.score);
  });
  it("scales footfall against the day's busiest window, so a quiet morning does not look as good as a busy evening", () => {
    const base = baseOf();
    const busiest = (100 + 3000 + 3000) / 3; // the 7-10 pm window at the far sensor
    expect(footfallReferenceOf(base)).toBeCloseTo(busiest);
    const morning = scoreWindows(cand("p", far), base, [ANY_TIME_WINDOWS[0]], DEFAULT_WEIGHTS)[0];
    const evening = scoreWindows(cand("p", far), base, [ANY_TIME_WINDOWS[9]], DEFAULT_WEIGHTS)[0];
    expect(morning.factors.footfall).toBeCloseTo(Math.sqrt(100 / busiest));
    expect(evening.factors.footfall).toBeCloseTo(1);
    expect(evening.score).toBeGreaterThan(morning.score);
  });
  it("a sensor with no count that weekday adds nothing to the day's scale", () => {
    expect(footfallReferenceOf({ weekday: "monday", sensors: [sensorAt(1, here, hours(10, 22, 500))] })).toBe(0);
  });
  it("breaks ties by the earlier window", () => {
    const flat = baseOf({ sensors: [sensorAt(1, here, hours(10, 22, 500))] });
    expect(scorePitchAnyTime(cand("p", here), flat, ANY_TIME_WINDOWS, DEFAULT_WEIGHTS)!.window).toMatchObject({ startHour: 10, endHour: 13 });
  });
  it("a window's score equals the pitch scored at exactly those hours (same engine, same weights)", () => {
    const base = baseOf();
    const reference = footfallReferenceOf(base);
    const w = ANY_TIME_WINDOWS[4];
    const viaWindows = scoreWindows(cand("p", here), base, [w], DEFAULT_WEIGHTS, reference)[0];
    const direct = scorePitch(cand("p", here), windowInputs(base, w, reference), DEFAULT_WEIGHTS);
    expect(viaWindows.score).toBe(direct.score);
    expect(viaWindows.window).toMatchObject({ startHour: 14, endHour: 17 });
  });
  it("an event leaving in a late window pulls the pitch there", () => {
    const base = baseOf({
      sensors: [sensorAt(1, here, hours(10, 22, 300))],
      events: [{ id: "e", name: "Gig", venue: { ...here, name: "Hall" }, start: new Date(DATE_MS + 18 * 3_600_000).toISOString(), end: new Date(DATE_MS + 21.5 * 3_600_000).toISOString(), endEstimated: false }],
    });
    const pitch = scorePitchAnyTime(cand("p", here), base, ANY_TIME_WINDOWS, DEFAULT_WEIGHTS)!;
    expect(pitch.window!.endHour).toBeGreaterThan(21);
    expect(pitch.evidence.events[0]).toMatchObject({ name: "Gig", moment: "leaving" });
  });
  it("rain at noon pushes the best window away from it", () => {
    const sensors = [sensorAt(1, here, { ...hours(10, 22, 300), 12: 400, 13: 400, 14: 400 })];
    const dry = scorePitchAnyTime(cand("p", here), baseOf({ sensors }), ANY_TIME_WINDOWS, DEFAULT_WEIGHTS)!;
    const wet = scorePitchAnyTime(
      cand("p", here),
      baseOf({ sensors, weather: Array.from({ length: 12 }, (_, i) => ({ hour: 10 + i, precipitationProbability: 10 + i >= 12 && 10 + i < 16 ? 100 : 0, windKmh: 0, temperatureC: 20 })) }),
      ANY_TIME_WINDOWS,
      DEFAULT_WEIGHTS,
    )!;
    expect(dry.window!.startHour).toBe(12);
    expect(wet.window!.startHour).not.toBe(12);
    expect(wet.window!.startHour).toBeGreaterThanOrEqual(16);
  });
  it("a place closed in the morning does not count there", () => {
    const place = { id: "pl", name: "Cafe", ...here, popularity: 0.9, hours: { saturday: [{ opens: "T17:00:00", closes: "T23:00:00", closed: false }] } };
    const base = baseOf({ sensors: [sensorAt(1, here, hours(10, 22, 300))], places: [place] });
    const [morning, evening] = [ANY_TIME_WINDOWS[0], ANY_TIME_WINDOWS[9]].map((w) => scoreWindows(cand("p", here), base, [w], DEFAULT_WEIGHTS)[0]);
    expect(morning.evidence.places).toEqual([]);
    expect(evening.evidence.places.map((p) => p.name)).toEqual(["Cafe"]);
  });
  it("only the windows still ahead are scored, and with none left nothing ranks", () => {
    const base = baseOf();
    const left = anyTimeWindowsLeft("2026-10-14", "2026-10-14", 12);
    const ranked = rankPitchesAnyTime([cand("a", here), cand("b", far)], base, left, DEFAULT_WEIGHTS);
    expect(ranked.every((p) => left.some((w) => w.startHour === p.window!.startHour))).toBe(true);
    expect(rankPitchesAnyTime([cand("a", here)], base, [], DEFAULT_WEIGHTS)).toEqual([]);
    expect(bestWindow([])).toBeNull();
  });
  it("ranks pitches by their best window's score, ties by id", () => {
    const ranked = rankPitchesAnyTime([cand("b", here), cand("a", here), cand("z", far)], baseOf(), ANY_TIME_WINDOWS, DEFAULT_WEIGHTS);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    const same = ranked.filter((p) => p.id === "a" || p.id === "b").map((p) => p.id);
    expect(same).toEqual(["a", "b"]);
  });
});
