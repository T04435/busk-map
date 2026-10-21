import { describe, expect, it } from "vitest";
import {
  combine,
  DEFAULT_WEIGHTS,
  discoveryFactor,
  discoveryOf,
  eventsFactor,
  normalizeWeights,
  openDuring,
  pickTopPitches,
  MIN_PITCH_SPACING_M,
  skippedForSpacing,
  tooCloseTo,
  rankPitches,
  scorePitch,
  tasteFactor,
  isFineHeatmap,
  weatherPenalty,
  WEIGHT_LABELS,
} from "@/server/scoring";
import type { Candidate, EventInput, ScoreInputs } from "@/server/scoring";

const here = { lat: -37.815, lon: 144.965 };
const offsetM = (m: number) => ({ lat: here.lat + m / 111_195, lon: here.lon });

describe("weights", () => {
  it("clamps and fills from defaults", () => {
    expect(normalizeWeights(undefined)).toEqual(DEFAULT_WEIGHTS);
    expect(normalizeWeights({ taste: 2, activity: -1, events: 0.5, weather: Number.NaN })).toEqual({
      ...DEFAULT_WEIGHTS,
      taste: 1,
      activity: 0,
      events: 0.5,
    });
    expect(Object.keys(WEIGHT_LABELS).sort()).toEqual(Object.keys(DEFAULT_WEIGHTS).sort());
  });

  it("sums to the weights it replaced: activity is foot traffic 0.25 plus busy places 0.20", () => {
    expect(DEFAULT_WEIGHTS.taste + DEFAULT_WEIGHTS.activity + DEFAULT_WEIGHTS.events).toBeCloseTo(1);
    expect(DEFAULT_WEIGHTS.activity).toBeCloseTo(0.25 + 0.2);
  });

  it("reads a request saved before the activity estimate: footfall and places together are the activity weight", () => {
    expect(normalizeWeights({ taste: 0.5, footfall: 0.2 }).activity).toBeCloseTo(0.2 + 0.2);
    expect(normalizeWeights({ footfall: 0.3, places: 0.1 }).activity).toBeCloseTo(0.4);
    expect(normalizeWeights({ footfall: 1, places: 1 }).activity).toBe(1);
    // Only places saved: footfall falls back to its legacy default.
    expect(normalizeWeights({ places: 0.3 }).activity).toBeCloseTo(0.25 + 0.3);
    // An explicit activity weight wins.
    expect(normalizeWeights({ activity: 0.1, footfall: 0.9 }).activity).toBe(0.1);
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

  // Synthetic hours in the live Qloo shape: lowercase days, "THH:MM:SS", a closed flag.
  const live = (opens: string | null, closes: string | null, closed = false) => [{ opens, closes, closed }];

  it("reads the live shape, including closing past midnight", () => {
    const bar = { friday: live("T18:00:00", "T05:00:00"), saturday: live("T12:00:00", "T02:00:00"), sunday: live(null, null, true) };
    // Saturday 12:00 to 02:00 (Sunday): open in the evening and late.
    expect(openDuring(bar, "saturday", 18, 21)).toBe("open");
    expect(openDuring(bar, "saturday", 22, 24)).toBe("open");
    // Saturday morning before 12:00 is still Friday's night (18:00 to 05:00).
    expect(openDuring(bar, "saturday", 3, 5)).toBe("open");
    expect(openDuring(bar, "saturday", 6, 11)).toBe("closed");
    // Sunday is closed, but Saturday's range runs to 02:00 Sunday.
    expect(openDuring(bar, "sunday", 0, 1)).toBe("open");
    expect(openDuring(bar, "sunday", 12, 15)).toBe("closed");
    // Friday morning: Thursday has no hours, so only Friday's own range counts.
    expect(openDuring(bar, "friday", 9, 12)).toBe("closed");
  });

  it("treats equal opening and closing times as open all day, and reads several ranges", () => {
    expect(openDuring({ monday: live("T00:00:00", "T00:00:00") }, "monday", 3, 4)).toBe("open");
    const split = { tuesday: [...live("T07:00:00", "T11:00:00"), ...live("T17:00:00", "T23:00:00")] };
    expect(openDuring(split, "tuesday", 12, 15)).toBe("closed");
    expect(openDuring(split, "tuesday", 18, 21)).toBe("open");
    expect(openDuring({ wednesday: live("T09:00:00", "T17:00:00") }, "Wednesday", 16, 18)).toBe("open");
  });

  it("handles an unrecognised weekday name and a day with a bad range", () => {
    expect(openDuring({ funday: live("T09:00:00", "T17:00:00") }, "funday", 10, 12)).toBe("open");
    expect(openDuring({ monday: live("T09:00:00", null) }, "monday", 10, 12)).toBe("unknown");
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

  it("taste: reads a fine-grained (geohash-7) heatmap over a tighter radius", () => {
    // A strong cell 500 m away counts for a geohash-6 map but not for a geohash-7 one.
    const cells = (geohash: string) => [
      { ...here, affinity: 0.2, geohash },
      { ...offsetM(500), affinity: 1, geohash },
      ...[0.1, 0.2, 0.3].map((affinity, i) => ({ ...offsetM(3000 * (i + 1)), affinity, geohash })),
    ];
    expect(tasteFactor(here, cells("r1r0fs"))).toBeGreaterThan(0);
    expect(tasteFactor(here, cells("r1r0fs1"))).toBe(0);
    expect(isFineHeatmap(cells("r1r0fs1"))).toBe(true);
    expect(isFineHeatmap(cells("r1r0fs"))).toBe(false);
    expect(isFineHeatmap([{ geohash: null }, {}])).toBe(false);
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

    // An event crowd counts in proportion to how well its headliner's fans match the performer's taste (Qloo).
    const matched = eventsFactor(here, [{ ...ev("leave", "2026-10-17T05:00:00Z", "2026-10-17T08:00:00Z"), tasteMatch: { artist: "Erykah Badu", affinity: 0.9 } }], slotStart, slotEnd);
    expect(matched.value).toBeCloseTo(0.9 * (1 - 100 / 800));
    expect(matched.nearby[0].tasteMatch).toEqual({ artist: "Erykah Badu", affinity: 0.9 });
    const unknown = eventsFactor(here, [{ ...ev("leave", "2026-10-17T05:00:00Z", "2026-10-17T08:00:00Z"), tasteMatch: null }], slotStart, slotEnd);
    expect(unknown.value).toBeCloseTo(1 - 100 / 800);
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
    const all = { taste: 1, activity: 0.5, events: 0, weatherPenalty: null, discovery: 0 };
    const { score, contributions } = combine(all, DEFAULT_WEIGHTS);
    expect(score).toBeCloseTo((0.4 + 0.225) / 1);
    expect(contributions.taste).toBeCloseTo(0.4);
    expect(contributions.activity).toBeCloseTo(0.225);
    expect(contributions.discovery).toBeNull();

    const missing = combine({ taste: 1, activity: null, events: null, weatherPenalty: 0.5, discovery: 0 }, DEFAULT_WEIGHTS);
    expect(missing.score).toBeCloseTo(1 - 0.15);
    expect(missing.contributions.activity).toBeNull();

    expect(combine({ taste: null, activity: null, events: null, weatherPenalty: 1, discovery: 0 }, DEFAULT_WEIGHTS).score).toBe(0);
    expect(combine({ taste: 1, activity: 1, events: 1, weatherPenalty: null, discovery: 0 }, { ...DEFAULT_WEIGHTS, taste: 0 }).contributions.taste).toBeNull();
  });

  it("adds a modest discovery bonus for strong hidden gems", () => {
    const gem = combine({ taste: 0.9, activity: 0.5, events: null, weatherPenalty: null, discovery: 0.9 }, DEFAULT_WEIGHTS);
    const plain = combine({ taste: 0.9, activity: 0.5, events: null, weatherPenalty: null, discovery: 0 }, DEFAULT_WEIGHTS);
    expect(gem.score - plain.score).toBeCloseTo(0.08 * 0.9);
    expect(gem.contributions.discovery).toBeCloseTo(0.072);
  });
});

describe("ranking", () => {
  const candidate = (id: string, at: { lat: number; lon: number }, usualSpot: string | null = null): Candidate => ({
    id,
    name: id,
    ...at,
    kind: "public-space",
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
    // One popular place open at the pitch: the venue part alone (the heatmap has no popularity here).
    expect(pitch.activityBasis).toBe("places");
    expect(pitch.evidence.activity.area).toBeNull();
    expect(pitch.evidence.activity.venues).toBeCloseTo(1 - Math.exp(-1 / 1.5));
    expect(pitch.factors.activity).toBeCloseTo(1 - Math.exp(-1 / 1.5));
    expect(pitch.evidence.places[0].id).toBe("p");
    expect(pitch.factors.weatherPenalty).toBe(0);

    expect(pitch).toMatchObject({ discovery: "hidden-gem" });
    expect(pitch.factors.discovery).toBe(1);
    const usual = scorePitch(candidate("u", here, "Famous corner"), inputs, DEFAULT_WEIGHTS);
    expect(usual).toMatchObject({ discovery: "usual", factors: { discovery: 0 } });
    // The crowd at a usual spot is shared with other buskers.
    expect(usual.factors.activity).toBeCloseTo(pitch.factors.activity! * 0.85);

    // Nothing from Qloo to estimate from (no places, no cell popularity): the factor is unknown, not zero, and says so.
    const noPlaces = scorePitch(candidate("b", offsetM(1000)), { ...inputs, places: [], weather: null }, DEFAULT_WEIGHTS);
    expect(noPlaces.factors.activity).toBeNull();
    expect(noPlaces.activityBasis).toBe("none");
    expect(noPlaces.contributions.activity).toBeNull();
    expect(noPlaces.discovery).toBeNull();

    // Heatmap popularity alone: where activity concentrates, with no hours to vary it.
    const popular = { ...inputs, places: [], cells: [{ ...here, affinity: 1, popularity: 0.6 }, { ...offsetM(1000), affinity: 0.2 }] };
    const heat = scorePitch(candidate("c", offsetM(100)), popular, DEFAULT_WEIGHTS);
    expect(heat.activityBasis).toBe("heatmap");
    expect(heat.factors.activity).toBeCloseTo(0.6);
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

  it("names the higher-scored pitches the 250 m spacing left out, and the pick each is too close to (B-002)", () => {
    const ranked = rankPitches(
      [candidate("far", offsetM(1000)), candidate("b-here", here), candidate("a-here", here), candidate("close", offsetM(100))],
      inputs,
      DEFAULT_WEIGHTS,
    );
    expect(MIN_PITCH_SPACING_M).toBe(250);
    const picks = pickTopPitches(ranked, 2);
    expect(picks.map((p) => p.id)).toEqual(["a-here", "far"]);
    const skipped = skippedForSpacing(ranked, picks);
    // Everything ranked above "far" except the pick itself sits within 250 m of "a-here".
    const above = ranked.slice(0, ranked.findIndex((p) => p.id === "far")).filter((p) => p.id !== "a-here");
    expect([...skipped.keys()].sort()).toEqual(above.map((p) => p.id).sort());
    expect(above.length).toBeGreaterThan(0);
    for (const pick of skipped.values()) expect(pick.id).toBe("a-here");
    // Pitches ranked below the lowest pick were simply scored lower: not marked.
    expect(skipped.has("far")).toBe(false);
    expect(skippedForSpacing(ranked, [])).toEqual(new Map());
    expect(skippedForSpacing(ranked, picks, 0)).toEqual(new Map());

    expect(tooCloseTo(offsetM(100), picks)?.id).toBe("a-here");
    expect(tooCloseTo(offsetM(600), picks)).toBeNull();
    expect(tooCloseTo(offsetM(600), picks, 700)?.id).toBe("a-here");
  });

  it("ignores a tip history in the inputs: the score has no personal bonus", () => {
    const history = { source: "yours" as const, sessions: 4, perHour: 20, pitches: [{ id: "far", sessions: 3, perHour: 40 }] };
    const plain = scorePitch(candidate("far", offsetM(1000)), inputs, DEFAULT_WEIGHTS);
    const withHistory = scorePitch(candidate("far", offsetM(1000)), { ...inputs, history } as typeof inputs, DEFAULT_WEIGHTS);
    expect(withHistory.score).toBe(plain.score);
    expect(withHistory).not.toHaveProperty("tip");
  });
});
