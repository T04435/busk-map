import { describe, expect, it } from "vitest";
import {
  combine,
  DEFAULT_WEIGHTS,
  discoveryFactor,
  discoveryOf,
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
  it("taste: between the median and the best cell, weighted by distance", () => {
    expect(tasteFactor(here, [])).toBeNull();
    expect(tasteFactor(here, [{ ...here, affinity: 0 }])).toBe(0);
    expect(tasteFactor(here, [0.5, 0.5, 0.5, 0.5].map((affinity, i) => ({ ...offsetM(i * 100), affinity })))).toBe(1);
    expect(tasteFactor(here, [{ ...offsetM(2000), affinity: 0.9 }])).toBe(0);
    expect(tasteFactor(here, [{ ...here, affinity: 0.4 }, { ...offsetM(3000), affinity: 0.8 }])).toBeCloseTo(0.5);
    expect(tasteFactor(here, [{ ...here, affinity: 0.8 }])).toBe(1);
    // With four or more cells, the median cell scores 0 and the best 1.
    const city = [0.2, 0.4, 0.6, 1].map((affinity, i) => ({ ...offsetM(3000 * (i + 1)), affinity }));
    expect(tasteFactor(here, [{ ...here, affinity: 0.8 }, ...city])).toBeCloseTo(0.5);
    expect(tasteFactor(here, [{ ...here, affinity: 0.3 }, ...city])).toBe(0);
  });

  it("footfall: the nearest sensor, else nearby sensors, else Qloo popularity", () => {
    expect(footfallFactor(here, [])).toEqual({ value: null, sensor: null, source: null, estimatedHourly: null });
    expect(footfallFactor(here, [{ id: 1, name: "a", ...here, avgHourly: null }]).value).toBeNull();
    expect(footfallFactor(here, [{ id: 1, name: "very far", ...offsetM(900), avgHourly: 100 }]).value).toBeNull();
    expect(footfallFactor(here, [{ id: 1, name: "zero", ...here, avgHourly: 0 }]).value).toBe(0);
    const result = footfallFactor(here, [
      { id: 1, name: "near", ...offsetM(50), avgHourly: 99 },
      { id: 2, name: "nearer", ...offsetM(10), avgHourly: 999 },
      { id: 3, name: "busiest, far", ...offsetM(5000), avgHourly: 9999 },
    ]);
    expect(result).toMatchObject({ source: "sensor", sensor: { id: 2 }, estimatedHourly: null });
    expect(result.value).toBeCloseTo(Math.sqrt(999 / 9999));

    const estimate = footfallFactor(here, [
      { id: 1, name: "A", ...offsetM(300), avgHourly: 1000 },
      { id: 2, name: "B", ...offsetM(-500), avgHourly: 200 },
    ]);
    expect(estimate).toMatchObject({ source: "nearby-sensors", sensor: { id: 1 } });
    expect(estimate.estimatedHourly).toBe(Math.round((1000 / 300 + 200 / 500) / (1 / 300 + 1 / 500)));
    expect(estimate.value).toBeCloseTo(0.9 * Math.sqrt(estimate.estimatedHourly! / 1000), 2);

    const proxy = footfallFactor(here, [], undefined, [{ ...offsetM(100), affinity: 1, popularity: 0.5 }, { ...offsetM(400), affinity: 1, popularity: 0.9 }, { ...offsetM(50), affinity: 1 }]);
    expect(proxy).toEqual({ value: 0.4, sensor: null, source: "qloo-popularity", estimatedHourly: null });
    expect(footfallFactor(here, [], undefined, [{ ...offsetM(5000), affinity: 1, popularity: 0.5 }]).value).toBeNull();
  });

  it("discovery: hidden gems off the usual circuit, with a bonus for a strong fit", () => {
    expect(discoveryOf({ usualSpot: "Bourke St Mall" }, 1)).toBe("usual");
    expect(discoveryOf({ usualSpot: null }, 0.7)).toBe("hidden-gem");
    expect(discoveryOf({ usualSpot: null }, 0.5)).toBeNull();
    expect(discoveryOf({ usualSpot: null }, null)).toBeNull();
    expect(discoveryFactor("hidden-gem", 0.9)).toBe(0.9);
    expect(discoveryFactor("hidden-gem", 0.7)).toBe(0);
    expect(discoveryFactor("hidden-gem", null)).toBe(0);
    expect(discoveryFactor("usual", 1)).toBe(0);
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
    const all = { taste: 1, footfall: 0.5, places: 0, events: 0, weatherPenalty: null, discovery: 0 };
    const { score, contributions } = combine(all, DEFAULT_WEIGHTS);
    expect(score).toBeCloseTo((0.4 + 0.125) / 1);
    expect(contributions.taste).toBeCloseTo(0.4);
    expect(contributions.discovery).toBeNull();

    const missing = combine({ taste: 1, footfall: null, places: null, events: null, weatherPenalty: 0.5, discovery: 0 }, DEFAULT_WEIGHTS);
    expect(missing.score).toBeCloseTo(1 - 0.15);
    expect(missing.contributions.footfall).toBeNull();

    expect(combine({ taste: null, footfall: null, places: null, events: null, weatherPenalty: 1, discovery: 0 }, DEFAULT_WEIGHTS).score).toBe(0);
    expect(combine({ taste: 1, footfall: 1, places: 1, events: 1, weatherPenalty: null, discovery: 0 }, { ...DEFAULT_WEIGHTS, taste: 0 }).contributions.taste).toBeNull();
  });

  it("adds a modest discovery bonus for strong hidden gems", () => {
    const gem = combine({ taste: 0.9, footfall: 0.5, places: null, events: null, weatherPenalty: null, discovery: 0.9 }, DEFAULT_WEIGHTS);
    const plain = combine({ taste: 0.9, footfall: 0.5, places: null, events: null, weatherPenalty: null, discovery: 0 }, DEFAULT_WEIGHTS);
    expect(gem.score - plain.score).toBeCloseTo(0.08 * 0.9);
    expect(gem.contributions.discovery).toBeCloseTo(0.072);
  });
});

describe("ranking", () => {
  const candidate = (id: string, at: { lat: number; lon: number }, usualSpot: string | null = null): Candidate => ({
    id,
    name: id,
    ...at,
    kind: "footpath",
    origin: "taste",
    cell: null,
    usualSpot,
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

    expect(pitch).toMatchObject({ discovery: "hidden-gem", footfallSource: "sensor" });
    expect(pitch.factors.discovery).toBe(1);
    const usual = scorePitch(candidate("u", here, "Famous corner"), inputs, DEFAULT_WEIGHTS);
    expect(usual).toMatchObject({ discovery: "usual", factors: { discovery: 0 } });
    // The crowd at a usual spot is shared with other buskers.
    expect(usual.factors.footfall).toBeCloseTo(pitch.factors.footfall! * 0.85);

    const noPlaces = scorePitch(candidate("b", offsetM(1000)), { ...inputs, places: [], weather: null }, DEFAULT_WEIGHTS);
    expect(noPlaces.factors.places).toBeNull();
    expect(noPlaces.evidence.sensor).toBeNull();
    expect(noPlaces.discovery).toBeNull();

    const estimated = scorePitch(candidate("c", offsetM(400)), { ...inputs, places: [] }, DEFAULT_WEIGHTS);
    expect(estimated.footfallSource).toBe("nearby-sensors");
    expect(estimated.evidence.sensor).toEqual({ id: 1, name: "S", avgHourly: 1000 });
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
