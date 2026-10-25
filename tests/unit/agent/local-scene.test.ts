import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema, planSchema, type Plan } from "@/lib/plan-schema";
import { mockFetch, OFFLINE } from "../../helpers";

/**
 * The local scene (research/cities/cities.md, "WHAT: options tested"): a city over-index from /v2/analysis/compare, then the
 * local scene list (location + genre tags) re-scored for the act's fans. Qloo mock + mock model, no live calls.
 *
 * 'use cache' is inert outside Next, so the data cache is emulated where it sits in the app (as in fill-qloo-usage.test.ts):
 * every cached client body is memoised by name and arguments. Every request the mock receives is recorded.
 */
const cache = new Map<string, Promise<unknown>>();
vi.mock("@/server/adapters/qloo/usage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo/usage")>();
  return {
    ...original,
    lookupScope: <T>(name: string, args: readonly unknown[], body: () => Promise<T>): Promise<T> => {
      const key = JSON.stringify([name, args]);
      if (!cache.has(key)) cache.set(key, original.lookupScope(name, args, body).catch((e) => (cache.delete(key), Promise.reject(e))));
      return cache.get(key) as Promise<T>;
    },
  };
});

const seen: URL[] = [];
/** Requests the mock answers with a 500 while a test sets this. */
let failWhen: ((url: URL) => boolean) | null = null;
vi.mock("@/server/qloo-mock/fetch", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/qloo-mock/fetch")>();
  return {
    ...original,
    qlooMockFetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      seen.push(url);
      if (failWhen?.(url)) return new Response(JSON.stringify({ message: "synthetic failure" }), { status: 500, headers: { "content-type": "application/json" } });
      return original.qlooMockFetch(input, init);
    },
  };
});

const slot = { date: "2026-10-17", startHour: 18, endHour: 21 };
const request = planRequestSchema.parse({ city: "melbourne", slot, performer: EXAMPLES[0].performer });
/** The same city, a different act. */
const other = planRequestSchema.parse({ city: "melbourne", slot, performer: EXAMPLES[1].performer });

async function busk(req: typeof request): Promise<Plan> {
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const { runPlanAgent } = await import("@/server/agent/agent");
  const { createMockPlanner } = await import("@/server/agent/mock-model");
  return (await runPlanAgent(new PlanContext(req, OFFLINE, "2026-10-15"), {}, undefined, { model: createMockPlanner() })).plan;
}

const list = (url: URL, name: string) => (url.searchParams.get(name) ?? "").split(",").filter(Boolean);
const compares = () => seen.filter((u) => u.pathname === "/v2/analysis/compare");
/** The local scene's compare: its group b is the global-pop read (20 artists); the contrast's is the usual crowd's first 10. */
const sceneCompare = () => compares().find((u) => list(u, "b.signal.interests.entities").length === 20);
const sceneList = () => seen.filter((u) => u.pathname === "/v2/insights" && u.searchParams.has("signal.interests.tags"));
/** The re-score: the scene list as results, the act's artists as the signal, no location (the headliner match sends at most 6 results). */
const isRescore = (u: URL) => u.pathname === "/v2/insights" && list(u, "filter.results.entities").length >= 10 && u.searchParams.has("signal.interests.entities") && !u.searchParams.has("signal.location");
const globalPop = () => seen.filter((u) => u.pathname === "/v2/insights" && u.searchParams.get("filter.type") === "urn:entity:artist" && [...u.searchParams.keys()].every((k) => k === "filter.type" || k === "filter.popularity.min" || k === "take"));

beforeEach(() => {
  cache.clear();
  seen.length = 0;
  failWhen = null;
});

describe("local scene: the two-step method and its requests", () => {
  it("compares the usual crowd's top 20 with a global-pop set, then reads location + genre tags, then re-scores for the act's fans", async () => {
    const plan = await busk(request);

    // Step 1: /v2/analysis/compare, a = the usual crowd (location only, top 20), b = the global-pop set.
    const compare = sceneCompare()!;
    expect(compare).toBeDefined();
    expect(list(compare, "a.signal.interests.entities")).toHaveLength(20);
    expect([...compare.searchParams.keys()].sort()).toEqual(["a.signal.interests.entities", "b.signal.interests.entities"]);
    const [pop] = globalPop();
    expect(pop.searchParams.get("take")).toBe("20");

    // Step 2a: location + the over-indexed genre tags (1–7), and nothing about the act.
    const [scene] = sceneList();
    const tags = list(scene, "signal.interests.tags");
    expect(tags.length).toBeGreaterThanOrEqual(1);
    expect(tags.length).toBeLessThanOrEqual(7);
    expect(tags.every((t) => t.startsWith("urn:tag:genre:music:"))).toBe(true);
    expect(scene.searchParams.get("filter.type")).toBe("urn:entity:artist");
    expect(scene.searchParams.get("signal.location")).toMatch(/^POLYGON\(\(/);
    expect(scene.searchParams.has("signal.interests.entities")).toBe(false);
    expect(scene.searchParams.get("take")).toBe("20");

    // Step 2b: the scene list re-scored for the act's fans: filter.results.entities + the act's artists as the signal, no location.
    const sceneIds = new Set(plan.crowd.localScene!.acts.map((a) => a.name));
    expect(sceneIds.size).toBeGreaterThan(0);
    const rescore = seen.find(isRescore);
    expect(rescore).toBeDefined();
    expect(list(rescore!, "signal.interests.entities")).toHaveLength(EXAMPLES[0].performer.artists.length);
    expect(rescore!.searchParams.get("filter.type")).toBe("urn:entity:artist");
  });

  it("puts the genres and the re-scored local acts on the plan, best first, without the act's own artists", async () => {
    const plan = await busk(request);
    const local = plan.crowd.localScene!;
    expect(local.genres.length).toBeGreaterThanOrEqual(1);
    expect(local.genres.length).toBeLessThanOrEqual(7);
    expect(local.genres.every((g) => g.over > 0)).toBe(true);
    expect(local.acts.length).toBeGreaterThan(0);
    expect(local.acts.length).toBeLessThanOrEqual(6);
    const scores = local.acts.map((a) => a.affinity ?? -1);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    const own = new Set(EXAMPLES[0].performer.artists.map((a) => a.toLowerCase()));
    expect(local.acts.some((a) => own.has(a.name.toLowerCase()))).toBe(false);
    // Stored plans parse back, and plans from before the local scene (no field) parse with null.
    expect(planSchema.parse(JSON.parse(JSON.stringify(plan))).crowd.localScene).toEqual(local);
    const { localScene, ...oldCrowd } = plan.crowd;
    void localScene;
    expect(planSchema.parse({ ...JSON.parse(JSON.stringify(plan)), crowd: oldCrowd }).crowd.localScene).toBeNull();
  });

  it("reads the usual crowd once for both the contrast and the over-index", async () => {
    await busk(request);
    const usual = seen.filter((u) => u.pathname === "/v2/insights" && u.searchParams.get("filter.type") === "urn:entity:artist" && u.searchParams.get("signal.location")?.startsWith("POLYGON") && !u.searchParams.has("signal.interests.entities") && !u.searchParams.has("signal.interests.tags"));
    expect(usual).toHaveLength(1);
    expect(usual[0].searchParams.get("take")).toBe("20");
    // The contrast still compares the first 10 of them.
    expect(compares().some((u) => list(u, "b.signal.interests.entities").length === 10)).toBe(true);
  });
});

describe("local scene: call accounting and the cache", () => {
  it("adds 4 requests to a cold busk (global-pop set, compare, scene list, re-score), all counted in qlooCalls", async () => {
    const cold = await busk(request);
    const added = [sceneCompare(), ...globalPop(), ...sceneList(), ...seen.filter(isRescore)];
    expect(added).toHaveLength(4);
    expect(added.every(Boolean)).toBe(true);
    // qlooCalls counts every request sent (never fewer than the mock saw; concurrent identical lookups may be credited twice).
    expect(cold.researchTotals!.qlooCalls).toBeGreaterThanOrEqual(seen.length);
    expect(cold.researchTotals!.qlooCalls).toBeLessThanOrEqual(seen.length + 4);
  });

  it("serves a second busk in the same city from the cache: only the re-score for the new act is a request", async () => {
    const first = await busk(request);
    seen.length = 0;
    const second = await busk(other);
    expect(second.crowd.localScene).not.toBeNull();
    // Same city: the usual crowd, the global-pop set, the compare and the scene list are all cache hits.
    // (The contrast is a compare of the new act's fans, so that one is a request.)
    expect(compares()).toHaveLength(1);
    expect(globalPop()).toHaveLength(0);
    expect(sceneList()).toHaveLength(0);
    expect(sceneCompare()).toBeUndefined();
    expect(seen.filter(isRescore)).toHaveLength(1);
    expect(second.researchTotals!.qlooCacheHits).toBeGreaterThan(0);
    // The same act again: nothing is a request.
    seen.length = 0;
    const again = await busk(request);
    expect(seen).toHaveLength(0);
    expect(again.researchTotals!.qlooCalls).toBe(0);
    expect(again.crowd.localScene).toEqual(first.crowd.localScene);
  });
});

describe("local scene: failure falls back to today's behaviour", () => {
  it.each([
    ["the global-pop set", (u: URL) => u.pathname === "/v2/insights" && [...u.searchParams.keys()].every((k) => k === "filter.type" || k === "filter.popularity.min" || k === "take")],
    ["the compare", (u: URL) => u.pathname === "/v2/analysis/compare" && list(u, "b.signal.interests.entities").length === 20],
    ["the scene list", (u: URL) => u.searchParams.has("signal.interests.tags")],
    ["the re-score", isRescore],
  ])("without %s: no local scene, a plan note, and the rest of the plan intact", async (_name, fails) => {
    failWhen = fails;
    const plan = await busk(request);
    expect(plan.crowd.localScene).toBeNull();
    expect(plan.qlooFailed).toBe(false);
    expect(plan.notes.some((n) => /local scene/.test(n))).toBe(true);
    expect(plan.pitches).toHaveLength(3);
    expect(plan.crowd.localArtists.length).toBeGreaterThan(0);
    expect(plan.pitches[0].setlist.every((s) => !s.localScene)).toBe(true);
  });

  it("leaves the plan exactly as it was before the local scene, apart from the scene itself", async () => {
    const withScene = await busk(request);
    cache.clear();
    failWhen = (u) => u.searchParams.has("signal.interests.tags");
    const without = await busk(request);
    expect(without.pitches.map((p) => p.id)).toEqual(withScene.pitches.map((p) => p.id));
    expect(without.crowd.localArtists).toEqual(withScene.crowd.localArtists);
  });
});

describe("local scene: weighs into the set and the suggested fill", () => {
  it("lifts a song by a local-scene act and marks it, in the set and in the agent's build_setlist output", async () => {
    const withLocal = planRequestSchema.parse({
      city: "melbourne",
      slot,
      performer: { ...EXAMPLES[0].performer, songs: [...EXAMPLES[0].performer.songs, { title: "Local Song", artist: "Josh Pyke", own: false }] },
    });
    const plan = await busk(withLocal);
    const scene = plan.crowd.localScene!.acts.map((a) => a.name);
    expect(scene).toContain("Josh Pyke");
    const entry = plan.pitches[0].setlist.find((s) => s.artist === "Josh Pyke")!;
    expect(entry.localScene).toBe(true);
    expect(entry.reason).toMatch(/local scene act your fans would like \((very strong|strong|good|some|weak) match\)/);
    cache.clear();
    failWhen = (u) => u.searchParams.has("signal.interests.tags");
    const without = await busk(withLocal);
    const before = without.pitches[0].setlist.find((s) => s.artist === "Josh Pyke")!;
    expect(before.localScene).toBe(false);
    expect(entry.score).toBeGreaterThan(before.score);
  });

  it("offers local acts as fill candidates when the act asked for suggested songs", async () => {
    const filled = planRequestSchema.parse({ ...request, performer: { ...request.performer, fillSuggested: 4 } });
    const plan = await busk(filled);
    const suggested = plan.pitches.flatMap((p) => p.setlist.filter((s) => s.origin === "suggested"));
    expect(suggested.length).toBeGreaterThan(0);
    // The fill still costs exactly one extra Qloo call (the related-artists read): local acts come from the scene already read.
    cache.clear();
    const plain = (await busk(request)).researchTotals!.qlooCalls!;
    cache.clear();
    expect((await busk(filled)).researchTotals!.qlooCalls).toBe(plain + 1);
  });
});

describe("local scene: the act's own genres (Repertoire research step 8)", () => {
  it("preferActGenres puts the shared handles first and names them; without act genres nothing changes", async () => {
    const { preferActGenres } = await import("@/server/scoring/local-scene");
    const handles = [
      { id: "urn:tag:genre:music:rock", name: "Rock", over: 0.4 },
      { id: "urn:tag:genre:music:indie_folk", name: "Indie Folk", over: 0.2 },
      { id: "urn:tag:genre:music:jazz", name: "Jazz", over: 0.16 },
    ];
    expect(preferActGenres(handles, undefined)).toEqual({ handles, yours: [] });
    const out = preferActGenres(handles, [{ id: "urn:tag:genre:music:indie_folk", name: "Indie Folk" }, { id: "x", name: "jazz" }]);
    expect(out.handles.map((h) => h.name)).toEqual(["Indie Folk", "Jazz", "Rock"]);
    expect(out.yours).toEqual(["urn:tag:genre:music:indie_folk", "urn:tag:genre:music:jazz"]);
  });

  it("a busk with genre tags leads the scene search with the shared ones and marks them on the plan; without, the plan has no mark", async () => {
    const without = await busk(request);
    expect(without.crowd.localScene!.genres.some((g) => "yours" in g)).toBe(false);
    const shared = without.crowd.localScene!.genres.at(-1)!;
    cache.clear();
    seen.length = 0;
    const tagId = (await import("@/server/qloo-mock/catalog")).genreTagId;
    const { GENRES } = await import("@/server/qloo-mock/catalog");
    const key = (Object.keys(GENRES) as (keyof typeof GENRES)[]).find((g) => GENRES[g].toLowerCase() === shared.name.toLowerCase())!;
    const withGenres = planRequestSchema.parse({ city: "melbourne", slot, performer: { ...EXAMPLES[0].performer, genreTags: [{ id: tagId(key), name: GENRES[key] }] } });
    const plan = await busk(withGenres);
    expect(plan.crowd.localScene!.genres[0]).toMatchObject({ name: shared.name, yours: true });
    expect(list(sceneList()[0], "signal.interests.tags")[0]).toBe(tagId(key));
  });
});
