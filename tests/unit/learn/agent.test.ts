import { beforeEach, describe, expect, it, vi } from "vitest";
import { learnStreamEventSchema } from "@/lib/learn-schema";
import { playlistSongKey } from "@/lib/playlist-schema";
import { cache, cachedLookupScope, history, playlist, setupFetch, SONGS, sung } from "./helpers";

vi.mock("@/server/adapters/qloo/usage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo/usage")>();
  return { ...original, lookupScope: cachedLookupScope(original) };
});

async function load() {
  vi.resetModules();
  await setupFetch();
  const agent = await import("@/server/learn/agent");
  const { LearnContext } = await import("@/server/learn/context");
  const mock = await import("@/server/learn/mock-model");
  const { withQlooUsage } = await import("@/server/adapters/qloo/usage");
  mock.resetMockLearnerCalls();
  return { ...agent, LearnContext, ...mock, withQlooUsage };
}

type Overrides = { history?: ReturnType<typeof history>; playlist?: ReturnType<typeof playlist>; faults?: ("qloo" | "repertoire" | "songs")[]; scenario?: string; limits?: object; noModel?: boolean };

async function run(over: Overrides = {}) {
  const m = await load();
  const events: unknown[] = [];
  const result = await m.withQlooUsage((usage) => {
    const ctx = new m.LearnContext({ offline: true, faults: over.faults ?? [] }, over.playlist ?? playlist(), over.history ?? history(), "2026-10-17", usage);
    return m.runLearnAgent(
      ctx,
      {
        onNote: (e) => events.push({ type: "note", ...e }),
        onToolStart: (e) => events.push({ type: "tool-start", ...e }),
        onToolEnd: (e) => events.push({ type: "tool-end", ...e }),
        onTotals: (totals) => events.push({ type: "totals", totals }),
      },
      undefined,
      { model: over.noModel ? undefined : m.createMockLearner((over.scenario ?? "investigate") as never), limits: over.limits },
    ).then((r) => ({ ...r, qlooCalls: usage.calls, qlooCacheHits: usage.cacheHits }));
  });
  return { ...m, result, events };
}

const tools = (events: unknown[]) => (events as { type: string; tool?: string }[]).filter((e) => e.type === "tool-start").map((e) => e.tool);

beforeEach(() => cache.clear());

describe("the learn agent with the mock model", () => {
  it("runs the two server steps, investigates, looks up songs and finishes with picks from this run's top_tracks", async () => {
    const { result, events } = await run();
    expect(tools(events)).toEqual(["match_playlist", "history", "related_artists", "crowd_at", "rising", "top_tracks", "finish_suggestions"]);
    expect(result).toMatchObject({ status: "done", mode: "mock", model: "mock", endCode: null });
    expect(result.picks.length).toBeGreaterThanOrEqual(3);
    expect(result.picks.length).toBeLessThanOrEqual(8);
    // every pick is a song top_tracks returned, with its fields from the record
    const found = (events as { type: string; tool?: string; output?: { songs?: { title: string; artist: string }[] } }[]).filter((e) => e.type === "tool-end" && e.tool === "top_tracks").flatMap((e) => e.output!.songs!);
    for (const pick of result.picks) {
      expect(found.some((s) => s.title === pick.title && s.artist === pick.artist)).toBe(true);
      expect(pick.songKey).toBe(playlistSongKey(pick.artist, pick.title));
      expect(pick.reason).toMatch(/^Mock reason/);
      expect(pick.evidence.ranker).toBe("mock");
      expect(pick.songSource).toBe("spotify");
    }
    expect(result.picks.map((p) => p.rank)).toEqual(result.picks.map((_, i) => i + 1));
    const perArtist = new Map<string, number>();
    for (const p of result.picks) perArtist.set(p.artist, (perArtist.get(p.artist) ?? 0) + 1);
    expect(Math.max(...perArtist.values())).toBeLessThanOrEqual(2);
  });

  it("streams a totals event after every tool-end, growing as the run goes", async () => {
    const { events } = await run();
    const list = events as { type: string; totals?: Record<string, number> }[];
    const ends = list.filter((e) => e.type === "tool-end").length;
    expect(list.filter((e) => e.type === "totals")).toHaveLength(ends);
    const last = list.filter((e) => e.type === "totals").at(-1)!.totals!;
    expect(last.artists).toBeGreaterThan(0);
    expect(last.crowds).toBe(1);
    expect(last.liked).toBeGreaterThan(0);
    expect(last.songsChecked).toBeGreaterThan(0);
    expect(last.qlooCalls).toBeGreaterThan(0);
    expect(last.newSongs).toBe(0); // 0 until the picks are accepted and saved
  });

  it("every event it produces parses as a learn stream event", async () => {
    const { events } = await run();
    for (const e of events) expect(learnStreamEventSchema.safeParse(e).success, JSON.stringify(e).slice(0, 200)).toBe(true);
  });

  it("a second run with the first run's picks as history returns none of them and builds on a learned song", async () => {
    const first = await run();
    const asHistory = (picks: typeof first.result.picks) => picks.map((p) => ({ title: p.title, artist: p.artist, key: p.songKey, status: "pending" as const, runNumber: 1, at: Date.now() }));
    const learned = { ...asHistory(first.result.picks.slice(0, 1))[0], status: "learned" as const };
    const dismissed = { ...asHistory(first.result.picks.slice(1, 2))[0], status: "dismissed" as const };
    const rest = asHistory(first.result.picks.slice(2));
    const second = await run({ history: history({ suggestions: [learned, dismissed, ...rest], earlierRuns: 1, lastRun: { number: 1, startedAt: Date.now(), newCount: first.result.picks.length } }) });
    const firstKeys = new Set(first.result.picks.map((p) => p.songKey));
    expect(second.result.picks.length).toBeGreaterThanOrEqual(3);
    for (const p of second.result.picks) expect(firstKeys.has(p.songKey), `${p.title} was suggested in run 1`).toBe(false);
    // the model saw the history, and top_tracks said what it left out
    const prompt = second.mockLearnerCalls[0].prompt;
    expect(prompt).toContain("Learned from earlier runs (1)");
    expect(prompt).toContain("Dismissed, never suggest again (1)");
    const tt = (second.events as { type: string; tool?: string; output?: { skipped: Record<string, number> } }[]).find((e) => e.type === "tool-end" && e.tool === "top_tracks")!;
    expect(tt.output!.skipped.alreadySuggested + tt.output!.skipped.dismissed).toBeGreaterThan(0);
    // "builds on" the learned song, computed and checked on the server
    expect(second.result.picks[0].evidence.basedOn).toContainEqual({ kind: "learned", name: first.result.picks[0].title });
  });

  it("the history step says what earlier runs found; a first run says so", async () => {
    const first = await run();
    const hist = (first.events as { type: string; tool?: string; summary?: string }[]).find((e) => e.type === "tool-end" && e.tool === "history")!;
    expect(hist.summary).toBe("No earlier runs: this is the first");
    const again = await run({ history: history({ suggestions: [{ title: "A", artist: "B", key: "b|a", status: "learned", runNumber: 1, at: 1 }, { title: "C", artist: "D", key: "d|c", status: "pending", runNumber: 1, at: 1 }], earlierRuns: 1, lastRun: { number: 1, startedAt: 1, newCount: 2 } }) });
    expect((again.events as { type: string; tool?: string; summary?: string }[]).find((e) => e.type === "tool-end" && e.tool === "history")!.summary).toBe("1 earlier run: 1 learned, 1 to learn, 0 dismissed");
  });
});

describe("the guardrails", () => {
  it("a model that picks a song id from nowhere is rejected once, fixes it, and is accepted", async () => {
    const { result, events } = await run({ scenario: "repeat" });
    const finishes = (events as { type: string; tool?: string; ok?: boolean; summary?: string }[]).filter((e) => e.type === "tool-end" && e.tool === "finish_suggestions");
    expect(finishes.map((f) => f.ok)).toEqual([false, true]);
    expect(finishes[0].summary).toMatch(/^Rejected: Not from this run's top_tracks: s-999/);
    expect(result.status).toBe("done");
    expect(result.picks.every((p) => /synthetic song \d$/.test(p.title))).toBe(true);
  });

  it("numbers that no tool returned are rejected twice, then the reasons become template reasons and the run is still accepted", async () => {
    const { result, events } = await run({ scenario: "invented-numbers" });
    const finishes = (events as { type: string; tool?: string; ok?: boolean }[]).filter((e) => e.type === "tool-end" && e.tool === "finish_suggestions");
    expect(finishes.map((f) => f.ok)).toEqual([false, false, true]);
    expect(result.status).toBe("done");
    for (const p of result.picks) {
      expect(p.reason).not.toContain("98765");
      expect(p.evidence.ranker).toBe("template");
      expect(p.reason).toMatch(/also like|likes/);
    }
  });

  it("top_tracks isn't even offered until related_artists and crowd_at or rising are in; a model that asks anyway is told, then investigates", async () => {
    const { events, result, mockLearnerCalls } = await run({ scenario: "lazy" });
    const list = events as { type: string; tool?: string; ok?: boolean; summary?: string }[];
    const firstTracks = list.find((e) => e.type === "tool-end" && e.tool === "top_tracks")!;
    expect(firstTracks.ok).toBe(false);
    expect(firstTracks.summary).toMatch(/unavailable tool 'top_tracks'/);
    expect(mockLearnerCalls[0].tools).toEqual(["related_artists", "crowd_at", "rising", "crowd_profile"]);
    expect(mockLearnerCalls.at(-1)!.tools).toContain("finish_suggestions");
    expect(result.status).toBe("done");
  });

  it("a model that never finishes ends at the step cap and the data's picks are used, labelled", async () => {
    const { result } = await run({ scenario: "never-finish", limits: { maxSteps: 6 } });
    expect(result).toMatchObject({ status: "fallback", mode: "fallback", model: "template", endCode: "stopped" });
    expect(result.picks.length).toBeGreaterThanOrEqual(3);
    expect(result.picks.length).toBeLessThanOrEqual(6);
    for (const p of result.picks) expect(p.evidence.ranker).toBe("template");
    const perArtist = new Map<string, number>();
    for (const p of result.picks) perArtist.set(p.artist, (perArtist.get(p.artist) ?? 0) + 1);
    expect(Math.max(...perArtist.values())).toBeLessThanOrEqual(2);
  });

  it("a model that fails outright gives the data's picks, and the server runs the looks itself", async () => {
    const { result, events } = await run({ scenario: "fail" });
    expect(result).toMatchObject({ status: "fallback", mode: "fallback", endCode: "model_unavailable" });
    expect(tools(events)).toEqual(["match_playlist", "history", "related_artists", "crowd_at", "top_tracks"]);
    expect(result.picks.length).toBeGreaterThanOrEqual(3);
  });
});

describe("when the data sources fail", () => {
  it("Qloo down ends the run before any model call: failed, qloo_unavailable, no model prompt", async () => {
    const { result, events, mockLearnerCalls } = await run({ faults: ["qloo"] });
    expect(result).toMatchObject({ status: "failed", endCode: "qloo_unavailable", mode: "none", picks: [] });
    expect(tools(events)).toEqual(["match_playlist"]);
    expect(mockLearnerCalls).toHaveLength(0);
  });

  it("no artist Qloo knows ends the run as no_match", async () => {
    const { result } = await run({
      history: history({ songs: [sung("Nothing", "Nobody Known To Qloo"), sung("Nope", "Zzyzx Unheard"), sung("Never", "Quux Quuz")] }),
      playlist: playlist({ soundsLike: [] }),
    });
    expect(result).toMatchObject({ status: "failed", endCode: "no_match", mode: "none" });
  });

  it("Spotify down: top_tracks takes the songs from Last.fm and says so", async () => {
    const { result, events } = await run({ faults: ["repertoire"] });
    const tt = (events as { type: string; tool?: string; summary?: string }[]).find((e) => e.type === "tool-end" && e.tool === "top_tracks")!;
    expect(tt.summary).toMatch(/Last\.fm for \d/);
    expect(result.status).toBe("done");
    expect(result.picks.every((p) => p.songSource === "lastfm" && p.year === null && p.durationMs === null && p.imageUrl === null)).toBe(true);
  });

  it("when every song found is already in the history, nothing is saved: nothing_new", async () => {
    // Everything Last.fm's synthetic top tracks hold for every artist Qloo may return is already spoken for (dismissed).
    const keys: ReturnType<typeof history>["suggestions"] = [];
    const { syntheticTopTracks } = await import("@/server/adapters/songs/fixtures/synthetic");
    const { CATALOG } = await import("@/server/qloo-mock/catalog");
    for (const a of CATALOG) for (const t of syntheticTopTracks(a.name)) keys.push({ title: t.title, artist: a.name, key: playlistSongKey(a.name, t.title), status: "dismissed", runNumber: 1, at: 1 });
    const out = await run({ history: history({ suggestions: keys }) });
    expect(out.result.picks).toEqual([]);
    expect(out.result.endCode).toBe("nothing_new");
    expect(out.result.status).toBe("done");
  });
});

describe("history is the base of no-repeat", () => {
  it("the Learned list reaches the prompt, and songs you already sing are never picked", async () => {
    const withSung = history({ songs: [...SONGS, sung("Julia Jacklin synthetic song 1", "Julia Jacklin")] });
    const out = await run({ history: withSung });
    expect(out.result.picks.some((p) => p.artist === "Julia Jacklin" && p.title === "Julia Jacklin synthetic song 1")).toBe(false);
  });
});
