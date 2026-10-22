import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlistSongKey } from "@/lib/playlist-schema";
import { cache, cachedLookupScope, history, playlist, setupFetch } from "./helpers";

vi.mock("@/server/adapters/qloo/usage", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/adapters/qloo/usage")>();
  return { ...original, lookupScope: cachedLookupScope(original) };
});

type Exec = (input: unknown, options: unknown) => Promise<unknown>;
const exec = (t: { execute?: unknown }, input: unknown) => (t.execute as Exec)(input, { toolCallId: "t", messages: [] });

async function load(over: { history?: ReturnType<typeof history>; playlist?: ReturnType<typeof playlist> } = {}) {
  vi.resetModules();
  await setupFetch();
  const tools = await import("@/server/learn/tools");
  const { LearnContext } = await import("@/server/learn/context");
  const { withQlooUsage } = await import("@/server/adapters/qloo/usage");
  const usage = { calls: 0, cacheHits: 0 };
  const ctx = new LearnContext({ offline: true, faults: [] }, over.playlist ?? playlist(), over.history ?? history(), "2026-10-17", usage);
  const state = new tools.LearnState();
  const t = tools.createLearnTools(ctx, state);
  // Qloo counting needs the run's counter in async context.
  const inRun = <T>(fn: () => Promise<T>) => withQlooUsage(async (u) => (Object.assign(usage, u), fn().finally(() => Object.assign(usage, u))));
  return { ...tools, ctx, state, t, usage, inRun, withQlooUsage };
}

beforeEach(() => cache.clear());

/** Match the seeds, open the gates by investigating, and look up songs: the usual path of a run. */
async function investigated(over: Parameters<typeof load>[0] = {}) {
  const m = await load(over);
  const result = await m.withQlooUsage(async (u) => {
    const ctx = Object.assign(m.ctx, { usage: u });
    await ctx.matchPlaylist();
    const related = (await exec(m.t.related_artists, { take: 12 })) as { artists: { artistId: string; name: string; alreadyInPlaylist: boolean }[] };
    await exec(m.t.crowd_at, { pitch: "Bourke Street Mall", take: 8 });
    return { related };
  });
  return { ...m, ...result };
}

describe("gating (investigate first)", () => {
  it("top_tracks and finish_suggestions are closed until the looks are in, with a message the model can act on", async () => {
    const m = await load();
    await expect(exec(m.t.top_tracks, { artistIds: ["x"], perArtist: 2 })).rejects.toThrow(/^top_tracks isn't open yet: investigate first\. Still needed: related_artists at least once and crowd_at or rising at least once\.$/);
    await expect(exec(m.t.finish_suggestions, { picks: [{ songId: "s-1", reason: "x" }], summary: "s", notes: [] })).rejects.toThrow(/^finish_suggestions isn't open yet: call top_tracks first/);
    // the gated calls cost no cap slot
    expect(m.state.calls).toEqual({});
    expect(m.songsOpen({ successes: { related_artists: 1 }, wrappingUp: false })).toBe(false);
    expect(m.songsOpen({ successes: { related_artists: 1, rising: 1 }, wrappingUp: false })).toBe(true);
    expect(m.songsOpen({ successes: { related_artists: 1, crowd_at: 1 }, wrappingUp: false })).toBe(true);
    expect(m.songsOpen({ successes: {}, wrappingUp: true })).toBe(true);
    expect(m.gateMessage({ successes: { crowd_at: 1 } })).toBe("top_tracks isn't open yet: investigate first. Still needed: related_artists at least once.");
  });

  it("opens after related_artists plus crowd_at, and finish opens once top_tracks has returned songs", async () => {
    const m = await investigated();
    const out = (await exec(m.t.top_tracks, { artistIds: m.related.artists.filter((a) => !a.alreadyInPlaylist).slice(0, 2).map((a) => a.artistId), perArtist: 2 })) as { songs: unknown[] };
    expect(out.songs.length).toBeGreaterThan(0);
    expect(m.finishOpen(m.state)).toBe(true);
  });

  it("per-tool call caps: a further call is a tool error the model sees", async () => {
    const m = await investigated();
    await exec(m.t.related_artists, { take: 5 });
    await expect(exec(m.t.related_artists, { take: 6 })).rejects.toThrow(/related_artists can be used 2 times in a run/);
    await exec(m.t.crowd_at, { pitch: "city", take: 5 });
    await exec(m.t.crowd_at, { pitch: "city", take: 6 });
    await expect(exec(m.t.crowd_at, { pitch: "city", take: 7 })).rejects.toThrow(/crowd_at can be used 3 times/);
  });

  it("zod rejects bad inputs: a pitch that isn't one of the usual pitches, take out of range, too many ids", async () => {
    const m = await load();
    const schema = (name: keyof typeof m.t) => (m.t[name] as unknown as { inputSchema: { safeParse: (v: unknown) => { success: boolean } } }).inputSchema;
    expect(schema("crowd_at").safeParse({ pitch: "Bourke Street Mall" }).success).toBe(true);
    expect(schema("crowd_at").safeParse({ pitch: "city" }).success).toBe(true);
    expect(schema("crowd_at").safeParse({ pitch: "Somewhere else" }).success).toBe(false);
    expect(schema("related_artists").safeParse({ take: 3 }).success).toBe(false);
    expect(schema("related_artists").safeParse({ take: 31 }).success).toBe(false);
    expect(schema("rising").safeParse({ artistIds: [] }).success).toBe(false);
    expect(schema("rising").safeParse({ artistIds: ["1", "2", "3", "4", "5", "6"] }).success).toBe(false);
    expect(schema("top_tracks").safeParse({ artistIds: ["1", "2", "3", "4", "5"] }).success).toBe(false);
    expect(schema("top_tracks").safeParse({ artistIds: ["1"], perArtist: 4 }).success).toBe(false);
  });

  it("ids only from this run's own results: rising and top_tracks refuse an artist id the run hasn't met, listing the ones it has", async () => {
    const m = await investigated();
    await expect(exec(m.t.rising, { artistIds: ["made-up"] })).rejects.toThrow(/Unknown artistId made-up: use ids returned by related_artists or crowd_at/);
    await expect(exec(m.t.top_tracks, { artistIds: ["made-up"], perArtist: 1 })).rejects.toThrow(/Unknown artistId made-up.*Known: /);
    await expect(exec(m.t.related_artists, { seeds: ["Nobody Real"], take: 5 })).rejects.toThrow(/None of Nobody Real is a matched artist/);
  });

  it("an artist's songs are looked up once", async () => {
    const m = await investigated();
    const id = m.related.artists.find((a) => !a.alreadyInPlaylist)!.artistId;
    await exec(m.t.top_tracks, { artistIds: [id], perArtist: 1 });
    await expect(exec(m.t.top_tracks, { artistIds: [id], perArtist: 1 })).rejects.toThrow(/already looked up songs by/);
  });
});

describe("top_tracks filters the whole history on the server", () => {
  it("leaves out suggested, dismissed and sung songs, counts each, and never lets the prompt's truncation matter", async () => {
    const m = await investigated();
    const artist = m.related.artists.find((a) => !a.alreadyInPlaylist)!;
    // The history holds the artist's synthetic song 1 (pending), 2 (dismissed) and 3 (sung). These sets are what the
    // server filters on; the prompt's block is only a (truncated) view of them. The songs are Last.fm's (five per artist).
    const title = (n: number) => `${artist.name} synthetic song ${n}`;
    const key = (n: number) => playlistSongKey(artist.name, title(n));
    m.ctx.keys.suggested.add(key(1));
    m.ctx.keys.dismissed.add(key(2));
    m.ctx.keys.known.add(key(3));
    const out = (await exec(m.t.top_tracks, { artistIds: [artist.artistId], perArtist: 3 })) as { songs: { title: string }[]; skipped: Record<string, number>; checked: number; summary: string };
    expect(out.songs.map((s) => s.title)).toEqual([title(4), title(5)]);
    expect(out.skipped).toEqual({ alreadySuggested: 1, dismissed: 1, canSing: 1 });
    expect(out.checked).toBe(5);
    expect(out.summary).toBe("Picked top tracks on Last.fm for 1 artist. Left out 1 song suggested before and 1 song you dismissed and 1 song you already sing");
  });

  it("an artist with 3 or more songs in the Repertoire is left out before any catalogue lookup", async () => {
    const m = await investigated();
    const artist = m.related.artists.find((a) => !a.alreadyInPlaylist)!;
    m.ctx.perArtist.set(artist.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(), 3);
    const out = (await exec(m.t.top_tracks, { artistIds: [artist.artistId], perArtist: 3 })) as { songs: unknown[]; overRepresented: string[]; checked: number; summary: string };
    expect(out).toMatchObject({ songs: [], overRepresented: [artist.name], checked: 0 });
    expect(out.summary).toContain("already well covered in your Repertoire");
    expect(m.state.coveredSeen).toBe(1);
  });

  it("the songs the model reads come from Last.fm only: no Spotify id, link, cover, year or length, with Spotify up or down", async () => {
    for (const faults of [[], ["repertoire"]] as const) {
      const m = await load();
      const ctx = Object.assign(m.ctx, { adapters: { offline: true, faults } });
      await m.withQlooUsage(async (u) => {
        Object.assign(ctx, { usage: u });
        await ctx.matchPlaylist();
        const rel = (await exec(m.t.related_artists, { take: 8 })) as { artists: { artistId: string }[] };
        await exec(m.t.crowd_at, { pitch: "city", take: 5 });
        const out = (await exec(m.t.top_tracks, { artistIds: [rel.artists[0].artistId], perArtist: 2 })) as { songs: { source: string; year: number | null; durationMs: number | null }[]; summary: string };
        expect(out.songs.length).toBeGreaterThan(0);
        expect(out.songs.every((s) => s.source === "lastfm" && s.year === null && s.durationMs === null)).toBe(true);
        expect(out.summary).toMatch(/^Picked top tracks on Last\.fm for 1 artist/);
        expect(JSON.stringify(out)).not.toMatch(/spotify|scdn\.co|"image"|"url"|spotifyTrackId/i);
        for (const f of m.state.found.values()) expect(f).toMatchObject({ source: "lastfm", spotifyTrackId: null, image: null, year: null, durationMs: null });
      });
    }
  });

  it("joinSpotifyDisplay adds Spotify's id, link, year and length to the picked songs only, after the model call", async () => {
    const m = await investigated();
    const ids = m.related.artists.filter((a) => !a.alreadyInPlaylist).slice(0, 2).map((a) => a.artistId);
    const out = (await exec(m.t.top_tracks, { artistIds: ids, perArtist: 2 })) as { songs: { songId: string }[] };
    const [picked, other] = out.songs;
    await m.joinSpotifyDisplay(m.state, [picked.songId], m.ctx);
    expect(m.state.found.get(picked.songId)).toMatchObject({ source: "spotify", spotifyTrackId: expect.stringMatching(/^[A-Za-z0-9]{22}$/), sourceUrl: expect.stringMatching(/^https:\/\/open\.spotify\.com\/track\//), year: expect.any(Number), durationMs: expect.any(Number) });
    expect(m.state.found.get(other.songId)).toMatchObject({ source: "lastfm", spotifyTrackId: null, year: null });
    const [row] = m.buildSuggestions({ picks: [{ songId: picked.songId, reason: "Fans of X love this.", buildsOn: null, templated: false }], summary: "", notes: [] }, m.state, m.ctx, "mock");
    expect(row).toMatchObject({ songSource: "spotify", spotifyTrackId: m.state.found.get(picked.songId)!.spotifyTrackId, year: expect.any(Number) });
  });

  it("joinSpotifyDisplay with Spotify down leaves the Last.fm record as it was", async () => {
    const m = await investigated();
    const ids = m.related.artists.filter((a) => !a.alreadyInPlaylist).slice(0, 1).map((a) => a.artistId);
    const out = (await exec(m.t.top_tracks, { artistIds: ids, perArtist: 1 })) as { songs: { songId: string }[] };
    const before = { ...m.state.found.get(out.songs[0].songId)! };
    await m.joinSpotifyDisplay(m.state, [out.songs[0].songId], { market: m.ctx.market, adapters: { offline: true, faults: ["repertoire"] } });
    expect(m.state.found.get(out.songs[0].songId)).toEqual(before);
  });
});

describe("the Qloo budget", () => {
  it("a Qloo tool that could cross the run's budget returns 'budget used up' instead of calling", async () => {
    const m = await load();
    await m.withQlooUsage(async (u) => {
      Object.assign(m.ctx, { usage: u });
      await m.ctx.matchPlaylist();
      u.calls = 24; // 25 is the cap
      const ok = (await exec(m.t.related_artists, { take: 5 })) as { skipped?: string; artists?: unknown[] };
      expect(ok.artists?.length).toBeGreaterThan(0); // 1 request fits (24 + 1 <= 25)
      u.calls = 25;
      expect(await exec(m.t.crowd_at, { pitch: "city", take: 5 })).toMatchObject({ summary: "The Qloo budget for this run is used up. Choose songs with what you have.", skipped: "budget" });
      // rising reserves its worst case: ids plus the window probes
      const rel = m.state.artists.keys().next().value!;
      u.calls = 20;
      expect(await exec(m.t.rising, { artistIds: [rel] })).toMatchObject({ skipped: "budget" });
      // a skip is not a success: it doesn't open the gates
      expect(m.state.successes.crowd_at).toBeUndefined();
    });
  });
});

describe("checkPicks (§2.6)", () => {
  async function ready() {
    const m = await investigated({ history: history({ suggestions: [{ title: "Old Pick", artist: "Someone", key: playlistSongKey("Someone", "Old Pick"), status: "learned", runNumber: 1, at: 1 }] }) });
    const ids = m.related.artists.filter((a) => !a.alreadyInPlaylist).slice(0, 3).map((a) => a.artistId);
    const out = (await exec(m.t.top_tracks, { artistIds: ids, perArtist: 3 })) as { songs: { songId: string; artistId: string; title: string; artist: string }[] };
    return { ...m, songs: out.songs };
  }
  const pick = (songId: string, reason = "Fans of your songs like this one.") => ({ songId, reason });
  const answer = (picks: ReturnType<typeof pick>[], summary = "Three songs.") => ({ picks, summary, notes: [] as string[] });

  it("accepts a clean answer; every pick is from this run's catalogue", async () => {
    const m = await ready();
    const per = new Map<string, number>();
    const first = m.songs.filter((s) => (per.set(s.artistId, (per.get(s.artistId) ?? 0) + 1), per.get(s.artistId)! <= 2)).slice(0, 3);
    expect(first).toHaveLength(3);
    expect(m.checkPicks(answer(first.map((s) => pick(s.songId))), m.state, m.ctx)).toEqual([]);
  });

  it("rejects an id that top_tracks did not return in this run, listing the valid ones", async () => {
    const m = await ready();
    const problems = m.checkPicks(answer([pick("s-999"), pick(m.songs[0].songId), pick(m.songs[3].songId)]), m.state, m.ctx);
    expect(problems.map((p) => p.kind)).toContain("pool");
    expect(problems.find((p) => p.kind === "pool")!.message).toMatch(/Not from this run's top_tracks: s-999\. Use songIds that top_tracks returned\. Valid: s-1 \(/);
  });

  it("rejects a song already in the history (each status), a duplicate pick, a third song by one artist and an over-represented artist", async () => {
    const m = await ready();
    const one = m.songs.filter((s) => s.artistId === m.songs[0].artistId);
    expect(one.length).toBe(3);
    // a third song by one artist
    expect(m.checkPicks(answer(one.map((s) => pick(s.songId))), m.state, m.ctx).map((p) => p.kind)).toContain("artist");
    // a duplicate
    expect(m.checkPicks(answer([pick(one[0].songId), pick(one[0].songId), pick(m.songs[3].songId)]), m.state, m.ctx).find((p) => p.kind === "repeat")!.message).toBe("Each song only once.");
    // the history changes while the run goes on (a backstop): each status is refused
    for (const status of ["pending", "learned", "dismissed"] as const) {
      const key = m.state.found.get(one[0].songId)!.songKey;
      const ctx2 = { ...m.ctx, keys: { dismissed: new Set<string>(status === "dismissed" ? [key] : []), suggested: new Set<string>(status === "dismissed" ? [] : [key]), known: new Set<string>() }, perArtist: m.ctx.perArtist };
      const problems = m.checkPicks(answer([pick(one[0].songId), pick(m.songs[3].songId), pick(m.songs[4].songId)]), m.state, ctx2);
      expect(problems.find((p) => p.kind === "repeat")!.message).toMatch(/is already in the history: never offer a song twice\./);
    }
    // an over-represented artist
    const over = { ...m.ctx, perArtist: new Map([[m.state.found.get(one[0].songId)!.artist.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(), 3]]) };
    expect(m.checkPicks(answer([pick(one[0].songId), pick(m.songs[3].songId), pick(m.songs[4].songId)]), m.state, over).map((p) => p.kind)).toContain("artist");
  });

  it("rejects numbers that no tool returned, but allows ones it did (years, counts)", async () => {
    const m = await ready();
    const three = [m.songs[0], m.songs[3], m.songs[5]].filter(Boolean).slice(0, 3);
    const ids = three.map((s) => s.songId);
    const bad = m.checkPicks(answer(ids.map((id, i) => pick(id, i === 0 ? "About 98765 people like this." : "Fans like it."))), m.state, m.ctx);
    expect(bad.find((p) => p.kind === "numbers")).toMatchObject({ numbers: ["98765"] });
    const year = m.state.found.get(ids[0])!.year;
    expect(m.checkPicks(answer(ids.map((id, i) => pick(id, i === 0 ? `Out in ${year}, a crowd favourite.` : "Fans like it."))), m.state, m.ctx).filter((p) => p.kind === "numbers")).toEqual([]);
  });

  it("needs at least min(3, valid songs) picks", async () => {
    const m = await ready();
    expect(m.checkPicks(answer([pick(m.songs[0].songId)]), m.state, m.ctx).map((p) => p.kind)).toContain("count");
    expect(m.wantedPicks(m.state)).toBe(3);
    expect(m.wantedPicks({ found: new Map([["s-1", { artistId: "a" } as never]]) })).toBe(1);
    expect(m.wantedPicks({ found: new Map([["s-1", { artistId: "a" }], ["s-2", { artistId: "a" }], ["s-3", { artistId: "a" }]] as never) })).toBe(2);
  });

  it("buildsOn names a Learned song only if it is on the Learned list; otherwise it is dropped silently", async () => {
    const m = await ready();
    const ids = [m.songs[0], m.songs[3], m.songs[5]].map((s) => s.songId);
    const accepted = m.acceptAnswer({ ...answer(ids.map((id) => pick(id))), picks: ids.map((id, i) => ({ songId: id, reason: "Fans like it.", buildsOn: i === 0 ? "OLD PICK" : i === 1 ? "Not Learned" : undefined })) }, m.ctx);
    expect(accepted.picks.map((p) => p.buildsOn)).toEqual(["Old Pick", null, null]);
    const built = m.buildSuggestions(accepted, m.state, m.ctx, "claude");
    expect(built[0].evidence.basedOn).toContainEqual({ kind: "learned", name: "Old Pick" });
    // catalogue fields come from the record, whatever the model wrote
    expect(built.map((b) => b.title)).toEqual(ids.map((id) => m.state.found.get(id)!.title));
    expect(built.map((b) => b.rank)).toEqual([1, 2, 3]);
  });

  it("after two rejections: number-only problems keep their picks with the template reason, rule breaks are dropped, too few left gives up", async () => {
    const m = await ready();
    const one = m.songs.filter((s) => s.artistId === m.songs[0].artistId);
    const others = m.songs.filter((s) => s.artistId !== m.songs[0].artistId);
    const picks = [
      { songId: one[0].songId, reason: "About 98765 people like it." },
      { songId: one[1].songId, reason: "Fans like it." },
      { songId: one[2].songId, reason: "Fans like it." }, // a third by one artist: dropped
      { songId: "s-999", reason: "Made up." }, // not this run's: dropped
      { songId: others[0].songId, reason: "Fans like it." },
    ];
    const salvaged = m.salvageAnswer({ picks, summary: "Songs, about 98765 fans.", notes: ["Ok.", "98765 fans"] }, m.state, m.ctx)!;
    expect(salvaged.picks.map((p) => p.songId)).toEqual([one[0].songId, one[1].songId, others[0].songId]);
    expect(salvaged.picks[0]).toMatchObject({ templated: true });
    expect(salvaged.picks[0].reason).toMatch(/^Fans of .* also like .*\./);
    expect(salvaged.picks[0].reason).not.toContain("98765");
    expect(salvaged.summary).toMatch(/picked from the data\.$/);
    expect(salvaged.notes).toEqual(["Ok."]);
    expect(m.salvageAnswer({ picks: [{ songId: "s-999", reason: "x" }], summary: "s", notes: [] }, m.state, m.ctx)).toBeNull();
  });

  it("a run that's rejected twice goes through the tool: rejection, rejection, then the salvaged answer", async () => {
    const m = await ready();
    const ids = [m.songs[0], m.songs[3], m.songs[5]].map((s) => s.songId);
    const bad = { picks: ids.map((id) => ({ songId: id, reason: "About 98765 fans." })), summary: "s", notes: [] };
    for (let i = 0; i < 2; i++) expect(await exec(m.t.finish_suggestions, bad)).toMatchObject({ accepted: false });
    expect(m.state.rejections).toBe(2);
    expect(await exec(m.t.finish_suggestions, bad)).toMatchObject({ accepted: true });
    expect(m.state.answer!.picks.every((p) => p.templated)).toBe(true);
    expect(m.state.templatedReasons).toBe(3);
  });
});

describe("the fallback (§2.6)", () => {
  it("ranks by growth, then the trend, then affinity with a bonus for related + crowd; 2 songs per artist, up to 6, template reasons", async () => {
    const { fallbackAnswer, rankArtists, FALLBACK_PICKS } = await import("@/server/learn/fallback");
    const art = (id: string, over: object) => ({ id, name: `Artist ${id}`, from: "related_artists", affinity: 0.5, because: ["Paul Kelly"], growth: null, trendDelta: null, pitch: null, related: true, listeners: null, ...over });
    const state = {
      artists: new Map([
        ["a", art("a", { affinity: 0.9 })],
        ["b", art("b", { growth: 0.2 })],
        ["c", art("c", { trendDelta: 3 })],
        ["d", art("d", { affinity: 0.6, pitch: "Bourke Street Mall" })],
        ["e", art("e", { affinity: 0.1, listeners: 5 })],
      ]),
      found: new Map(),
    } as never as Parameters<typeof fallbackAnswer>[0];
    expect(rankArtists(state).map((a) => a.id)).toEqual(["b", "c", "a", "d", "e"]);
    let n = 0;
    for (const id of ["a", "b", "c", "d", "e"]) for (let i = 0; i < 3; i++) state.found.set(`s-${++n}`, { songId: `s-${n}`, artistId: id } as never);
    const answer = fallbackAnswer(state)!;
    expect(answer.picks).toHaveLength(FALLBACK_PICKS);
    expect(FALLBACK_PICKS).toBe(6);
    // the best three artists, 2 each
    expect(answer.picks.map((p) => state.found.get(p.songId)!.artistId)).toEqual(["b", "b", "c", "c", "a", "a"]);
    expect(answer.picks.every((p) => p.templated && p.buildsOn === null)).toBe(true);
    expect(answer.picks[0].reason).toBe("Fans of Paul Kelly also like Artist b.");
    expect(answer.summary).toBe("6 songs your fans and crowds like, picked from the data.");
    // reasons carry only known numbers: none
    expect(answer.picks.every((p) => !/\d/.test(p.reason))).toBe(true);
    expect(fallbackAnswer({ artists: state.artists, found: new Map() })).toBeNull();
  });
});

describe("what the tools return", () => {
  it("their one-line summaries, the example card lines in docs §7.1", async () => {
    const m = await investigated();
    const rel = (await exec(m.t.related_artists, { take: 5 })) as { summary: string };
    expect(rel.summary).toBe("Found 5 artists your fans also like");
    const profile = (await exec(m.t.crowd_profile, {})) as { summary: string; ageLean: string | null; bands: { band: string }[] };
    expect(profile.summary).toMatch(/^Your fans lean /);
    const ctx = m.ctx;
    const match = await m.withQlooUsage(async (u) => (Object.assign(ctx, { usage: u }), ctx.matchPlaylist()));
    expect(match.output.summary).toBe("Matched your 5 songs to 4 artists on Qloo");
  });
});
