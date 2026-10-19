import { describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema } from "@/lib/plan-schema";
import { trackKey } from "@/lib/text";
import { mockFetch, OFFLINE } from "../../helpers";

/** Suggested fill through the engine, offline (Qloo mock, synthetic Spotify/Last.fm): docs/plan-inputs-architecture.md §3, §5. */
const base = planRequestSchema.parse({ city: "melbourne", slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer: EXAMPLES[0].performer });
const withPerformer = (patch: Record<string, unknown>) => planRequestSchema.parse({ ...base, performer: { ...base.performer, ...patch } });

async function setlists(request: typeof base) {
  vi.resetModules();
  mockFetch([]);
  const { PlanContext } = await import("@/server/agent/context");
  const ctx = new PlanContext(request, OFFLINE, "2026-10-15");
  const tops = await ctx.topPitches();
  return { ctx, tops, sets: await Promise.all(tops.map((p) => ctx.setlistFor(p))) };
}

describe("suggested fill in the set", () => {
  it("without fillSuggested nothing changes: every row is the act's own, no related-artists call", async () => {
    const { ctx, sets } = await setlists(base);
    for (const set of sets) for (const e of set) expect(e).toMatchObject({ origin: "repertoire", suggestion: null });
    expect(ctx.dataStatus().length).toBeGreaterThan(0);
    expect(await ctx.fillCount).toBe(0);
  });

  it("adds suggested songs with a reason and a source, none the act already has", async () => {
    const { sets } = await setlists(withPerformer({ fillSuggested: 4 }));
    const have = new Set(base.performer.songs.map((s) => trackKey(s.artist, s.title)));
    for (const set of sets) {
      const suggested = set.filter((e) => e.origin === "suggested");
      expect(suggested.length).toBeGreaterThan(0);
      expect(suggested.length).toBeLessThanOrEqual(4);
      for (const e of suggested) {
        expect(have.has(trackKey(e.artist, e.title))).toBe(false);
        expect(e.suggestion).toMatchObject({ because: expect.stringMatching(/crowd/), source: expect.stringMatching(/^(spotify|lastfm)$/) });
        expect(e.own).toBe(false);
      }
      expect(set.filter((e) => e.origin === "repertoire")).toHaveLength(base.performer.songs.length > 12 ? 12 : base.performer.songs.length);
    }
  });

  it("leaves out skipSongs", async () => {
    const first = await setlists(withPerformer({ songs: [], fillSuggested: 6 }));
    const taken = first.sets[0].filter((e) => e.origin === "suggested").slice(0, 2);
    expect(taken.length).toBeGreaterThan(0);
    const again = await setlists(withPerformer({ songs: [], fillSuggested: 6, skipSongs: taken.map((e) => ({ title: e.title, artist: e.artist })) }));
    const keys = new Set(again.sets.flatMap((s) => s.map((e) => trackKey(e.artist, e.title))));
    for (const e of taken) expect(keys.has(trackKey(e.artist, e.title))).toBe(false);
  });

  it("an empty songs list with fill gives a suggested-only set for each pitch", async () => {
    const { sets } = await setlists(withPerformer({ songs: [], fillSuggested: 6 }));
    for (const set of sets) {
      expect(set.length).toBeGreaterThan(0);
      expect(set.length).toBeLessThanOrEqual(6);
      expect(set.every((e) => e.origin === "suggested")).toBe(true);
    }
  });

  it("no songs and no fill is still an empty set (an old link)", async () => {
    const { sets } = await setlists(withPerformer({ songs: [] }));
    for (const set of sets) expect(set).toEqual([]);
  });

  it("is deterministic, and never suggests the same song twice in one set", async () => {
    const a = await setlists(withPerformer({ songs: [], fillSuggested: 8 }));
    const b = await setlists(withPerformer({ songs: [], fillSuggested: 8 }));
    expect(b.sets).toEqual(a.sets);
    for (const set of a.sets) expect(new Set(set.map((e) => trackKey(e.artist, e.title))).size).toBe(set.length);
  });

  it("a long Repertoire can't push the suggested songs out", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ title: `Song ${i}`, artist: i % 2 ? "Oasis" : "Radiohead", own: false }));
    const { sets } = await setlists(withPerformer({ songs: many, fillSuggested: 3 }));
    for (const set of sets) {
      expect(set.filter((e) => e.origin === "repertoire")).toHaveLength(12);
      expect(set.filter((e) => e.origin === "suggested").length).toBeGreaterThan(0);
    }
  });

  it("the agent's build_setlist rows say which are suggested (additive field)", async () => {
    vi.resetModules();
    mockFetch([]);
    const { PlanContext } = await import("@/server/agent/context");
    const { createTools, AgentState } = await import("@/server/agent/tools");
    const ctx = new PlanContext(withPerformer({ songs: [], fillSuggested: 3 }), OFFLINE, "2026-10-15");
    const run = (t: { execute?: unknown }, input: unknown) => (t.execute as (i: unknown, o: unknown) => Promise<unknown>)(input, { toolCallId: "t", messages: [] });
    const state = new AgentState();
    const tools = createTools(ctx, state);
    const [top] = await ctx.topPitches();
    state.scored = true;
    state.pool.set(top.id, top);
    const out = (await run(tools.build_setlist, { pitchId: top.id })) as { songs: { suggested?: boolean }[] };
    expect(out.songs.length).toBeGreaterThan(0);
    expect(out.songs.every((s) => s.suggested === true)).toBe(true);
  });
});
