import { describe, expect, it, vi } from "vitest";
import { planRequestSchema, planSchema } from "@/lib/plan-schema";
import { EXAMPLES } from "@/lib/examples";
import { mockFetch, OFFLINE } from "../../helpers";

const request = planRequestSchema.parse({
  city: "melbourne",
  slot: { date: "2026-10-17", startHour: 18, endHour: 21 },
  performer: EXAMPLES[0].performer,
});

async function load() {
  vi.resetModules();
  const { PlanContext } = await import("@/server/agent/context");
  const agent = await import("@/server/agent/agent");
  const { assemblePlan } = await import("@/server/agent/assemble");
  return { PlanContext, ...agent, assemblePlan };
}

describe("plan agent (offline, mock model)", () => {
  it("calls the tools, streams steps and returns a validated plan with AI explanations", async () => {
    mockFetch([]); // offline: no network at all
    const { PlanContext, runPlanAgent } = await load();
    const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
    const started: string[] = [];
    const ended: { tool: string; ok: boolean; summary: string }[] = [];

    const { plan, usage } = await runPlanAgent(ctx, {
      onToolStart: (e) => started.push(e.tool),
      onToolEnd: (e) => ended.push(e),
    });

    expect(() => planSchema.parse(plan)).not.toThrow();
    expect(started).toContain("resolve_repertoire");
    expect(started).toContain("score_pitches");
    expect(started).toContain("build_setlists");
    expect(ended.every((e) => e.ok && e.summary.length > 0)).toBe(true);
    expect(usage?.steps).toBe(4);

    expect(plan.explanations).toBe("ai");
    expect(plan.qlooMode).toBe("synthetic");
    expect(plan.pitches).toHaveLength(3);
    expect(plan.pitches[0].why).toMatch(/^Mock explanation/);
    expect(plan.pitches[0].score).toBeGreaterThanOrEqual(plan.pitches[1].score);
    expect(plan.pitches.every((p) => p.setlist.length === request.performer.songs.length)).toBe(true);
    expect(plan.learnThese.length).toBeGreaterThan(0);
    expect(plan.tasteCells.length).toBeGreaterThan(0);
    expect(plan.dataStatus.map((s) => s.adapter).sort()).toEqual(["events", "footfall", "pitches", "qloo", "repertoire", "songs", "weather"]);
    expect(plan.dataStatus.every((s) => s.mode === "synthetic")).toBe(true);
  });

  it("falls back to template explanations when the model returns pitch ids the engine never produced", async () => {
    const { PlanContext, assemblePlan } = await load();
    const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
    const plan = await assemblePlan(ctx, { summary: "Invented", pitches: [{ pitchId: "made-up", why: "Trust me" }], notes: ["x"] });
    expect(plan.explanations).toBe("template");
    expect(plan.summary).toMatch(/^Top pitch:/);
    // The model's notes are dropped; the engine's own note remains (the mock, like live Qloo, has no recent trending weeks).
    expect(plan.notes).toEqual(["Trends are from Qloo's latest trending data, which ends 2026-04-15."]);
    expect(plan.pitches.every((p) => p.whySource === "template" && p.why.length > 0)).toBe(true);
  });

  it("refuses to plan without Qloo, before spending tokens", async () => {
    const { PlanContext, runPlanAgent, QlooUnavailableError } = await load();
    const ctx = new PlanContext(request, { offline: true, faults: ["qloo"] }, "2026-10-15");
    await expect(runPlanAgent(ctx)).rejects.toBeInstanceOf(QlooUnavailableError);
  });

  it("still plans when other sources are down, and says what is missing", async () => {
    const { PlanContext, runPlanAgent } = await load();
    const ctx = new PlanContext(request, { offline: true, faults: ["footfall", "events", "weather", "songs"] }, "2026-10-15");
    const { plan } = await runPlanAgent(ctx);
    expect(plan.footfallLevel).toBe("unavailable");
    expect(plan.weather).toBeNull();
    expect(plan.pitches.length).toBeGreaterThan(0);
    // Without sensors, busyness falls back to Qloo's area popularity.
    expect(plan.pitches.every((p) => p.footfallSource !== "sensor" && p.footfallSource !== "nearby-sensors")).toBe(true);
    expect(plan.dataStatus.find((s) => s.adapter === "footfall")).toMatchObject({ mode: "fallback", reason: "fault_injected" });
  });

  it("recommends nothing, and says so, when Qloo is down", async () => {
    const { PlanContext, assemblePlan } = await load();
    const plan = await assemblePlan(new PlanContext(request, { offline: true, faults: ["qloo"] }, "2026-10-15"), null);
    expect(plan).toMatchObject({ qlooFailed: true, qlooMode: "synthetic", pitches: [], others: [] });
    expect(plan.summary).toMatch(/Without Qloo/);
  });

  it("recommends nothing when the busking rules are unavailable", async () => {
    const { PlanContext, assemblePlan } = await load();
    const ctx = new PlanContext(request, { offline: true, faults: ["pitches"] }, "2026-10-15");
    const plan = await assemblePlan(ctx, null);
    expect(plan.pitches).toEqual([]);
    expect(plan.funnel).toBeNull();
    expect(plan.notes.join(" ")).toMatch(/busking rules are unavailable/);
  });

  it("completes with template explanations when the gateway is not configured", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("QLOO_API_KEY", "");
    const { PlanContext, runPlanAgent } = await load();
    // Live context, but every provider without a key: Qloo synthetic, others fall back.
    mockFetch([]);
    const ctx = new PlanContext(request, { offline: false, faults: ["footfall", "pitches", "weather"] }, "2026-10-15");
    const { plan, usage } = await runPlanAgent(ctx);
    expect(usage).toBeNull();
    expect(plan.explanations).toBe("template");
    expect(plan.notes.join(" ")).toMatch(/not configured/);
  });
});

describe("artists Qloo can't match", () => {
  const withArtists = (artists: string[]) =>
    planRequestSchema.parse({ ...request, performer: { ...request.performer, artists, songs: request.performer.songs.slice(0, 2) } });

  it("plans with the matched artists and lists the unmatched ones", async () => {
    mockFetch([]);
    const { PlanContext, runPlanAgent } = await load();
    const ctx = new PlanContext(withArtists(["Paul Kelly", "Zzyzx Unknown Busker"]), OFFLINE, "2026-10-15");
    const { plan } = await runPlanAgent(ctx);
    expect(plan.resolvedArtists).toEqual([
      { query: "Paul Kelly", matched: "Paul Kelly" },
      { query: "Zzyzx Unknown Busker", matched: null },
    ]);
    expect(plan.qlooFailed).toBe(false);
    expect(plan.pitches).toHaveLength(3);
    expect(plan.tasteCells.length).toBeGreaterThan(0);
    expect(plan.explanations).toBe("ai");
  });

  it("explains, and spends no tokens, when no artist matched", async () => {
    mockFetch([]);
    const { PlanContext, runPlanAgent } = await load();
    const ctx = new PlanContext(withArtists(["Zzyzx Unknown Busker", "Nobody Knows Us"]), OFFLINE, "2026-10-15");
    const { plan, usage } = await runPlanAgent(ctx);
    expect(usage).toBeNull();
    expect(plan.qlooFailed).toBe(false);
    expect(plan.resolvedArtists.every((a) => a.matched === null)).toBe(true);
    expect(plan.tasteCells).toEqual([]);
    expect(plan.explanations).toBe("template");
    expect(plan.notes.join(" ")).toMatch(/couldn't match any of your artists/);
  });
});

describe("crowd drivers and Qloo extras", () => {
  it("use Qloo's top-level explainability when present, else average the per-result scores", async () => {
    const { drivers } = await import("@/server/agent/assemble");
    const nameOf = (id: string) => ({ a: "Artist A", b: "Artist B" })[id] ?? null;
    const locals = [{ explanation: [{ entityId: "a", score: 1 }] }, { explanation: [{ entityId: "a", score: 0.5 }, { entityId: "b", score: 0.5 }] }];
    expect(drivers(locals, nameOf)).toEqual([{ name: "Artist A", share: 0.75 }, { name: "Artist B", share: 0.25 }]);
    const impact = [
      { entityId: "a", top3: 0.9, top5: 0.8, top10: 0.6, all: 0.5 },
      { entityId: "b", top3: 0.1, top5: 0.2, top10: null, all: null },
      { entityId: "x", top3: 0.5, top5: null, top10: null, all: null },
      { entityId: "b", top3: null, top5: null, top10: null, all: null },
    ];
    expect(drivers(locals, nameOf, impact)).toEqual([{ name: "Artist A", share: 0.6 }, { name: "Artist B", share: 0.2 }]);
    expect(drivers([], nameOf)).toEqual([]);
  });

  it("names the Qloo extras a plan can go without; the core calls are not among them", async () => {
    const { optionalQlooFeature } = await import("@/server/agent/context");
    expect(optionalQlooFeature("genres:-37.8100,144.9600")).toBe("the genres at the top pitch");
    expect(optionalQlooFeature("affinity:spot:osm:city-square")).toBe("the setlist order by local taste");
    expect(optionalQlooFeature("places:wide")).toBe("busy places nearby");
    expect(optionalQlooFeature("compare")).toBe("the contrast with the usual crowd");
    expect(optionalQlooFeature("artists")).toBeNull();
    expect(optionalQlooFeature("taste")).toBeNull();
    expect(optionalQlooFeature("taste:wide")).toBeNull();
  });

  it("says when Qloo has no trending data in the last year", async () => {
    const { PlanContext } = await load();
    mockFetch([]);
    // A year after the mock's (and live Qloo's) latest trending week.
    const ctx = new PlanContext(request, OFFLINE, "2027-09-01");
    expect(await ctx.rising()).toEqual([]);
    expect(ctx.notes).toContain('Qloo shows no audience growth for these artists and has no trending data for the last year, so "learn these" is ranked by Qloo affinity and Last.fm listeners instead.');
  });
});

describe("setlist artists", () => {
  const sax = planRequestSchema.parse({ ...request, slot: { date: "2026-10-16", startHour: 17, endHour: 20 }, performer: EXAMPLES[1].performer });

  it("never calls a matched artist unmatched when Qloo leaves them out of a pitch's local scores (Stevie Wonder on live Qloo)", async () => {
    mockFetch([]);
    const { PlanContext } = await load();
    const ctx = new PlanContext(sax, OFFLINE, "2026-10-15");
    const [top] = await ctx.topPitches();
    const setlist = await ctx.setlistFor(top);
    const stevie = setlist.filter((s) => s.artist === "Stevie Wonder");
    expect((await ctx.artists()).find((a) => a.query === "Stevie Wonder")?.entity).not.toBeNull();
    expect(stevie).toHaveLength(2);
    for (const song of stevie) {
      expect(song.affinitySource).toBe("proxy");
      expect(song.reason).not.toMatch(/No Qloo match/);
      expect(song.reason).toMatch(/^Qloo has no local score for Stevie Wonder at this pitch/);
    }
    expect(setlist.filter((s) => s.artist !== "Stevie Wonder").every((s) => s.affinitySource === "qloo")).toBe(true);
  });

  it("resolves song artists the performer didn't list as 'sounds like', for the setlist only", async () => {
    mockFetch([]);
    const { PlanContext } = await load();
    const songs = [...request.performer.songs, { title: "Lean On Me", artist: "Bill Withers", own: false }, { title: "Mine", artist: "Zzyzx Unknown Busker", own: false }];
    const ctx = new PlanContext(planRequestSchema.parse({ ...request, performer: { ...request.performer, songs } }), OFFLINE, "2026-10-15");
    const [top] = await ctx.topPitches();
    const setlist = await ctx.setlistFor(top);
    expect(setlist.find((s) => s.artist === "Bill Withers")).toMatchObject({ affinitySource: "qloo" });
    expect(setlist.find((s) => s.artist === "Zzyzx Unknown Busker")?.reason).toMatch(/^No Qloo match for Zzyzx Unknown Busker/);
    // Taste signals are still the "sounds like" artists only.
    expect((await ctx.artists()).map((a) => a.query)).toEqual(request.performer.artists);
  });
});

describe("genre names", () => {
  it("are shown in title case whatever case Qloo sends", async () => {
    mockFetch([]);
    const { PlanContext, assemblePlan } = await load();
    const raw = await new PlanContext(request, OFFLINE, "2026-10-15").crowdGenres({ lat: -37.81593, lon: 144.9671 });
    expect(raw.some((g) => g.name === "acoustic")).toBe(true);
    const plan = await assemblePlan(new PlanContext(request, OFFLINE, "2026-10-15"), null);
    const names = [...plan.crowd.genres.map((g) => g.name), ...(plan.crowd.contrast?.more ?? []), ...(plan.crowd.contrast?.less ?? [])];
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => /^\p{Lu}/u.test(n))).toBe(true);
  });
});

describe("what to play", () => {
  it("dates each song and scores its era against the crowd's age lean", async () => {
    mockFetch([]);
    const { PlanContext, assemblePlan } = await load();
    const plan = await assemblePlan(new PlanContext(request, OFFLINE, "2026-10-15"), null);
    expect(plan.ageLean).not.toBeNull();
    const setlist = plan.pitches[0].setlist;
    expect(setlist.every((s) => s.year !== null && s.eraFit !== null)).toBe(true);
    expect(setlist[0].reason).toMatch(/from \d{4}: era fit \d+\/100 for a crowd leaning /);
    expect(plan.learnThese.every((l) => l.audienceGrowth === 0)).toBe(true);
    expect(plan.dataStatus.find((s) => s.adapter === "repertoire")).toMatchObject({ source: "spotify", mode: "synthetic" });
  });
});

describe("where to play: Qloo venue detail and event crowds", () => {
  it("matches event headliners to the performer's taste and names venue detail in the reasons", async () => {
    mockFetch([]);
    const { PlanContext } = await load();
    const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
    const taste = await ctx.eventTaste();
    // The synthetic Saturday folk night (The Waifs) is matched in the Qloo mock; a pop arena show too.
    expect(taste.get("syn-ev-2")).toMatchObject({ artist: "The Waifs" });
    expect(taste.get("syn-ev-2")!.affinity).toBeGreaterThan(0);
    expect(taste.has("syn-ev-1")).toBe(false); // sport: no headliner
    const places = await ctx.places();
    expect(places.some((p) => p.liveMusic === true && p.goodFor.length > 0 && p.keywords.length > 0)).toBe(true);

    const { templateWhy } = await import("@/server/agent/assemble");
    const ranked = await ctx.ranked();
    const withVenue = ranked.find((p) => p.evidence.places.some((pl) => pl.liveMusic));
    expect(withVenue && templateWhy(withVenue, "saturday", 18, 21)).toMatch(/\(live music/);
  });

  it("an event headliner the performer lists is a perfect match, and an unmatched headliner is left out", async () => {
    mockFetch([]);
    const { PlanContext } = await load();
    const folk = planRequestSchema.parse({ ...request, performer: { ...request.performer, artists: ["The Waifs", "Paul Kelly"] } });
    const taste = await new PlanContext(folk, OFFLINE, "2026-10-15").eventTaste();
    expect(taste.get("syn-ev-2")).toEqual({ artist: "The Waifs", affinity: 1 });
  });
});

describe("why this crowd", () => {
  it("carries Qloo's explainability scores and the usual crowd for the comparison", async () => {
    mockFetch([]);
    const { PlanContext, assemblePlan } = await load();
    const plan = await assemblePlan(new PlanContext(request, OFFLINE, "2026-10-15"), null);
    const first = plan.crowd.localArtists[0];
    expect(first.explained.length).toBeGreaterThan(0);
    expect(first.explained.map((e) => e.name)).toEqual(first.because);
    expect(first.explained.every((e) => e.score > 0 && e.score <= 1)).toBe(true);
    expect(plan.crowd.usualCrowd?.hotspot).toBeTruthy();
    expect(plan.crowd.usualCrowd!.artists.length).toBeGreaterThan(0);
  });
});

describe("long model answers", () => {
  it("are clipped, not rejected", async () => {
    mockFetch([]);
    const { PlanContext, assemblePlan, aiTextSchema } = await load();
    const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
    const [top] = await ctx.topPitches();
    const long = "word ".repeat(110);
    const ai = aiTextSchema.parse({ summary: long, pitches: [{ pitchId: top.id, why: long }], notes: [long] });
    const plan = await assemblePlan(ctx, ai);
    expect(plan.explanations).toBe("ai");
    expect(plan.pitches[0].why.length).toBeLessThanOrEqual(500);
    expect(plan.summary.length).toBeLessThanOrEqual(600);
    expect(plan.notes.every((n) => n.length <= 240 || !n.startsWith("word"))).toBe(true);
  });
});
