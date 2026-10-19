import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG } from "@/server/qloo-mock/catalog";
import { toDetail } from "@/server/adapters/qloo/normalize";
import { cache, cachedLookupScope, history, playlist, setupFetch } from "../learn/helpers";

vi.mock("@/server/adapters/qloo/usage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo/usage")>();
  return { ...original, lookupScope: cachedLookupScope(original) };
});

const OFF = { offline: true, faults: [] } as const;
const julia = CATALOG.find((a) => a.name === "Julia Jacklin")!;

beforeEach(() => cache.clear());

describe("Qloo calls new for research (against the local mock)", () => {
  it("artistDetail: an artist's typed tags and description by Qloo id (step 3)", async () => {
    vi.resetModules();
    await setupFetch();
    const qloo = await import("@/server/adapters/qloo");
    const res = await qloo.artistDetail(julia.id, OFF);
    expect(res.mode).toBe("synthetic");
    expect(res.data?.name).toBe("Julia Jacklin");
    expect(res.data?.description).toMatch(/Qloo mock test description/);
    const types = new Set(res.data?.tags.map((t) => t.type));
    expect(types.has("urn:tag:genre:music")).toBe(true);
    expect(types.has("urn:tag:audience:qloo")).toBe(true);
    expect((await qloo.artistDetail("4D4F434B-0000-0000-0000-000000000000", OFF)).data).toBeNull();
  });

  it("actGenres: the music genres fans of an artist lean to, with no location (step 8)", async () => {
    vi.resetModules();
    await setupFetch();
    const qloo = await import("@/server/adapters/qloo");
    const res = await qloo.actGenres([julia.id], 8, OFF);
    expect(res.data.length).toBeGreaterThan(2);
    expect(res.data[0]).toMatchObject({ id: expect.stringMatching(/^urn:tag:genre:music:/), name: expect.any(String) });
  });

  it("toDetail reads a description as text or {value}, and keeps tag types", () => {
    const d = toDetail({ entity_id: "e1", name: "Syn", properties: { description: { value: "  A  synthetic act. " } }, tags: [{ id: "t1", name: " Folk", type: "urn:tag:genre:music" }] } as never);
    expect(d).toEqual({ id: "e1", name: "Syn", popularity: null, description: "A synthetic act.", tags: [{ id: "t1", name: "Folk", type: "urn:tag:genre:music" }] });
    expect(toDetail({ entity_id: "e2", name: "S", properties: { short_description: "Short." } } as never).description).toBe("Short.");
  });
});

describe("step 9: the summary only ranks and explains", () => {
  async function withSongs() {
    vi.resetModules();
    await setupFetch();
    const tools = await import("@/server/learn/tools");
    const summary = await import("@/server/research/summary");
    const { LearnContext } = await import("@/server/learn/context");
    const ctx = new LearnContext(OFF, playlist(), history(), "2026-10-17", { calls: 0, cacheHits: 0 });
    const state = new tools.LearnState();
    state.artists.set("a1", { id: "a1", name: "Gordi", from: "related_artists", affinity: 0.8, because: ["Julia Jacklin"], growth: null, trendDelta: null, pitch: null, related: true, listeners: null });
    for (const [i, title] of ["One", "Two", "Three"].entries()) {
      state.found.set(`s-${i + 1}`, { songId: `s-${i + 1}`, songKey: `gordi|${title.toLowerCase()}`, title, artist: "Gordi", artistId: "a1", spotifyTrackId: null, year: 2019, durationMs: 200_000, image: null, sourceUrl: null, source: "spotify", popularity: null });
    }
    const facts = { act: "Test Act", spotifyGenres: [], followers: 1200, description: null, audience: [], genres: ["Indie Folk"], soundsLike: ["Julia Jacklin"], fansLove: ["Gordi"], ageLean: "25–29", genderLean: null };
    return { tools, summary, ctx, state, facts };
  }

  it("the offline writer picks this run's songs (2 per artist at most), with no paragraph", async () => {
    const { summary, ctx, state, facts } = await withSongs();
    const result = await summary.summarise(facts, state, ctx, { offline: true });
    expect(result.by).toBe("mock");
    expect(result.accepted?.picks.map((p) => p.songId)).toEqual(["s-1", "s-2"]);
    expect(result).not.toHaveProperty("text");
    expect(result.accepted?.summary).toBe("");
    expect(result.usage).toMatchObject({ steps: 1, stoppedBy: "finished" });
  });

  it("the prompt asks for a ranking only, not a paragraph about the act", async () => {
    const { summary } = await withSongs();
    expect(summary.SUMMARY_INSTRUCTIONS).not.toMatch(/paragraph/i);
  });

  it("an invented number in a reason is replaced by the template reason; a song not from this run is dropped", async () => {
    const { summary, ctx, state } = await withSongs();
    const out = summary.acceptSummary({ picks: [{ songId: "s-1", reason: "98765 fans love this." }, { songId: "s-99", reason: "Trust me." }] }, state, ctx, "claude");
    // checkPicks fails (pool + numbers); one valid pick is too few for 2 achievable, so the data's picks stand, templated.
    expect(out.accepted?.picks.map((p) => [p.songId, p.reason, p.templated])).toEqual([
      ["s-1", "Fans of Julia Jacklin also like Gordi.", true],
      ["s-2", "Fans of Julia Jacklin also like Gordi.", true],
    ]);
    expect(out.by).toBe("template");
    // With one bad reason among valid picks, the salvage keeps the picks and templates only that reason.
    const salvaged = summary.acceptSummary({ picks: [{ songId: "s-1", reason: "98765 fans love this." }, { songId: "s-2", reason: "Good one." }] }, state, ctx, "claude");
    expect(salvaged.accepted?.picks.map((p) => p.templated)).toEqual([true, false]);
    expect(salvaged.by).toBe("claude");
  });

  it("a failing model falls back to the data: songs and paragraph from templates", async () => {
    const { summary, ctx, state, facts } = await withSongs();
    const result = await summary.summarise(facts, state, ctx, { offline: true, model: summary.createMockResearchWriter("fail") });
    expect(result.by).toBe("template");
    expect(result.accepted?.picks.length).toBeGreaterThan(0);
    expect(result.accepted?.picks.every((p) => p.templated)).toBe(true);
    expect(result.usage?.stoppedBy).toBe("error");
  });

  it("an answer cut off mid-JSON (live: 'could not parse the response') is asked for once more before the data answers", async () => {
    const { summary, ctx, state, facts } = await withSongs();
    const { MockLanguageModelV4 } = await import("ai/test");
    const good = summary.createMockResearchWriter("ok");
    let calls = 0;
    const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 10, text: 10, reasoning: undefined } };
    const model = new MockLanguageModelV4({
      modelId: "cut-off-then-fine",
      doGenerate: async (options) => {
        calls++;
        if (calls === 1) return { content: [{ type: "text", text: '{"picks":[{"songId":"s-1","rea' }], finishReason: { unified: "length", raw: undefined }, usage, warnings: [] };
        return good.doGenerate(options);
      },
    });
    const result = await summary.summarise(facts, state, ctx, { offline: true, model });
    expect(calls).toBe(2);
    expect(result.accepted?.picks.map((p) => p.songId)).toEqual(["s-1", "s-2"]);
    expect(result.accepted?.picks.some((p) => p.templated)).toBe(false);
  });
});
