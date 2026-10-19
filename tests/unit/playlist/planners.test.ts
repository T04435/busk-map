import { beforeEach, describe, expect, it, vi } from "vitest";
import { planRequestSchema } from "@/lib/plan-schema";
import { usualFromBusks, withBusk, type RecentBusk } from "@/lib/playlist-usual";
import { draftOf, plannerPerformer, plannerSongs, repertoireDraft, sameDraft, songsMatchRepertoire } from "@/lib/repertoire-prefill";
import type { PlaylistView } from "@/lib/playlist-schema";

/** Stage R2: the planners read the Repertoire (docs/playlist-architecture.md §3). */

const SPOTIFY_ID = "4gzpq5DPGxSnKTe4SA8HAU";
const view = (over: Partial<PlaylistView> = {}): PlaylistView => ({
  revision: 4,
  actName: "Jess",
  soundsLike: [{ name: "Paul Kelly", spotifyId: SPOTIFY_ID }, { name: "Missy Higgins" }],
  spotifyArtistId: null,
  usualPitches: [],
  city: "melbourne",
  songs: [
    { id: "1", title: "How to Make Gravy", artist: "Paul Kelly", own: false, state: "can_sing", source: "typed", spotifyTrackId: null, year: null, durationMs: 215_000, image: null, artistImage: null, addedAt: "2026-10-17T00:00:00Z" },
    { id: "2", title: "My Laneway Song", artist: "Jess", own: true, state: "can_sing", source: "typed", spotifyTrackId: null, year: null, durationMs: null, image: null, artistImage: null, addedAt: "2026-10-17T00:00:00Z" },
    { id: "3", title: "Scar", artist: "Missy Higgins", own: false, state: "learned", source: "suggested", spotifyTrackId: null, year: null, durationMs: null, image: null, artistImage: null, addedAt: "2026-10-17T00:00:00Z" },
  ],
  ...over,
});

describe("the prefill mapping", () => {
  it("fills the planners with can-sing and learned songs, exactly the shape of a plan request's songs", () => {
    expect(plannerSongs(view())).toEqual([
      { title: "How to Make Gravy", artist: "Paul Kelly", own: false, durationMs: 215_000 },
      { title: "My Laneway Song", artist: "Jess", own: true },
      { title: "Scar", artist: "Missy Higgins", own: false },
    ]);
  });

  it("makes the performer: the act name, the sounds-like artists (then song artists, never your own name), their Spotify ids", () => {
    const performer = plannerPerformer(view());
    expect(performer.name).toBe("Jess");
    expect(performer.artists).toEqual(["Paul Kelly", "Missy Higgins"]);
    expect(performer.spotifyArtists).toEqual([{ name: "Paul Kelly", id: SPOTIFY_ID }]);
    expect(plannerPerformer(view({ actName: null, soundsLike: [] })).artists).toEqual(["Paul Kelly", "Missy Higgins"]);
    expect(plannerPerformer(view({ actName: null })).name).toBe("My act");
  });

  it("keeps at most 10 artists, which is all a plan request allows", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ name: `Artist ${i}` }));
    expect(plannerPerformer(view({ soundsLike: many })).artists).toHaveLength(10);
  });

  it("leaves no trace of the Repertoire's id or revision in what a request carries", () => {
    const performer = plannerPerformer(view());
    expect(Object.keys(performer).sort()).toEqual(["artists", "name", "songs", "spotifyArtists"]);
    for (const song of performer.songs) expect(Object.keys(song).every((k) => ["title", "artist", "own", "durationMs"].includes(k))).toBe(true);
    // And it is a valid plan request performer as it stands.
    expect(planRequestSchema.shape.performer.safeParse(performer).success).toBe(true);
  });
});

describe("edit for this busk only", () => {
  const saved = view();
  const formDraft = (over: Partial<Parameters<typeof draftOf>[0]> = {}) =>
    draftOf({ name: "Jess", artists: ["Paul Kelly", "Missy Higgins"], songs: plannerSongs(saved), ...over });

  it("an untouched form matches the Repertoire (order, case and spacing aside)", () => {
    expect(sameDraft(formDraft(), repertoireDraft(saved))).toBe(true);
    expect(sameDraft(formDraft({ name: "  Jess ", artists: ["missy higgins", "PAUL KELLY"], songs: [...plannerSongs(saved)].reverse() }), repertoireDraft(saved))).toBe(true);
  });

  it("a removed song, an added song, a changed artist or a changed name all read as edited", () => {
    const songs = plannerSongs(saved);
    expect(sameDraft(formDraft({ songs: songs.slice(1) }), repertoireDraft(saved))).toBe(false);
    expect(sameDraft(formDraft({ songs: [...songs, { title: "Riptide", artist: "Vance Joy" }] }), repertoireDraft(saved))).toBe(false);
    expect(sameDraft(formDraft({ artists: ["Paul Kelly"] }), repertoireDraft(saved))).toBe(false);
    expect(sameDraft(formDraft({ name: "Jess and Co" }), repertoireDraft(saved))).toBe(false);
  });

  it("a busk's snapshot matches the Repertoire only when its songs are exactly the Repertoire's", () => {
    const songs = plannerSongs(saved);
    expect(songsMatchRepertoire(songs, saved)).toBe(true);
    expect(songsMatchRepertoire([...songs].reverse(), saved)).toBe(true);
    expect(songsMatchRepertoire(songs.slice(1), saved)).toBe(false);
    expect(songsMatchRepertoire([], view({ songs: [] }))).toBe(false);
  });
});

describe("usual pitches (D4): the top pitch of the last 3 busks", () => {
  const busk = (key: string, name: string, at = 1): RecentBusk => ({ key, at, name, lat: -37.8, lon: 144.96 });

  it("keeps the newest first and only the last N busks", () => {
    let list: RecentBusk[] = [];
    for (const [k, n] of [["1", "A"], ["2", "B"], ["3", "C"], ["4", "D"]]) list = withBusk(list, busk(k, n), 3);
    expect(list.map((b) => b.name)).toEqual(["D", "C", "B"]);
  });

  it("planning the same busk again moves it up and does not count twice", () => {
    let list: RecentBusk[] = [];
    for (const [k, n] of [["1", "A"], ["2", "B"], ["1", "A"]]) list = withBusk(list, busk(k, n), 3);
    expect(list.map((b) => b.key)).toEqual(["1", "2"]);
  });

  it("two busks at one pitch make one usual pitch", () => {
    expect(usualFromBusks([busk("1", "Bourke Street Mall"), busk("2", "bourke street mall"), busk("3", "Flinders Street")], 3).map((p) => p.name)).toEqual(["Bourke Street Mall", "Flinders Street"]);
  });
});

describe("recording a busk for the Repertoire (the plan stream's end)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  async function setup() {
    vi.resetModules();
    vi.stubEnv("BUSKMAP_OFFLINE", "1");
    vi.stubEnv("VERCEL", "");
    const stores = await import("@/server/playlist/store");
    stores.resetPlaylistStoresForTests();
    const store = stores.playlistStore(true);
    const { hashToken, newToken, PLAYLIST_COOKIE } = await import("@/server/playlist/token");
    const token = newToken();
    const playlist = await store.create(hashToken(token));
    for (const [title, artist] of [["Gravy", "Paul Kelly"], ["Scar", "Missy Higgins"]]) await store.addSong(playlist.id, { title, artist, own: false, source: "typed" });
    const { recordBuskForRepertoire } = await import("@/server/playlist/usual");
    const cookie = `${PLAYLIST_COOKIE}=${token}`;
    const request = (songs = [{ title: "Gravy", artist: "Paul Kelly", own: false }, { title: "Scar", artist: "Missy Higgins", own: false }]) => ({
      performer: { name: "Jess", artists: ["Paul Kelly"], spotifyArtists: [], songs },
    });
    const plan = (name: string) => ({ pitches: [{ name, lat: -37.81, lon: 144.96 }] }) as never;
    return { store, playlist, cookie, request, plan, record: recordBuskForRepertoire };
  }

  it("records the top pitch of a busk planned with the Repertoire, without touching its revision", async () => {
    const { store, playlist, cookie, request, plan, record } = await setup();
    const before = (await store.get(playlist.id))!.revision;
    expect(await record(cookie, request(), plan("Bourke Street Mall"), "k1")).toBe(true);
    const after = (await store.get(playlist.id))!;
    expect(after.usualPitches.map((p) => p.name)).toEqual(["Bourke Street Mall"]);
    expect(after.revision).toBe(before);
  });

  it("keeps the pitches of the last 3 busks, and a re-plan of the same busk counts once", async () => {
    const { store, playlist, cookie, request, plan, record } = await setup();
    for (const [key, name] of [["k1", "A"], ["k2", "B"], ["k2", "B"], ["k3", "C"], ["k4", "D"]]) await record(cookie, request(), plan(name), key);
    expect((await store.get(playlist.id))!.usualPitches.map((p) => p.name)).toEqual(["D", "C", "B"]);
  });

  it("records nothing for a busk with edited songs, an example, no cookie, another device's cookie or no pitch", async () => {
    const { store, playlist, cookie, request, plan, record } = await setup();
    expect(await record(cookie, request([{ title: "Gravy", artist: "Paul Kelly", own: false }]), plan("A"), "k1")).toBe(false);
    expect(await record(cookie, request(), plan("A"), "k2", { example: true })).toBe(false);
    expect(await record(null, request(), plan("A"), "k3")).toBe(false);
    expect(await record(`buskmap_playlist=${"z".repeat(22)}`, request(), plan("A"), "k4")).toBe(false);
    expect(await record(cookie, request(), { pitches: [] } as never, "k5")).toBe(false);
    expect((await store.get(playlist.id))!.usualPitches).toEqual([]);
  });
});
