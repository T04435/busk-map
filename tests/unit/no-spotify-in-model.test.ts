import { beforeEach, describe, expect, it, vi } from "vitest";
import { wrapLanguageModel, type LanguageModel } from "ai";
import { EXAMPLES } from "@/lib/examples";
import { planRequestSchema } from "@/lib/plan-schema";
import { CATALOG } from "@/server/qloo-mock/catalog";
import { mockFetch, OFFLINE } from "../helpers";
import { cache, cachedLookupScope, history, playlist, setupFetch, SONGS, sung } from "./learn/helpers";

/**
 * Spotify's Developer Terms (v10, 15 May 2025) §IV.2 bar "ingesting Spotify Content into a machine learning or AI model".
 * These tests capture everything each model call is sent (system prompt, user prompt and every tool result the model
 * reads) and check that no Spotify-sourced field is in it, while the display data (ids, links, years) still reaches the
 * page, joined after the model call.
 */
vi.mock("@/server/adapters/qloo/usage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo/usage")>();
  return { ...original, lookupScope: cachedLookupScope(original) };
});

beforeEach(() => cache.clear());

/** Wrap a model so every call's prompt (messages and tool results) is kept, as JSON. */
function recording(model: LanguageModel) {
  const sent: string[] = [];
  const wrapped = wrapLanguageModel({
    model: model as Parameters<typeof wrapLanguageModel>[0]["model"],
    middleware: {
      transformParams: async ({ params }) => {
        sent.push(JSON.stringify(params.prompt));
        return params;
      },
    },
  });
  return { sent, model: wrapped };
}

/** The Spotify ids the offline fixtures use for artists. */
const CATALOG_SPOTIFY_IDS = CATALOG.map((a) => a.spotifyId).filter((id): id is string => typeof id === "string" && id.length === 22);

/** Spotify-sourced material in what a model was sent: links, covers, the fields that carry it, and any of the given ids. */
function spotifyIn(text: string, ids: readonly string[]): string[] {
  const patterns = [/open\.spotify\.com/i, /scdn\.co/i, /spotifyTrackId|spotifyId|spotifyGenres|\bfollowers\b/i, /\\?"image\\?":/, /\\?"durationMs\\?":\d/, /\\?"year\\?":\d/];
  return [...patterns.filter((p) => p.test(text)).map((p) => p.source), ...ids.filter((id) => text.includes(id))];
}

describe("the learn agent (ToolLoopAgent): nothing from Spotify in its prompt or tool results", () => {
  it("top_tracks gives the model Last.fm songs only; Spotify's ids and links join the picks after the model call", async () => {
    vi.resetModules();
    await setupFetch();
    const { runLearnAgent } = await import("@/server/learn/agent");
    const { LearnContext } = await import("@/server/learn/context");
    const { createMockLearner } = await import("@/server/learn/mock-model");
    const { withQlooUsage } = await import("@/server/adapters/qloo/usage");
    const rec = recording(createMockLearner("investigate"));
    const result = await withQlooUsage((usage) => runLearnAgent(new LearnContext(OFFLINE, playlist(), history(), "2026-10-17", usage), {}, undefined, { model: rec.model }));
    expect(result.status).toBe("done");
    expect(rec.sent.length).toBeGreaterThan(1);
    expect(rec.sent.some((s) => s.includes("top_tracks") && s.includes("tool-result") && /"songId":"s-\d+"/.test(s))).toBe(true);
    // The display join happened: the saved picks carry Spotify's ids, links and years.
    const ids = result.picks.flatMap((p) => (p.spotifyTrackId ? [p.spotifyTrackId] : []));
    expect(ids.length).toBe(result.picks.length);
    expect(result.picks.every((p) => p.songSource === "spotify" && p.year !== null && p.sourceUrl?.startsWith("https://open.spotify.com/track/"))).toBe(true);
    // ...and none of it was in anything the model read.
    for (const sent of rec.sent) expect(spotifyIn(sent, [...ids, ...CATALOG_SPOTIFY_IDS])).toEqual([]);
  });
});

describe("the learn prompt: the act's own songs read from Spotify are re-sourced from Last.fm or left out", () => {
  // Research step 2 saves the act's catalogue as own songs with source "spotify". One of them is also in Last.fm's top
  // tracks for the act (the synthetic fixture lists "<artist> synthetic song N"), one is not. A song the performer picked
  // from the Spotify search themselves (own: false) is user input and stays.
  const act = "Julia Jacklin";
  const onLastfm = { ...sung("JULIA JACKLIN SYNTHETIC SONG 2 - Remastered 2020", act), own: true, source: "spotify" as const };
  const notOnLastfm = { ...sung("Spotify Only Deep Cut", act), own: true, source: "spotify" as const };
  const picked = { ...sung("Picked From Search", "Courtney Barnett"), own: false, source: "spotify" as const };
  const withOwn = () => history({ songs: [...SONGS, onLastfm, notOnLastfm, picked] });

  it("historyForModel keeps Last.fm's version of a Spotify-read song, drops one Last.fm lacks, and keeps the performer's picks", async () => {
    vi.resetModules();
    const { historyForModel, formatHistory } = await import("@/server/learn/history");
    const h = withOwn();
    const safe = await historyForModel(h, OFFLINE);
    const text = formatHistory(safe).text;
    expect(text).toContain(`${act} synthetic song 2`);
    expect(text).not.toMatch(/SYNTHETIC SONG 2|Remastered|Spotify Only Deep Cut/);
    expect(text).toContain("Picked From Search");
    expect(text).toContain("Dumb Things");
    // The full history (the no-repeat filter) is untouched.
    expect(h.songs).toHaveLength(SONGS.length + 3);
    // Last.fm down: every Spotify-read song is left out, nothing else.
    const down = formatHistory(await historyForModel(h, { offline: true, faults: ["songs"] })).text;
    expect(down).not.toMatch(/synthetic song 2|Spotify Only Deep Cut/i);
    expect(down).toContain("Picked From Search");
  });

  it("the learn agent's model is sent no Spotify-read title, and an unmatched Spotify-only artist name isn't named", async () => {
    vi.resetModules();
    await setupFetch();
    const { runLearnAgent } = await import("@/server/learn/agent");
    const { LearnContext } = await import("@/server/learn/context");
    const { createMockLearner } = await import("@/server/learn/mock-model");
    const { withQlooUsage } = await import("@/server/adapters/qloo/usage");
    const unknownAct = { ...sung("Unheard Original", "Zzq Spotify Spelling"), own: true, source: "spotify" as const };
    const rec = recording(createMockLearner("investigate"));
    const h = history({ songs: [...withOwn().songs, unknownAct] });
    const result = await withQlooUsage((usage) => runLearnAgent(new LearnContext(OFFLINE, playlist(), h, "2026-10-17", usage), {}, undefined, { model: rec.model }));
    expect(result.status).toBe("done");
    const all = rec.sent.join("\n");
    expect(all).toContain(`${act} synthetic song 2`);
    expect(all).not.toMatch(/SYNTHETIC SONG 2|Remastered|Spotify Only Deep Cut|Unheard Original|Zzq Spotify Spelling/);
    expect(all).toContain("Picked From Search");
    // The no-repeat filter still knows every song: none of the act's own songs is offered.
    const own = new Set(h.songs.map((s) => s.key));
    for (const p of result.picks) expect(own.has(p.songKey)).toBe(false);
  });
});

describe("the Repertoire research ranking call: nothing from Spotify in its prompt", () => {
  async function setup() {
    vi.resetModules();
    await setupFetch();
    const tools = await import("@/server/learn/tools");
    const summary = await import("@/server/research/summary");
    const { LearnContext } = await import("@/server/learn/context");
    const ctx = new LearnContext(OFFLINE, playlist(), history(), "2026-10-17", { calls: 0, cacheHits: 0 });
    const state = new tools.LearnState();
    state.artists.set("a1", { id: "a1", name: "Gordi", from: "related_artists", affinity: 0.8, because: ["Julia Jacklin"], growth: null, trendDelta: null, pitch: null, related: true, listeners: null });
    // The worst case: songs that already carry Spotify display data (a join, or an older record). None of it may reach the prompt.
    const spotifyId = "4uLU6hMCjMI75M1A2tKUQC";
    for (const [i, title] of ["One", "Two", "Three"].entries()) {
      state.found.set(`s-${i + 1}`, { songId: `s-${i + 1}`, songKey: `gordi|${title.toLowerCase()}`, title, artist: "Gordi", artistId: "a1", spotifyTrackId: spotifyId, year: 2019, durationMs: 201_234, image: "https://i.scdn.co/image/abc", sourceUrl: `https://open.spotify.com/track/${spotifyId}`, source: "spotify", popularity: 87 });
    }
    const facts = { act: "Test Act", description: "A Qloo description.", audience: ["Dreamy"], genres: ["Indie Folk"], soundsLike: ["Julia Jacklin"], fansLove: ["Gordi"], ageLean: "25–29", genderLean: null };
    return { summary, ctx, state, facts, spotifyId };
  }

  it("summaryPrompt has the songs' titles, artists and Qloo fans only: no Spotify id, link, cover, year, length or popularity", async () => {
    const { summary, state, facts, spotifyId } = await setup();
    const prompt = summary.summaryPrompt(facts, state);
    expect(prompt).toContain('"title":"One"');
    expect(prompt).toContain('"fansOf":["Julia Jacklin"]');
    expect(spotifyIn(prompt, [spotifyId])).toEqual([]);
    expect(prompt).not.toMatch(/2019|201234|\b87\b|popularity|source/);
  });

  it("the facts type has no Spotify fields, and the model call is sent nothing from Spotify", async () => {
    const { summary, ctx, state, facts, spotifyId } = await setup();
    // @ts-expect-error Spotify genres are not a summary fact any more.
    const bad: import("@/server/research/summary").SummaryFacts = { ...facts, spotifyGenres: ["indie"] };
    void bad;
    const rec = recording(summary.createMockResearchWriter("ok"));
    const result = await summary.summarise(facts, state, ctx, { offline: true, model: rec.model });
    expect(result.accepted?.picks.length).toBeGreaterThan(0);
    expect(rec.sent).toHaveLength(1);
    expect(spotifyIn(rec.sent[0], [spotifyId])).toEqual([]);
    expect(rec.sent[0]).not.toMatch(/2019|201234/);
  });
});

describe("the busk agent (/busks Hive ToolLoopAgent): no tool result carries Spotify data", () => {
  it("build_setlist shows no release year or Spotify field; the plan still shows them, joined after", async () => {
    vi.resetModules();
    mockFetch([]);
    const base = planRequestSchema.parse({ city: "melbourne", slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer: EXAMPLES[0].performer });
    const request = planRequestSchema.parse({ ...base, performer: { ...base.performer, fillSuggested: 4 } });
    const { PlanContext } = await import("@/server/agent/context");
    const { runPlanAgent } = await import("@/server/agent/agent");
    const { createMockPlanner } = await import("@/server/agent/mock-model");
    const rec = recording(createMockPlanner());
    const events: { tool: string; output: unknown }[] = [];
    const { plan } = await runPlanAgent(new PlanContext(request, OFFLINE, "2026-10-15"), { onToolEnd: (e) => events.push(e) }, undefined, { model: rec.model });
    // Every one of the tools the model called returned to it; build_setlist among them.
    expect(rec.sent.some((s) => s.includes("build_setlist") && s.includes("tool-result") && s.includes('"suggested":true'))).toBe(true);
    const setlist = plan.pitches.flatMap((p) => p.setlist);
    const suggested = setlist.filter((s) => s.origin === "suggested");
    expect(suggested.length).toBeGreaterThan(0);
    // The page keeps Spotify's display data: suggested songs link to Spotify, songs show their year.
    expect(suggested.every((s) => s.suggestion?.source === "spotify" && /^[A-Za-z0-9]{22}$/.test(s.suggestion.spotifyTrackId ?? ""))).toBe(true);
    expect(setlist.some((s) => s.year !== null)).toBe(true);
    // The step on the page shows the year again (joined after the model read the output).
    const step = events.find((e) => e.tool === "build_setlist")!.output as { songs: { year: number | null }[] };
    expect(step.songs.some((s) => s.year !== null)).toBe(true);
    const ids = suggested.map((s) => s.suggestion!.spotifyTrackId!);
    for (const sent of rec.sent) {
      expect(spotifyIn(sent, [...ids, ...CATALOG_SPOTIFY_IDS])).toEqual([]);
      expect(sent).not.toMatch(/from (19|20)\d\d\b/);
    }
  });

  it("setlistForModel drops the year and its clause; reasonWithoutYear keeps every other clause", async () => {
    const { setlistForModel } = await import("@/server/agent/tools");
    const { reasonWithoutYear } = await import("@/server/scoring/setlist");
    expect(reasonWithoutYear("Strong crowd affinity for Oasis; 1.2M Last.fm plays; from 1995: a good era fit for a crowd leaning 25–34")).toBe("Strong crowd affinity for Oasis; 1.2M Last.fm plays");
    expect(reasonWithoutYear("Strong crowd affinity for Oasis; from 1995")).toBe("Strong crowd affinity for Oasis");
    expect(reasonWithoutYear("Your own song: scored with your typical crowd affinity")).toBe("Your own song: scored with your typical crowd affinity");
    const entry = { songId: "s", title: "Wonderwall", artist: "Oasis", own: false, score: 80, affinity: 1, affinitySource: "qloo" as const, playcount: 5, reason: "Strong crowd affinity for Oasis; from 1995", durationMs: 258_000, year: 1995, eraFit: 0.8, origin: "suggested" as const, suggestion: { because: "x", source: "spotify" as const, sourceUrl: "https://open.spotify.com/track/abc", spotifyTrackId: "1qPbGZqppFwLwcBC1JQ6Vr", image: "https://i.scdn.co/image/x" }, artistImage: "https://i.scdn.co/image/y", localScene: false };
    const [row] = setlistForModel([entry]);
    expect(row).toEqual({ order: 1, song: "Wonderwall", artist: "Oasis", score: 80, why: "Strong crowd affinity for Oasis", suggested: true });
  });
});

describe("the week agent (/week Hive ToolLoopAgent): nothing from Spotify in its prompt or tool results", () => {
  it("a whole week's prompt and every tool result it reads carry no Spotify id, link, cover, year or length", async () => {
    vi.resetModules();
    mockFetch([]);
    const { weekRequestSchema, defaultDays } = await import("@/lib/week-schema");
    const { runWeekAgent } = await import("@/server/agent/week");
    const { createMockWeekPlanner } = await import("@/server/agent/mock-model");
    // The act carries Spotify ids for its artists and Spotify lengths for its songs (picked from search): none may reach the model.
    const base = planRequestSchema.parse({ city: "melbourne", slot: { date: "2026-10-17", startHour: 18, endHour: 21 }, performer: EXAMPLES[0].performer }).performer;
    const spotifyArtists = [{ name: base.artists[0], id: "4Z8W4fKeB5YxbusRsdQVPb" }];
    const performer = { ...base, spotifyArtists, fillSuggested: 4, songs: base.songs.map((s) => ({ ...s, durationMs: 201_234 })) };
    const week = weekRequestSchema.parse({ performer, startDate: "2026-10-17", days: defaultDays("2026-10-17") });
    const rec = recording(createMockWeekPlanner());
    const run = await runWeekAgent(week, OFFLINE, "2026-10-15", {}, undefined, { model: rec.model, now: new Date("2026-10-15T12:00:00+11:00") });
    expect(run.week.days.some((d) => d.status === "ready")).toBe(true);
    expect(rec.sent.length).toBeGreaterThan(3);
    expect(rec.sent.some((s) => s.includes("score_pitches") && s.includes("tool-result"))).toBe(true);
    for (const sent of rec.sent) {
      expect(spotifyIn(sent, [...spotifyArtists.map((a) => a.id), ...CATALOG_SPOTIFY_IDS])).toEqual([]);
      expect(sent).not.toMatch(/201234/);
    }
  });
});

describe("catalogueOf: the candidate songs come from Last.fm, whatever Spotify says", () => {
  it("returns Last.fm's songs with every Spotify field empty, Spotify up or down", async () => {
    vi.resetModules();
    const { catalogueOf } = await import("@/server/songs/catalogue");
    for (const faults of [[], ["repertoire"]] as const) {
      const c = await catalogueOf("Julia Jacklin", "AU", { offline: true, faults });
      expect(c.source).toBe("lastfm");
      expect(c.tracks.length).toBeGreaterThan(0);
      expect(c.tracks.every((t) => t.spotifyTrackId === null && t.year === null && t.durationMs === null && t.image === null)).toBe(true);
    }
    expect((await catalogueOf("Julia Jacklin", "AU", { offline: true, faults: ["songs"] })).tracks).toEqual([]);
  });
});

describe("the research ask's genre call (the Hive's suggestions): names only, nothing from Spotify", () => {
  it("is sent the act's name and its sound-alikes' names, never their Spotify ids, photos, genres or links", async () => {
    vi.resetModules();
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    vi.stubEnv("VERCEL", "");
    const sent: string[] = [];
    vi.doMock("@/server/research/hive-genres", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/server/research/hive-genres")>();
      return {
        ...original,
        hiveGenres: (input: Parameters<typeof original.hiveGenres>[0], options: Parameters<typeof original.hiveGenres>[1]) => {
          const rec = recording(original.createMockGenreModel());
          return original.hiveGenres(input, { ...options, model: rec.model }).finally(() => sent.push(...rec.sent));
        },
      };
    });
    try {
      (await import("@/server/playlist/store")).resetPlaylistStoresForTests();
      (await import("@/server/learn/store")).resetLearnStoresForTests();
      (await import("@/server/learn/runs")).clearLearnRunsForTests();
      const { OFFLINE_SPOTIFY_ONLY_ARTISTS, OFFLINE_TEST_ACTS } = await import("@/lib/repertoire-research");
      const route = await import("@/app/api/playlist/research/route");
      const act = OFFLINE_TEST_ACTS.taggedAlikes;
      const res = await route.POST(new Request("http://localhost:3100/api/playlist/research", { method: "POST", headers: { "content-type": "application/json", host: "localhost:3100" }, body: JSON.stringify({ link: act.spotifyId }) }));
      expect(await res.text()).toContain("needs_sounds_like");
      expect(sent).toHaveLength(1);
      // The names (Last.fm's sound-alikes, the act's name) are there; their Spotify ids, photos and links are not.
      for (const name of act.similar) expect(sent[0]).toContain(name);
      const ids = [act.spotifyId, ...Object.values(OFFLINE_SPOTIFY_ONLY_ARTISTS).map((a) => a.spotifyId)];
      expect(spotifyIn(sent[0], ids)).toEqual([]);
      expect(sent[0]).not.toMatch(/offline-dny-omy|offline-lkm-kimi|followers|genres":\[/);
    } finally {
      vi.doUnmock("@/server/research/hive-genres");
    }
  });
});
