import { describe, expect, it, vi } from "vitest";
import { history, playlist, setupFetch } from "./helpers";

type Exec = (input: unknown, options: unknown) => Promise<unknown>;
const exec = (t: { execute?: unknown }, input: unknown) => (t.execute as Exec)(input, { toolCallId: "t", messages: [] });
const ok = <T>(data: T) => ({ adapter: "qloo", source: "qloo", mode: "live", data });

/** The `rising` tool with Qloo's trending rows replaced by `rows`; returns what it reports for the artist `a1`. */
async function risingWith(rows: { percentDelta: number | null; windowChange?: number | null }[]) {
  vi.resetModules();
  await setupFetch();
  vi.doMock("@/server/adapters/qloo", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/server/adapters/qloo")>();
    return {
      ...original,
      trendingWindow: async () => ok({ start: "2026-08-01", end: "2026-09-12" }),
      rising: async () => ok(rows.map((r) => ({ entityId: "a1", velocity: null, percentile: 50, ...r }))),
    };
  });
  const tools = await import("@/server/learn/tools");
  const { LearnContext } = await import("@/server/learn/context");
  const ctx = new LearnContext({ offline: true, faults: [] }, playlist(), history(), "2026-10-17", { calls: 0, cacheHits: 0 });
  const state = new tools.LearnState();
  state.artists.set("a1", { id: "a1", name: "Artist One", from: "related_artists", affinity: 0.5, because: [], growth: null, trendDelta: null, pitch: null, related: true, listeners: null });
  const out = (await exec(tools.createLearnTools(ctx, state).rising, { artistIds: ["a1"] })) as { artists: { trendDelta: number | null }[] };
  vi.doUnmock("@/server/adapters/qloo");
  return { reported: out.artists[0].trendDelta, stored: state.artists.get("a1")!.trendDelta };
}

describe("trendDelta is one unit: percentile points over the trending window", () => {
  it("is the window change in Qloo's population percentile, not the week-over-week percent", async () => {
    // A weekly change of 12 percent next to a window change of 3.5 points: the window change is what the run keeps.
    expect(await risingWith([{ percentDelta: 12, windowChange: 3.5 }])).toEqual({ reported: 3.5, stored: 3.5 });
  });

  it("never falls back to percentDelta when there is no window change (a different unit)", async () => {
    expect(await risingWith([{ percentDelta: 12, windowChange: null }])).toEqual({ reported: null, stored: null });
    expect(await risingWith([{ percentDelta: 12 }])).toEqual({ reported: null, stored: null });
  });

  it("keeps a falling artist negative, and a flat one null", async () => {
    expect((await risingWith([{ percentDelta: 0, windowChange: -2 }])).reported).toBe(-2);
    expect((await risingWith([{ percentDelta: 5, windowChange: 0 }])).reported).toBeNull();
  });
});
