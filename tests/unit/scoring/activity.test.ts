import { describe, expect, it } from "vitest";
import { activityCurve, activityEstimate, areaPopularity, placesOpenByHour, relativeActivity, scorePitch, DEFAULT_WEIGHTS } from "@/server/scoring";
import type { Candidate, PlaceInput, ScoreInputs } from "@/server/scoring";
import { activityPhrase, activitySentence, activityWord, dayPartOf, NEUTRAL_ACTIVITY } from "@/lib/activity";

const here = { lat: -37.815, lon: 144.965 };
const offsetM = (m: number) => ({ lat: here.lat + m / 111_195, lon: here.lon });

/** A Qloo place open from `from` to `to` o'clock on Friday (the live hours shape). */
const place = (id: string, at: { lat: number; lon: number }, popularity: number | null, from?: number, to?: number): PlaceInput => ({
  id,
  name: id,
  ...at,
  popularity,
  hours: from === undefined ? null : { friday: [{ opens: `T${String(from).padStart(2, "0")}:00:00`, closes: `T${String(to).padStart(2, "0")}:00:00`, closed: false }] },
});
const data = (places: PlaceInput[], cells: { lat: number; lon: number; affinity: number; popularity?: number | null }[] = []) => ({ places, cells, weekday: "friday" });
const saturate = (sum: number) => 1 - Math.exp(-sum / 1.5);

describe("activity estimate: venues open by hour", () => {
  const bar = place("bar", here, 1, 18, 24);

  it("a venue counts only in the hours it is open", () => {
    const evening = activityEstimate(here, data([bar]), 19, 22);
    const morning = activityEstimate(here, data([bar]), 9, 12);
    expect(evening.venues).toBeCloseTo(saturate(1));
    expect(morning.venues).toBe(0);
    expect(evening.level).toBeGreaterThan(morning.level);
    expect(evening.nearby.map((p) => p.id)).toEqual(["bar"]);
    expect(morning.nearby).toEqual([]);
  });

  it("a slot where the venue closes halfway sits between an open and a closed slot", () => {
    const open = activityEstimate(here, data([place("p", here, 1, 10, 22)]), 19, 22).level;
    const half = activityEstimate(here, data([place("p", here, 1, 10, 20)]), 19, 22).level; // open for 1 of 3 hours
    const closed = activityEstimate(here, data([place("p", here, 1, 10, 18)]), 19, 22).level;
    expect(closed).toBe(0);
    expect(half).toBeCloseTo(open / 3, 5);
    expect(half).toBeGreaterThan(closed);
    expect(half).toBeLessThan(open);
  });

  it("the hourly curve follows the opening hours, and its mean is the slot level", () => {
    const d = data([place("p", here, 1, 18, 22)]);
    const curve = activityCurve(here, d, 16, 24);
    expect(curve.map((h) => h.hour)).toEqual([16, 17, 18, 19, 20, 21, 22, 23]);
    expect(curve.slice(0, 2).every((h) => h.level === 0)).toBe(true);
    expect(curve.slice(2, 6).every((h) => h.level > 0)).toBe(true);
    expect(curve.slice(6).every((h) => h.level === 0)).toBe(true);
    const slot = activityEstimate(here, d, 17, 20);
    expect(slot.curve.map((h) => h.hour)).toEqual([17, 18, 19]);
    expect(slot.level).toBeCloseTo(slot.curve.reduce((t, h) => t + h.level, 0) / 3);
  });

  it("reads venues open past midnight (Thursday's late range still going on Friday morning)", () => {
    const late = { ...place("late", here, 1), hours: { thursday: [{ opens: "T20:00:00", closes: "T02:00:00", closed: false }], friday: [{ opens: null, closes: null, closed: true }] } };
    expect(activityEstimate(here, data([late]), 0, 1).venues).toBeCloseTo(saturate(1));
    expect(activityEstimate(here, data([late]), 3, 4).venues).toBe(0);
  });

  it("unknown hours count as open (marked unknown), known-closed places are left out", () => {
    const result = activityEstimate(here, data([place("unknown", here, 0.8), place("shut", here, 1, 6, 9)]), 19, 22);
    expect(result.nearby.map((p) => [p.id, p.open])).toEqual([["unknown", "unknown"]]);
    expect(result.venues).toBeCloseTo(saturate(0.8));
  });
});

describe("activity estimate: distance and popularity weighting", () => {
  it("a nearer place counts more than the same place farther away; beyond 250 m it does not count", () => {
    const near = activityEstimate(here, data([place("p", offsetM(20), 0.8, 10, 24)]), 19, 22).venues!;
    const mid = activityEstimate(here, data([place("p", offsetM(200), 0.8, 10, 24)]), 19, 22).venues!;
    const far = activityEstimate(here, data([place("p", offsetM(400), 0.8, 10, 24)]), 19, 22).venues!;
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
    expect(far).toBe(0);
    expect(near).toBeCloseTo(saturate(0.8 * (1 - 20 / 250)), 2);
  });

  it("a more popular place counts more; unknown popularity counts as average (0.5)", () => {
    const level = (popularity: number | null) => activityEstimate(here, data([place("p", here, popularity, 10, 24)]), 19, 22).venues!;
    expect(level(1)).toBeGreaterThan(level(0.5));
    expect(level(0.5)).toBeGreaterThan(level(0.1));
    expect(level(null)).toBeCloseTo(level(0.5));
  });

  it("many places saturate rather than grow without limit", () => {
    const crowd = Array.from({ length: 30 }, (_, i) => place(`p${i}`, here, 1, 10, 24));
    const level = activityEstimate(here, data(crowd), 19, 22).venues!;
    expect(level).toBeGreaterThan(0.99);
    expect(level).toBeLessThanOrEqual(1);
  });

  it("lists the strongest places first", () => {
    const result = activityEstimate(here, data([place("faint", offsetM(200), 0.2, 10, 24), place("strong", offsetM(10), 0.9, 10, 24)]), 19, 22);
    expect(result.nearby.map((p) => p.id)).toEqual(["strong", "faint"]);
    expect(result.nearby[0].distanceM).toBe(10);
  });
});

describe("activity estimate: the heatmap's popularity (where activity concentrates)", () => {
  const cells = [
    { ...here, affinity: 0.5, popularity: 0.8 },
    { ...offsetM(5000), affinity: 0.5, popularity: 0.1 },
  ];

  it("reads the popularity of the cells near the pitch, nearest cell dominating", () => {
    expect(areaPopularity(here, cells)).toBeCloseTo(0.8);
    expect(areaPopularity(offsetM(5000), cells)).toBeCloseTo(0.1);
    const two = [{ ...offsetM(30), affinity: 1, popularity: 0.9 }, { ...offsetM(250), affinity: 1, popularity: 0.3 }];
    const blended = areaPopularity(here, two)!;
    expect(blended).toBeGreaterThan(0.3);
    expect(blended).toBeGreaterThan(0.6);
    expect(blended).toBeLessThan(0.9);
  });

  it("is null with no cell in range or no popularity on the cells", () => {
    expect(areaPopularity(here, [])).toBeNull();
    expect(areaPopularity(here, [{ ...offsetM(5000), affinity: 1, popularity: 0.5 }])).toBeNull();
    expect(areaPopularity(here, [{ ...here, affinity: 1, popularity: null }, { ...here, affinity: 1 }])).toBeNull();
  });

  it("combines with the venues: 40% area, 60% venues", () => {
    const result = activityEstimate(here, data([place("p", here, 1, 10, 24)], cells), 19, 22);
    expect(result.basis).toBe("heatmap+places");
    expect(result.area).toBeCloseTo(0.8);
    expect(result.level).toBeCloseTo(0.4 * 0.8 + 0.6 * saturate(1));
  });

  it("a popular area with every venue closed still reads as active, but less than with the venues open", () => {
    const closed = activityEstimate(here, data([place("p", here, 1, 6, 9)], cells), 19, 22);
    const open = activityEstimate(here, data([place("p", here, 1, 10, 24)], cells), 19, 22);
    expect(closed.level).toBeCloseTo(0.4 * 0.8);
    expect(open.level).toBeGreaterThan(closed.level);
  });

  it("with the heatmap alone the level is the area, the same at every hour, and says its hours are unknown", () => {
    const result = activityEstimate(here, data([], cells), 10, 16);
    expect(result.basis).toBe("heatmap");
    expect(result.venues).toBeNull();
    expect(result.level).toBeCloseTo(0.8);
    expect(new Set(result.curve.map((h) => h.level)).size).toBe(1);
  });

  it("with places but no heatmap popularity the level is the venues alone", () => {
    const result = activityEstimate(here, data([place("p", here, 1, 10, 24)]), 19, 22);
    expect(result.basis).toBe("places");
    expect(result.area).toBeNull();
    expect(result.level).toBeCloseTo(saturate(1));
  });
});

describe("activity estimate: an empty Qloo answer", () => {
  it("is a neutral level with basis none and an honest label, never zero", () => {
    const result = activityEstimate(here, data([]), 19, 22);
    expect(result).toMatchObject({ basis: "none", level: NEUTRAL_ACTIVITY, area: null, venues: null, nearby: [] });
    expect(result.curve.every((h) => h.level === NEUTRAL_ACTIVITY)).toBe(true);
    expect(activityCurve(here, data([]), 19, 22)).toEqual([19, 20, 21].map((hour) => ({ hour, level: NEUTRAL_ACTIVITY })));
    expect(activitySentence({ level: result.level, basis: result.basis, weekday: "friday", startHour: 19 })).toBe("No activity estimate here");
    expect(activityPhrase(result.level, "none")).toBe("");
  });

  it("the scoring leaves the factor out instead of scoring it as quiet", () => {
    const candidate: Candidate = { id: "a", name: "a", ...here, kind: "public-space", origin: "taste", cell: null, usualSpot: null, amplification: "allowed", permit: "general", rules: "", rulesUrl: null, cautions: [] };
    const inputs: ScoreInputs = { cells: [{ ...here, affinity: 1 }], places: [], events: [], weather: null, weekday: "friday", startHour: 19, endHour: 22, slotStartMs: 0, slotEndMs: 1 };
    const pitch = scorePitch(candidate, inputs, DEFAULT_WEIGHTS);
    expect(pitch.activityBasis).toBe("none");
    expect(pitch.factors.activity).toBeNull();
    expect(pitch.contributions.activity).toBeNull();
  });

  it("places far from the pitch with an empty heatmap is a real, low estimate (Qloo answered), not 'none'", () => {
    const result = activityEstimate(here, data([place("far", offsetM(2000), 1, 10, 24)]), 19, 22);
    expect(result.basis).toBe("places");
    expect(result.level).toBe(0);
  });
});

describe("activity wording", () => {
  it("names a level in one word", () => {
    expect([0, 0.25, 0.5, 0.7, 0.95].map(activityWord)).toEqual(["Quiet", "Fairly quiet", "Moderately busy", "Busy", "Very busy"]);
  });

  it("says the day and the part of the day, tagged as an estimate, with no head count", () => {
    expect(activitySentence({ level: 0.7, basis: "places", weekday: "friday", startHour: 18 })).toBe("Busy here on Friday evenings (est.)");
    expect(activitySentence({ level: 0.3, basis: "heatmap", weekday: "sunday", startHour: 10 })).toBe("Fairly quiet here on Sunday mornings (est.)");
    expect(activitySentence({ level: 0.9, basis: "heatmap+places", weekday: "saturday", startHour: 22 })).toBe("Very busy here on Saturday nights (est.)");
    expect(activitySentence({ level: 0.7, basis: "places", weekday: "friday", startHour: 18 })).not.toMatch(/\d|people|sensor/i);
    expect([6, 13, 17, 21, 2].map(dayPartOf)).toEqual(["mornings", "afternoons", "evenings", "nights", "nights"]);
  });
});

describe("placesOpenByHour (the week planner's day comparison)", () => {
  it("sums the popularity of the places not known closed in each hour; empty with no places", () => {
    const places = [place("a", here, 0.5, 10, 14), place("b", here, 1, 12, 16), place("c", here, 0.4)];
    const hours = placesOpenByHour(places, "friday", 10, 17);
    expect(hours.map((h) => h.level)).toEqual([0.9, 0.9, 1.9, 1.9, 1.4, 1.4, 0.4]);
    expect(placesOpenByHour([], "friday", 10, 17)).toEqual([]);
  });

  it("counts a place with no popularity from Qloo as average (0.5)", () => {
    expect(placesOpenByHour([place("a", here, null, 10, 12), place("b", here, 1, 10, 11)], "friday", 10, 12).map((h) => h.level)).toEqual([1.5, 0.5]);
  });
});

describe("relativeActivity (the words read against the plan's own pitches)", () => {
  const levels = [0.14, 0.5, 0.76, 0.81, 0.92];
  it("scales between the least and the most active pitch scored, never above the absolute level", () => {
    expect(relativeActivity(0.92, levels)).toBe(0.92);
    expect(relativeActivity(0.14, levels)).toBe(0);
    expect(relativeActivity(0.5, levels)).toBeCloseTo((0.5 - 0.14) / 0.78);
  });
  it("live numbers (Melbourne, Sat 6-9 pm): the top three at 0.70, 0.70 and 0.68 in a pool topping out at 0.70 are not all Very busy", () => {
    const pool = [0.7, 0.7, 0.68, 0.66, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.33];
    const words = [0.7, 0.7, 0.68].map((l) => activityWord(relativeActivity(l, pool) ?? l));
    expect(words).toEqual(["Busy", "Busy", "Busy"]);
    expect(activityWord(relativeActivity(0.45, pool) ?? 0.45)).toBe("Fairly quiet");
    expect(activityWord(relativeActivity(0.33, pool) ?? 0.33)).toBe("Quiet");
  });
  it("is Very busy only when it is high in the pool and high in itself", () => {
    const pool = [0.95, 0.9, 0.5, 0.4, 0.3];
    expect(activityWord(relativeActivity(0.95, pool) ?? 0.95)).toBe("Very busy");
    expect(activityWord(relativeActivity(0.5, pool) ?? 0.5)).toBe("Fairly quiet");
  });
  it("is null with too few pitches or no spread, so the absolute level is used", () => {
    expect(relativeActivity(0.5, [0.5, 0.9])).toBeNull();
    expect(relativeActivity(0.9, [0.9, 0.91, 0.9, 0.9])).toBeNull();
  });
});
