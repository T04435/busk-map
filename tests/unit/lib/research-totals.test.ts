import { describe, expect, it } from "vitest";
import { fromEngine, fromToolOutputs, researchTotalsSchema, ZERO_TOTALS, type ToolResult } from "@/lib/research-totals";
import { planSchema } from "@/lib/plan-schema";

/** Research totals (the ResearchFunnel): counted from the agent's tool outputs, or the engine's data. */
const ok = (tool: string, output: unknown): ToolResult => ({ tool, ok: true, output });

const run: ToolResult[] = [
  ok("taste_map", { summary: "", signals: ["Ed Sheeran", "Vance Joy"], area: "planning area", cells: 42, strongest: [] }),
  // The same map again (signals in another order): counted once.
  ok("taste_map", { summary: "", signals: ["Vance Joy", "Ed Sheeran"], area: "planning area", cells: 42, strongest: [] }),
  ok("taste_map", { summary: "", signals: ["Ed Sheeran"], area: { around: "Federation Square", radiusM: 800 }, cells: 9, strongest: [] }),
  ok("crowd_at", { at: { label: "Fed Sq", lat: -37.818, lon: 144.969 }, radiusM: 400, artists: [{ name: "A" }], genres: [] }),
  ok("crowd_at", { at: { label: "Fed Sq", lat: -37.818, lon: 144.969 }, radiusM: 400, artists: [{ name: "A" }], genres: [] }),
  ok("crowd_at", { at: { label: "Fed Sq", lat: -37.818, lon: 144.969 }, radiusM: 800, artists: [{ name: "B" }], genres: [] }),
  ok("crowd_at", { at: { label: "Empty", lat: -37.81, lon: 144.96 }, radiusM: 400, artists: [], genres: [] }),
  ok("busy_places", { places: [{ name: "Young & Jackson", open: "open" }, { name: "ACMI", open: "unknown" }] }),
  ok("busy_places", { places: [{ name: "young & jackson", open: "open" }, { name: "Arts Centre", open: "open" }] }),
  ok("events_near", { events: [{ name: "Gig", venue: "Forum", starts: "7:00 pm", ends: "10:00 pm" }, { name: "Gig", venue: "Forum", starts: "9:00 pm" }] }),
  ok("events_near", { events: [{ name: "Gig", venue: "Forum", starts: "7:00 pm" }] }),
  ok("footfall_at", { sensors: [{ sensor: "Flinders St", peopleThisHour: 1200 }, { sensor: "Swanston St", peopleThisHour: null }] }),
  ok("footfall_at", { sensors: [{ sensor: "Flinders St", peopleThisHour: 900 }, { sensor: "Elizabeth St", peopleThisHour: 300 }] }),
  ok("check_pitch", { pitchId: "spot:city-square", name: "City Square", legal: "not ruled out", inPool: true }),
  ok("check_pitch", { pitchId: "spot:city-square", name: "City Square", legal: "not ruled out", inPool: true }),
  ok("check_pitch", { pitchId: null, name: "Bourke St", legal: "ruled out", inPool: false }),
  ok("check_pitch", { pitchId: null, name: "Nowhere", legal: "unknown", inPool: false }),
  ok("score_pitches", { poolSize: 20, pitches: [] }),
  ok("score_pitches", { poolSize: 22, pitches: [] }),
  ok("build_setlist", { songs: [{ order: 1, song: "Riptide", artist: "Vance Joy" }, { order: 2, song: "Perfect", artist: "Ed Sheeran" }] }),
  ok("build_setlist", { songs: [{ order: 1, song: "riptide", artist: "Vance Joy" }, { order: 2, song: "Shivers", artist: "Ed Sheeran" }] }),
  ok("finish_plan", { accepted: true }),
];

describe("research totals from the agent's tool outputs", () => {
  it("counts each field, de-duplicated", () => {
    expect(fromToolOutputs(run)).toEqual({
      taste: 51, // 42 (one full map, repeated) + 9 (a zoomed map)
      crowds: 2, // Fed Sq at 400 m (twice) and at 800 m; the empty read doesn't count
      places: 3,
      events: 2, // the same gig at 7 pm (twice) and at 9 pm
      sensors: 2, // Swanston St had no reading
      rules: 2 + 22, // City Square, Bourke St (ruled out is still a check); "unknown" isn't; plus the final pool
      scored: 22, // the last score_pitches
      songs: 3,
    });
  });

  it("a failed, rejected or absent tool counts 0", () => {
    expect(fromToolOutputs([])).toEqual(ZERO_TOTALS);
    const failed: ToolResult[] = [
      { tool: "taste_map", ok: false },
      { tool: "crowd_at", ok: false, output: { error: "outside the planning area" } },
      { tool: "busy_places", ok: true, output: { error: "timeout" } },
      { tool: "events_near", ok: true },
      { tool: "footfall_at", ok: true, output: "not an object" },
      { tool: "check_pitch", ok: false, output: { pitchId: "x", legal: "not ruled out" } },
      { tool: "score_pitches", ok: false, output: { poolSize: 30 } },
      { tool: "build_setlist", ok: true, output: { songs: "none" } },
    ];
    expect(fromToolOutputs(failed)).toEqual(ZERO_TOTALS);
    // Only the taste map ran: everything else stays 0.
    expect(fromToolOutputs([ok("taste_map", { signals: [], area: "planning area", cells: 12 })])).toEqual({ ...ZERO_TOTALS, taste: 12 });
    // Bad numbers never go negative or fractional.
    expect(fromToolOutputs([ok("taste_map", { cells: -3 }), ok("score_pitches", { poolSize: 4.7 })])).toEqual({ ...ZERO_TOTALS, scored: 4, rules: 4 });
    expect(researchTotalsSchema.parse(fromToolOutputs(run))).toBeTruthy();
  });
});

describe("research totals from the engine's data", () => {
  it("counts the engine's cells, crowd reads, pool evidence, sensors and setlists, de-duplicated", () => {
    const pitch = (places: string[], events: { name: string; venue: { name: string }; start: string }[]) => ({ evidence: { places: places.map((name) => ({ name })), events } });
    const gig = { name: "Gig", venue: { name: "Forum" }, start: "2026-10-17T09:00:00Z" };
    const totals = fromEngine({
      cells: 40,
      crowdReads: 2,
      pool: [pitch(["ACMI", "Young & Jackson"], [gig]), pitch(["acmi"], [gig, { ...gig, start: "2026-10-17T11:00:00Z" }]), pitch([], [])],
      sensors: [
        { id: 1, name: "Flinders St", avgHourly: 1000 },
        { id: 2, name: "Swanston St", avgHourly: null },
        { id: 3, name: "Elizabeth St", avgHourly: 0 },
      ],
      setlists: [
        [{ title: "Riptide", artist: "Vance Joy" }, { title: "Perfect", artist: "Ed Sheeran" }],
        [{ title: "Riptide", artist: "Vance Joy" }],
      ],
    });
    expect(totals).toEqual({ taste: 40, crowds: 2, places: 2, events: 2, sensors: 2, rules: 3, scored: 3, songs: 2 });
    expect(fromEngine({ cells: 0, crowdReads: 0, pool: [], sensors: [], setlists: [] })).toEqual(ZERO_TOTALS);
  });
});

describe("plan schema", () => {
  it("researchTotals is optional (stored plans without it still parse) and must be non-negative integers", () => {
    const shape = planSchema.shape.researchTotals;
    expect(shape.safeParse(undefined).success).toBe(true);
    expect(shape.safeParse({ ...ZERO_TOTALS, taste: 3 }).success).toBe(true);
    expect(shape.safeParse({ ...ZERO_TOTALS, taste: -1 }).success).toBe(false);
    expect(shape.safeParse({ ...ZERO_TOTALS, songs: 1.5 }).success).toBe(false);
  });
});
