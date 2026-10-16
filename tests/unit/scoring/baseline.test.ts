import { describe, expect, it } from "vitest";
import {
  candidateAt,
  compareWithBaseline,
  DEFAULT_WEIGHTS,
  locate,
  comparisonRecord,
  MATCH_RADIUS_M,
  rankPitches,
  pickTopPitches,
  type BaselineInputs,
  type Candidate,
  type KnownPlace,
  type ScoreInputs,
} from "@/server/scoring";

const here = { lat: -37.815, lon: 144.965 };
const north = (m: number) => ({ lat: here.lat + m / 111_195, lon: here.lon });
const area = { south: -37.83, west: 144.93, north: -37.79, east: 144.99 };

const places: KnownPlace[] = [
  { name: "City Square", ...north(0) },
  { name: "Bourke Street Mall", ...north(1000), aliases: [/bourke\s+st(reet)?(\s+mall)?/i] },
  { name: "Degraves Street", ...north(2000) },
  { name: "Mall", ...north(2500) },
];

describe("locate (plain-AI spot → a place Busk Map knows)", () => {
  it("matches by name, preferring the longest known name, then by alias", () => {
    expect(locate({ name: "City Square, Swanston St", why: "" }, places, area)).toMatchObject({ via: "name", place: "City Square" });
    expect(locate({ name: "Degraves St", why: "" }, places, area)).toMatchObject({ via: "name", place: "Degraves Street" });
    expect(locate({ name: "Bourke St, near Myer", why: "" }, places, area)).toMatchObject({ via: "name", place: "Bourke Street Mall" });
    // The exact name beats a longer name that contains it.
    expect(locate({ name: "Bourke Street Mall", why: "" }, [...places, { name: "Sensor: Bourke St Mall (North)", ...north(1200) }], area)).toMatchObject({ place: "Bourke Street Mall" });
    expect(locate({ name: "Degraves", why: "" }, places, area)).toMatchObject({ place: "Degraves Street" });
    // Short names never match by containment.
    expect(locate({ name: "A mall", why: "" }, places, area)).toBeNull();
  });

  it("falls back to the model's coordinates inside the planning area, else no data", () => {
    expect(locate({ name: "Somewhere new", why: "", ...north(300) }, places, area)).toMatchObject({ via: "coordinates", place: null });
    expect(locate({ name: "Somewhere far", why: "", lat: -33.86, lon: 151.21 }, places, area)).toBeNull();
    expect(locate({ name: "Somewhere vague", why: "", lat: null, lon: null }, places, area)).toBeNull();
  });
});

const candidate = (id: string, at: { lat: number; lon: number }, extra: Partial<Candidate> = {}): Candidate => ({
  id,
  name: id,
  ...at,
  kind: "public-space",
  origin: "taste",
  cell: null,
  usualSpot: null,
  amplification: "allowed",
  permit: "general",
  rules: "",
  rulesUrl: null,
  cautions: [],
  ...extra,
});

const scoreInputs: ScoreInputs = {
  // Taste is strongest at "here" and fades north.
  cells: [0, 400, 800, 1200, 1600, 2000, 2400].map((m, i) => ({ ...north(m), affinity: 1 - i * 0.15 })),
  sensors: [{ id: 1, name: "Sensor", ...north(1000), avgHourly: 3000 }],
  places: [],
  events: [],
  weather: null,
  weekday: "saturday",
  startHour: 18,
  endHour: 21,
  slotStartMs: 0,
  slotEndMs: 1,
};

function inputs(): BaselineInputs {
  const ranked = rankPitches(
    [candidate("square", north(0)), candidate("lane", north(400)), candidate("corner", north(800)), candidate("mall", north(1000))],
    scoreInputs,
    DEFAULT_WEIGHTS,
  );
  return {
    top: pickTopPitches(ranked, 2, 0),
    ranked,
    places,
    area,
    legality: { sites: [], zones: [{ id: "z", kind: "no-busking", lines: [[north(1990), north(2010)]] }], hotspots: [], permit: "general" },
    scoreInputs,
    weights: DEFAULT_WEIGHTS,
  };
}

describe("compareWithBaseline", () => {
  it("sorts the plain AI's spots into both agree, only Busk Map and only plain AI", () => {
    const base = inputs();
    const [first, second] = base.top;
    const result = compareWithBaseline(
      [
        { name: "City Square", why: "central" }, // matches our top pick by name
        { name: "City Square again", why: "dupe", ...north(20) }, // same pitch: one agreement only
        { name: "Bourke St Mall", why: "busy" }, // a scored candidate outside our top
        { name: "A brand new corner", why: "new", ...north(1500) }, // scored as its own spot
        { name: "Degraves St", why: "laneway" }, // ruled out by a no-busking line
        { name: "Narnia", why: "?" }, // can't place it
      ],
      base,
    );
    expect(result.bothAgree).toEqual([{ pitchId: first.id, plainName: "City Square" }]);
    expect(result.onlyBuskMap).toEqual([second.id]);
    expect(result.onlyPlainAi.map((p) => [p.name, p.status])).toEqual([
      ["Bourke St Mall", "scored"],
      ["A brand new corner", "scored"],
      ["Degraves St", "not-legal"],
      ["Narnia", "no-data"],
    ]);
    const mall = result.picks[2];
    expect(mall).toMatchObject({ pitchId: "mall", pitchName: "mall", score: base.ranked.find((p) => p.id === "mall")!.score });
    const own = result.picks[3];
    expect(own.pitchId).toBeNull();
    expect(own.score).toBeGreaterThanOrEqual(0);
    expect(result.picks[0]).toMatchObject({ status: "ours", pitchId: first.id, score: first.score, beatsOurs: false });
  });

  it("any time: the plain AI's own spot is scored by the caller's best-window scorer, and a spot ruled out stays not-legal", () => {
    const base = inputs();
    const scoreCandidate = (c: Candidate) => ({ ...rankPitches([c], base.scoreInputs!, base.weights)[0], score: 77 });
    const result = compareWithBaseline(
      [
        { name: "A brand new corner", why: "new", ...north(1500) },
        { name: "Degraves St", why: "laneway" },
      ],
      { ...base, scoreInputs: undefined, scoreCandidate },
    );
    expect(result.picks.map((p) => [p.status, p.score])).toEqual([["scored", 77], ["not-legal", null]]);
  });

  it("says plainly when the plain AI's spot scores higher than one of Busk Map's picks", () => {
    const base = inputs();
    // Pretend our picks were the two weakest: the square now beats them.
    const weakest = [...base.ranked].sort((a, b) => a.score - b.score).slice(0, 2);
    const result = compareWithBaseline([{ name: "City Square", why: "" }], { ...base, top: weakest });
    expect(result.picks[0]).toMatchObject({ status: "scored", beatsOurs: true });
    // The square is far from both weak picks, so spacing isn't why it was left out.
    expect(result.picks[0].tooCloseTo).toBeNull();
    expect(compareWithBaseline([{ name: "City Square", why: "" }], { ...base, top: [] }).picks[0].beatsOurs).toBe(false);
  });

  it("says when a higher-scored spot was left out for being within 250 m of a pick (B-002)", () => {
    const base = inputs();
    const lane = base.ranked.find((p) => p.id === "lane")!;
    const corner = base.ranked.find((p) => p.id === "corner")!;
    // Our picks: the lane (400 m north) and the corner (800 m, its score forced to 0). A new spot 600 m north
    // beats the corner and is 200 m from both: the first (best) pick is the one it is too close to.
    const result = compareWithBaseline([{ name: "Near the lane", why: "", ...north(600) }], { ...base, top: [lane, { ...corner, score: 0 }] });
    expect(result.picks[0]).toMatchObject({ status: "scored", beatsOurs: true, tooCloseTo: "lane" });
    // Not higher than any pick: no spacing note.
    const none = compareWithBaseline([{ name: "Near the lane", why: "", ...north(600) }], { ...base, top: [{ ...lane, score: 100 }] });
    expect(none.picks[0]).toMatchObject({ beatsOurs: false, tooCloseTo: null });
  });

  it("matches a place within MATCH_RADIUS_M only", () => {
    const base = inputs();
    const near = compareWithBaseline([{ name: "Just off it", why: "", ...north(MATCH_RADIUS_M - 20) }], base);
    expect(near.picks[0].status).toBe("ours");
  });

  it("never changes a score: agreement is a badge, the engine's ranking is untouched", () => {
    const base = inputs();
    const before = JSON.stringify(base.ranked);
    const topBefore = base.top.map((p) => [p.id, p.score]);
    compareWithBaseline([{ name: "City Square", why: "" }, { name: "Bourke St Mall", why: "" }], base);
    expect(JSON.stringify(base.ranked)).toBe(before);
    expect(base.top.map((p) => [p.id, p.score])).toEqual(topBefore);
    // The same engine run without any baseline gives the same scores.
    const again = rankPitches(base.ranked.map((p) => candidate(p.id, p)), scoreInputs, DEFAULT_WEIGHTS);
    expect(again.map((p) => [p.id, p.score])).toEqual(base.ranked.map((p) => [p.id, p.score]));
  });

  it("records one comparison with the overlap and every pick's score, and no names", () => {
    const base = inputs();
    const result = compareWithBaseline([{ name: "City Square", why: "" }, { name: "Narnia", why: "" }], base);
    const record = comparisonRecord(result, base.top, "acoustic", "melbourne", "2026-10-17 18-21");
    expect(record).toEqual({
      performerKey: "acoustic",
      city: "melbourne",
      slot: "2026-10-17 18-21",
      overlap: 1,
      ours: base.top.map((p, i) => ({ pitchId: p.id, score: p.score, agreed: i === 0 })),
      plain: [
        { status: "ours", score: base.top[0].score, pitchId: base.top[0].id },
        { status: "no-data", score: null, pitchId: null },
      ],
    });
    expect(JSON.stringify(record)).not.toMatch(/City Square|Narnia/);
  });
});

describe("candidateAt", () => {
  it("builds a general-permit candidate at a point the layers allow, flags unamplified zones and hotspots", () => {
    const legality = {
      sites: [{ id: "p", name: "Private", ...north(500), permit: "private" as const, musicAllowed: null, rules: "", rulesUrl: null }],
      zones: [{ id: "u", kind: "unamplified" as const, lines: [[north(-10), north(10)]] }],
      hotspots: [{ name: "Hot", ...here }],
      permit: "general" as const,
    };
    const spot = candidateAt({ id: "b", name: "Spot", ...here }, legality)!;
    expect(spot).toMatchObject({ kind: "public-space", origin: "fallback", amplification: "unamplified-zone", usualSpot: "Hot" });
    expect(spot.cautions).toContain("Unamplified busking only.");
    expect(candidateAt({ id: "c", name: "Private", ...north(500) }, legality)).toBeNull();
    expect(candidateAt({ id: "d", name: "Open", ...north(1000) }, legality)).toMatchObject({ amplification: "allowed", usualSpot: null });
  });
});
