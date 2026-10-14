import { describe, expect, it } from "vitest";
import {
  combine,
  DEFAULT_WEIGHTS,
  eventsFactor,
  footfallFactor,
  normalizeWeights,
  openDuring,
  pickTopPitches,
  placesFactor,
  rankPitches,
  scorePitch,
  tasteFactor,
  weatherPenalty,
  WEIGHT_LABELS,
} from "@/server/scoring";
import type { Candidate, EventInput, PlaceInput, ScoreInputs } from "@/server/scoring";

const here = { lat: -37.815, lon: 144.965 };
const offsetM = (m: number) => ({ lat: here.lat + m / 111_195, lon: here.lon });

describe("weights", () => {
  it("clamps and fills from defaults", () => {
    expect(normalizeWeights(undefined)).toEqual(DEFAULT_WEIGHTS);
    expect(normalizeWeights({ taste: 2, footfall: -1, places: Number.NaN, events: 0.5 })).toEqual({
      ...DEFAULT_WEIGHTS,
      taste: 1,
      footfall: 0,
      events: 0.5,
    });
    expect(Object.keys(WEIGHT_LABELS).sort()).toEqual(Object.keys(DEFAULT_WEIGHTS).sort());
  });
});

describe("openDuring", () => {
  it("reads object and string hour formats", () => {
    expect(openDuring({ saturday: [{ opens: "T10:00", closes: "T17:00" }] }, "saturday", 18, 21)).toBe("closed");
    expect(openDuring({ Saturday: [{ opens: "T16:00", closes: "T23:30" }] }, "saturday", 18, 21)).toBe("open");
    expect(openDuring({ saturday: ["17:00-02:00"] }, "saturday", 22, 24)).toBe("open");
    expect(openDuring({ saturday: ["09:00–12:00", "13:00-15:00"] }, "saturday", 18, 21)).toBe("closed");
  });

  it("is unknown when it can't tell", () => {
    expect(openDuring(null, "saturday", 18, 21)).toBe("unknown");
    expect(openDuring({ monday: [] }, "saturday", 18, 21)).toBe("unknown");
    expect(openDuring({ saturday: "always" }, "saturday", 18, 21)).toBe("unknown");
    expect(openDuring({ saturday: [{ opens: 10, closes: "T17:00" }] }, "saturday", 18, 21)).toBe("unknown");
    expect(openDuring({ saturday: ["late"] }, "saturday", 18, 21)).toBe("unknown");
    expect(openDuring({ saturday: [42] }, "saturday", 18, 21)).toBe("unknown");
  });
});

describe("factors", () => {
  it("taste: relative to the best cell, weighted by distance", () => {
    expect(tasteFactor(here, [])).toBeNull();
    expect(tasteFactor(here, [{ ...here, affinity: 0 }])).toBe(0);
    expect(tasteFactor(here, [{ ...offsetM(2000), affinity: 0.9 }])).toBe(0);
    expect(tasteFactor(here, [{ ...here, affinity: 0.4 }, { ...offsetM(3000), affinity: 0.8 }])).toBeCloseTo(0.5);
    expect(tasteFactor(here, [{ ...here, affinity: 0.8 }])).toBe(1);
  });

  it("footfall: nearest sensor in range, log-scaled", () => {
    expect(footfallFactor(here, [])).toEqual({ value: null, sensor: null });
    expect(footfallFactor(here, [{ id: 1, name: "a", ...here, avgHourly: null }]).value).toBeNull();
    expect(footfallFactor(here, [{ id: 1, name: "far", ...offsetM(500), avgHourly: 100 }]).value).toBeNull();
    expect(footfallFactor(here, [{ id: 1, name: "zero", ...here, avgHourly: 0 }]).value).toBe(0);
    const result = footfallFactor(here, [
      { id: 1, name: "near", ...offsetM(50), avgHourly: 99 },
      { id: 2, name: "nearer", ...offsetM(10), avgHourly: 999 },
      { id: 3, name: "busiest, far", ...offsetM(5000), avgHourly: 9999 },
    ]);
    expect(result.sensor?.id).toBe(2);
    expect(result.value).toBeCloseTo(Math.log1p(999) / Math.log1p(9999));
  });

  it("places: open popular places nearby, saturating", () => {
    const places: PlaceInput[] = [
      { id: "a", name: "Open bar", ...offsetM(10), popularity: 0.9, hours: { saturday: ["16:00-23:00"] } },
      { id: "b", name: "Closed cafe", ...offsetM(20), popularity: 1, hours: { saturday: ["07:00-15:00"] } },
      { id: "c", name: "Unknown hours", ...offsetM(100), popularity: null, hours: null },
      { id: "d", name: "Too far", ...offsetM(400), popularity: 1, hours: null },
    ];
    const result = placesFactor(here, places, "saturday", 18, 21);
    expect(result.nearby.map((p) => p.id)).toEqual(["a", "c"]);
    expect(result.nearby[1]).toMatchObject({ open: "unknown", distanceM: 100 });
    expect(result.value).toBeGreaterThan(0.4);
    expect(result.value).toBeLessThan(1);
    expect(placesFactor(here, [], "saturday", 18, 21).value).toBe(0);
  });

  it("events: crowds arriving or leaving during the slot", () => {
    const slotStart = Date.parse("2026-10-17T07:00:00Z");
    const slotEnd = Date.parse("2026-10-17T10:00:00Z");
    const ev = (id: string, startIso: string, endIso: string, distance = 100): EventInput => ({
      id,
      name: id,
      venue: { name: "V", ...offsetM(distance) },
      start: startIso,
      end: endIso,
      endEstimated: true,
    });
    const leaving = eventsFactor(here, [ev("leave", "2026-10-17T05:00:00Z", "2026-10-17T08:00:00Z")], slotStart, slotEnd);
    expect(leaving.nearby[0].moment).toBe("leaving");
    expect(leaving.value).toBeCloseTo(1 - 100 / 800);

    const arriving = eventsFactor(here, [ev("arrive", "2026-10-17T10:30:00Z", "2026-10-17T13:00:00Z")], slotStart, slotEnd);
    expect(arriving.nearby[0].moment).toBe("arriving");
    expect(arriving.value).toBeCloseTo(0.7 * (1 - 100 / 800));

    const none = eventsFactor(
      here,
      [ev("far", "2026-10-17T05:00:00Z", "2026-10-17T08:00:00Z", 2000), ev("other time", "2026-10-17T01:00:00Z", "2026-10-17T02:00:00Z")],
      slotStart,
      slotEnd,
    );
    expect(none).toEqual({ value: 0, nearby: [] });
  });

  it("weather: rain, wind and cold", () => {
    expect(weatherPenalty(null)).toBeNull();
    expect(weatherPenalty([])).toBeNull();
    expect(weatherPenalty([{ precipitationProbability: null, windKmh: null, temperatureC: null }])).toBe(0);
    expect(weatherPenalty([{ precipitationProbability: 100, windKmh: 50, temperatureC: 0 }])).toBeCloseTo(1);
    expect(weatherPenalty([{ precipitationProbability: 50, windKmh: 10, temperatureC: 20 }, { precipitationProbability: 0, windKmh: 10, temperatureC: 20 }])).toBeCloseTo(0.175);
  });
});

describe("combine", () => {
  it("drops missing factors and zero weights from the mean, then subtracts the weather penalty", () => {
    const all = { taste: 1, footfall: 0.5, places: 0, events: 0, weatherPenalty: null };
    const { score, contributions } = combine(all, DEFAULT_WEIGHTS);
    expect(score).toBeCloseTo((0.35 + 0.15) / 1);
    expect(contributions.taste).toBeCloseTo(0.35);

    const missing = combine({ taste: 1, footfall: null, places: null, events: null, weatherPenalty: 0.5 }, DEFAULT_WEIGHTS);
    expect(missing.score).toBeCloseTo(1 - 0.15);
    expect(missing.contributions.footfall).toBeNull();

    expect(combine({ taste: null, footfall: null, places: null, events: null, weatherPenalty: 1 }, DEFAULT_WEIGHTS).score).toBe(0);
    expect(combine({ taste: 1, footfall: 1, places: 1, events: 1, weatherPenalty: null }, { ...DEFAULT_WEIGHTS, taste: 0 }).contributions.taste).toBeNull();
  });
});

describe("ranking", () => {
  const candidate = (id: string, at: { lat: number; lon: number }): Candidate => ({
    id,
    name: id,
    ...at,
    kind: "footpath",
    amplification: "allowed",
    permit: "general",
    rules: "",
    rulesUrl: null,
    cautions: [],
  });
  const inputs: ScoreInputs = {
    cells: [{ ...here, affinity: 1 }, { ...offsetM(1000), affinity: 0.2 }],
    sensors: [{ id: 1, name: "S", ...here, avgHourly: 1000 }],
    places: [{ id: "p", name: "P", ...here, popularity: 1, hours: null }],
    events: [],
    weather: [{ precipitationProbability: 0, windKmh: 5, temperatureC: 20 }],
    weekday: "saturday",
    startHour: 18,
    endHour: 21,
    slotStartMs: 0,
    slotEndMs: 1,
  };

  it("scores with evidence", () => {
    const pitch = scorePitch(candidate("a", here), inputs, DEFAULT_WEIGHTS);
    expect(pitch.score).toBeGreaterThan(60);
    expect(pitch.evidence.sensor).toEqual({ id: 1, name: "S", avgHourly: 1000 });
    expect(pitch.evidence.places[0].id).toBe("p");
    expect(pitch.factors.weatherPenalty).toBe(0);

    const noPlaces = scorePitch(candidate("b", offsetM(1000)), { ...inputs, places: [], weather: null }, DEFAULT_WEIGHTS);
    expect(noPlaces.factors.places).toBeNull();
    expect(noPlaces.evidence.sensor).toBeNull();
  });

  it("ranks best first with stable ties, and picks spread-out pitches", () => {
    const ranked = rankPitches(
      [candidate("far", offsetM(1000)), candidate("b-here", here), candidate("a-here", here), candidate("close", offsetM(100))],
      inputs,
      DEFAULT_WEIGHTS,
    );
    expect(ranked.map((p) => p.id).slice(0, 2)).toEqual(["a-here", "b-here"]);
    expect(pickTopPitches(ranked, 2).map((p) => p.id)).toEqual(["a-here", "far"]);
    expect(pickTopPitches(ranked, 1).map((p) => p.id)).toEqual(["a-here"]);
    expect(pickTopPitches(ranked, 3, 0)).toHaveLength(3);
  });
});
