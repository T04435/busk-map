import { describe, expect, it } from "vitest";
import { MAX_SONGS } from "@/server/playlist/config";
import { MemoryPlaylistStore, PostgresPlaylistStore, sweepExpiredLazily, toPlaylistView, type PlaylistStore } from "@/server/playlist/store";
import { hashToken, newToken } from "@/server/playlist/token";

const song = (n: number | string, extra: object = {}) => ({ title: `Song ${n}`, artist: "Artist", own: false, source: "typed" as const, ...extra });
const DAY = 24 * 60 * 60_000;

/** The contract both stores keep. The Postgres one runs here against a recording fake in the SQL-shape tests below. */
describe("MemoryPlaylistStore", () => {
  const make = async () => {
    const store: PlaylistStore = new MemoryPlaylistStore();
    const playlist = await store.create(hashToken(newToken()));
    return { store, playlist };
  };

  it("finds a Repertoire by token hash only", async () => {
    const store = new MemoryPlaylistStore();
    const token = newToken();
    const made = await store.create(hashToken(token));
    expect((await store.findByTokenHash(hashToken(token)))?.id).toBe(made.id);
    expect(await store.findByTokenHash(hashToken(newToken()))).toBeNull();
    expect(JSON.stringify([...store.playlists.values()])).not.toContain(token);
  });

  it("keeps the research snapshot without bumping the revision, and the view carries it", async () => {
    const { store, playlist } = await make();
    expect(toPlaylistView(playlist, []).research).toBeNull();
    const snapshot = { version: 1 as const, spotifyArtistId: "x".repeat(22), fullRunId: "r1", runId: "r1", runNumber: 1, mode: "full" as const, at: "2026-10-17T00:00:00.000Z", steps: {} };
    expect(await store.saveResearch(playlist.id, snapshot)).toBe(true);
    const after = (await store.get(playlist.id))!;
    expect(after.revision).toBe(playlist.revision);
    expect(toPlaylistView(after, []).research).toEqual(snapshot);
    expect(await store.saveResearch("missing", snapshot)).toBe(false);
  });

  it("starts empty, adds a can-sing song, and refuses a repeat by song key", async () => {
    const { store, playlist } = await make();
    expect(await store.songs(playlist.id)).toEqual([]);
    const added = await store.addSong(playlist.id, song(1, { title: "Riptide", artist: "Vance Joy" }));
    expect(added).toMatchObject({ ok: true, song: { state: "can_sing", title: "Riptide" } });
    expect(await store.addSong(playlist.id, song(1, { title: "RIPTIDE (Remastered)", artist: "vance joy" }))).toEqual({ ok: false, reason: "duplicate" });
    expect(await store.songs(playlist.id)).toHaveLength(1);
  });

  it("allows the same song in two Repertoires", async () => {
    const a = await make();
    const b = await make();
    expect((await a.store.addSong(a.playlist.id, song(1))).ok).toBe(true);
    expect((await b.store.addSong(b.playlist.id, song(1))).ok).toBe(true);
  });

  it("refuses the 61st song (can sing + learned together)", async () => {
    const { store, playlist } = await make();
    for (let i = 0; i < MAX_SONGS; i++) {
      const r = await store.addSong(playlist.id, song(i));
      expect(r.ok).toBe(true);
      if (i % 2 && r.ok) await store.setSongState(playlist.id, r.song.id, "learned");
    }
    expect(await store.addSong(playlist.id, song("one more"))).toEqual({ ok: false, reason: "full" });
    expect(await store.songs(playlist.id)).toHaveLength(MAX_SONGS);
  });

  it("moves a song between can_sing and learned, and removes it", async () => {
    const { store, playlist } = await make();
    const r = await store.addSong(playlist.id, song(1));
    if (!r.ok) throw new Error("add failed");
    expect((await store.setSongState(playlist.id, r.song.id, "learned"))?.state).toBe("learned");
    expect((await store.setSongState(playlist.id, r.song.id, "can_sing"))?.state).toBe("can_sing");
    expect(await store.setSongState(playlist.id, "999", "learned")).toBeNull();
    expect(await store.removeSong(playlist.id, r.song.id)).toBe(true);
    expect(await store.removeSong(playlist.id, r.song.id)).toBe(false);
  });

  it("a song id from another Repertoire is not found", async () => {
    const a = await make();
    const b = await make();
    const r = await a.store.addSong(a.playlist.id, song(1));
    if (!r.ok) throw new Error("add failed");
    expect(await b.store.removeSong(b.playlist.id, r.song.id)).toBe(false);
    expect(await b.store.setSongState(b.playlist.id, r.song.id, "learned")).toBeNull();
    expect(await a.store.songs(a.playlist.id)).toHaveLength(1);
  });

  it("bumps the revision on every write and refuses a stale update with a 409's reason", async () => {
    const { store, playlist } = await make();
    expect(playlist.revision).toBe(1);
    await store.addSong(playlist.id, song(1));
    expect((await store.get(playlist.id))?.revision).toBe(2);
    expect(await store.update(playlist.id, { revision: 1, actName: "Jess" })).toEqual({ ok: false, reason: "stale" });
    const ok = await store.update(playlist.id, { revision: 2, actName: "Jess", soundsLike: [{ name: "Paul Kelly" }] });
    expect(ok).toMatchObject({ ok: true, playlist: { actName: "Jess", revision: 3, soundsLike: [{ name: "Paul Kelly" }] } });
    expect(await store.update("missing", { revision: 1, actName: "x" })).toEqual({ ok: false, reason: "missing" });
  });

  it("forget deletes the Repertoire and its songs", async () => {
    const store = new MemoryPlaylistStore();
    const hash = hashToken(newToken());
    const p = await store.create(hash);
    await store.addSong(p.id, song(1));
    expect(await store.forget(p.id)).toBe(true);
    expect(await store.findByTokenHash(hash)).toBeNull();
    expect(await store.songs(p.id)).toEqual([]);
    expect(await store.forget(p.id)).toBe(false);
  });

  it("touches last_seen at most once an hour, and sweeps Repertoires unseen for 13 months", async () => {
    const store = new MemoryPlaylistStore();
    const hash = hashToken(newToken());
    const t0 = Date.parse("2026-01-01T00:00:00Z");
    await store.create(hash, t0);
    expect((await store.findByTokenHash(hash, t0 + 10 * 60_000))?.lastSeenAt).toBe(t0);
    expect((await store.findByTokenHash(hash, t0 + 2 * 60 * 60_000))?.lastSeenAt).toBe(t0 + 2 * 60 * 60_000);
    const old = hashToken(newToken());
    await store.create(old, t0);
    expect(await store.sweepExpired(t0 + 400 * DAY)).toBe(2);
    expect(await store.findByTokenHash(old)).toBeNull();
  });

  it("shapes the view without the song key or any id of the Repertoire", async () => {
    const { store, playlist } = await make();
    await store.addSong(playlist.id, song(1));
    const view = toPlaylistView((await store.get(playlist.id))!, await store.songs(playlist.id));
    expect(view.maxSongs).toBe(60);
    expect(JSON.stringify(view)).not.toContain(playlist.id);
    expect(view.songs[0]).not.toHaveProperty("songKey");
  });
});

/** The SQL the Postgres store sends: parameterised, with the limit and no-repeat rule in the one statement. */
describe("PostgresPlaylistStore SQL shape", () => {
  function fake(results: unknown[][]) {
    const calls: { text: string; params: unknown[] }[] = [];
    const query = async (text: string, params: unknown[] = []) => (calls.push({ text, params }), results.shift() ?? []);
    // A transaction runs its statements in order: the fake answers each from the same list.
    const transaction = async (build: (txn: { query: (t: string, p?: unknown[]) => { text: string; params: unknown[] } }) => { text: string; params: unknown[] }[]) => {
      const out: unknown[] = [];
      for (const q of build({ query: (text, params = []) => ({ text, params }) })) out.push(await query(q.text, q.params));
      return out;
    };
    return { store: new PostgresPlaylistStore({ query, transaction } as never), calls };
  }
  const songRow = { id: "7", song_key: "artist|song 1", state: "can_sing", source: "typed", title: "Song 1", artist: "Artist", own: false, spotify_track_id: null, year: null, duration_ms: null, added_at: new Date() };

  it("adds a song under a row lock: lock the playlist, then one conditional INSERT (limit + ON CONFLICT), then bump the revision", async () => {
    const { store, calls } = fake([[{ id: "pid" }], [songRow], []]);
    const r = await store.addSong("pid", song(1));
    expect(r).toMatchObject({ ok: true, song: { id: "7", state: "can_sing" } });
    // The lock comes first, so the count in the INSERT is read after any concurrent save has committed (READ COMMITTED).
    expect(calls[0].text).toMatch(/^SELECT id FROM playlists WHERE id = \$1::uuid FOR UPDATE$/);
    expect(calls[0].params).toEqual(["pid"]);
    expect(calls[1].text).toMatch(/INSERT INTO playlist_songs/);
    expect(calls[1].text).toMatch(/count\(\*\) FROM playlist_songs WHERE playlist_id = \$1::uuid AND state IN \('can_sing', 'learned'\)\) < \$10/);
    expect(calls[1].text).toMatch(/ON CONFLICT \(playlist_id, song_key\) DO NOTHING/);
    expect(calls[1].params[1]).toBe("artist|song 1");
    expect(calls[1].params[9]).toBe(MAX_SONGS);
    expect(calls[2].text).toMatch(/revision = revision \+ 1/);
  });

  it("tells a repeat from a full list when the INSERT returns nothing", async () => {
    const dup = fake([[{ id: "pid" }], [], [{ one: 1 }]]);
    expect(await dup.store.addSong("pid", song(1))).toEqual({ ok: false, reason: "duplicate" });
    const full = fake([[{ id: "pid" }], [], []]);
    expect(await full.store.addSong("pid", song(1))).toEqual({ ok: false, reason: "full" });
  });

  it("the memory store lets two simultaneous saves at 59 songs land only one", async () => {
    const store = new MemoryPlaylistStore();
    const p = await store.create(hashToken(newToken()));
    for (let i = 0; i < MAX_SONGS - 1; i++) await store.addSong(p.id, song(i));
    const results = await Promise.all([store.addSong(p.id, song("x")), store.addSong(p.id, song("y"))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "full" }]);
    expect(await store.songs(p.id)).toHaveLength(MAX_SONGS);
  });

  it("scopes every song write to the playlist id and never lets a non-numeric id reach the cast", async () => {
    const { store, calls } = fake([[songRow], []]);
    await store.setSongState("pid", "7", "learned");
    expect(calls[0].text).toMatch(/WHERE playlist_id = \$1 AND id = \$2::bigint/);
    const none = fake([]);
    expect(await none.store.removeSong("pid", "1; DROP TABLE playlists")).toBe(false);
    expect(await none.store.setSongState("pid", "abc", "learned")).toBeNull();
    expect(none.calls).toHaveLength(0);
  });

  it("finds by hash, touching last_seen only when it is over an hour old", async () => {
    const row = (seen: Date) => ({ id: "pid", act_name: null, sounds_like: [], usual_pitches: [], city: "melbourne", revision: 1, created_at: seen, last_seen_at: seen });
    const fresh = fake([[row(new Date())]]);
    await fresh.store.findByTokenHash("h".repeat(64));
    expect(fresh.calls).toHaveLength(1);
    expect(fresh.calls[0].text).toMatch(/WHERE token_hash = \$1/);
    const stale = fake([[row(new Date(Date.now() - 3 * 60 * 60_000))], []]);
    await stale.store.findByTokenHash("h".repeat(64));
    expect(stale.calls[1].text).toMatch(/UPDATE playlists SET last_seen_at = now\(\)/);
  });

  it("updates with the revision in the WHERE, and reports stale vs missing", async () => {
    const stale = fake([[], [{ one: 1 }]]);
    expect(await stale.store.update("pid", { revision: 3, actName: "x" })).toEqual({ ok: false, reason: "stale" });
    expect(stale.calls[0].text).toMatch(/WHERE id = \$1 AND revision = \$2/);
    const missing = fake([[], []]);
    expect(await missing.store.update("pid", { revision: 3, actName: "x" })).toEqual({ ok: false, reason: "missing" });
  });

  it("forgets by id and sweeps by last_seen_at", async () => {
    const f = fake([[{ id: "pid" }], [{ id: "a" }, { id: "b" }]]);
    expect(await f.store.forget("pid")).toBe(true);
    expect(f.calls[0].text).toMatch(/DELETE FROM playlists WHERE id = \$1/);
    expect(await f.store.sweepExpired()).toBe(2);
    expect(f.calls[1].text).toMatch(/DELETE FROM playlists WHERE last_seen_at </);
  });

  it("sweeps expired Repertoires lazily: on a read, at most once an hour, never throwing", async () => {
    const store = new MemoryPlaylistStore();
    const old = await store.create(hashToken(newToken()));
    const t0 = Date.now() + 1000 * DAY; // far enough ahead that this process has not swept within the hour
    expect(await sweepExpiredLazily(store, t0 + 400 * DAY)).toBe(1);
    expect(await store.get(old.id)).toBeNull();
    // A second call inside the hour does nothing, even with another expired row.
    const another = await store.create(hashToken(newToken()));
    expect(await sweepExpiredLazily(store, t0 + 400 * DAY + 60_000)).toBe(0);
    expect(await store.get(another.id)).not.toBeNull();
    expect(await sweepExpiredLazily(store, t0 + 400 * DAY + 2 * 60 * 60_000)).toBe(1); // an hour on, the next read sweeps again
    // A failing store is swallowed and retried next time.
    const broken = { sweepExpired: async () => { throw new Error("db down"); } } as unknown as PlaylistStore;
    expect(await sweepExpiredLazily(broken, t0 + 800 * DAY)).toBe(0);
    expect(await sweepExpiredLazily(store, t0 + 800 * DAY + 1)).toBe(0);
  });

  it("creates storing only the hash", async () => {
    const hash = hashToken("t");
    const f = fake([[], [{ id: "pid", act_name: null, sounds_like: [], usual_pitches: [], city: "melbourne", revision: 1, created_at: new Date(), last_seen_at: new Date() }]]);
    await f.store.create(hash);
    expect(f.calls[1].text).toMatch(/INSERT INTO playlists \(token_hash\)/);
    expect(f.calls[1].params).toEqual([hash]);
  });
});

describe("plan suggestions and busks (R2)", () => {
  it("the Postgres store adds a plan suggestion with one conditional INSERT, and tells a repeat from a song you sing", async () => {
    const calls: { text: string; params: unknown[] }[] = [];
    const results: unknown[][] = [[], [], [{ one: 1 }], [], []];
    const sql = { query: async (text: string, params: unknown[]) => (calls.push({ text, params }), results.shift() ?? []) };
    const store = new PostgresPlaylistStore(sql as never);
    // Nothing inserted, no song row: already suggested.
    expect(await store.addPlanSuggestion("pid", { title: "Zed", artist: "Q", reason: "r", growth: null })).toEqual({ ok: false, reason: "already_suggested" });
    expect(calls[0].text).toMatch(/INSERT INTO learn_suggestions[\s\S]*WHERE NOT EXISTS \(SELECT 1 FROM playlist_songs[\s\S]*ON CONFLICT \(playlist_id, song_key\) DO NOTHING/);
    expect(calls[0].text).toMatch(/'plan'[\s\S]*'pending'/);
    expect(calls[0].text).not.toMatch(/run_id/);
    expect(calls[0].params[0]).toBe("pid");
    // Nothing inserted and the song is sung.
    results.unshift([], [{ one: 1 }]);
    expect(await store.addPlanSuggestion("pid", { title: "Zed", artist: "Q", reason: "r", growth: null })).toEqual({ ok: false, reason: "in_repertoire" });
  });

  it("recording a busk writes only the busk list and the usual pitches, never the revision", async () => {
    const calls: string[] = [];
    const results: unknown[][] = [[{ recent_busks: [] }], []];
    const sql = { query: async (text: string) => (calls.push(text), results.shift() ?? []) };
    const store = new PostgresPlaylistStore(sql as never);
    const usual = await store.recordBusk("pid", { key: "k", at: 1, name: "Bourke Street Mall", lat: -37.8, lon: 144.9 });
    expect(usual).toEqual([{ name: "Bourke Street Mall", lat: -37.8, lon: 144.9 }]);
    expect(calls[1]).toMatch(/UPDATE playlists SET recent_busks = \$2::jsonb, usual_pitches = \$3::jsonb WHERE id = \$1/);
    expect(calls[1]).not.toMatch(/revision/);
  });

  it("saving the research snapshot writes only the snapshot and its time, never the revision", async () => {
    const calls: { text: string; params: unknown[] }[] = [];
    const sql = { query: async (text: string, params: unknown[]) => (calls.push({ text, params }), [{ id: "pid" }]) };
    const store = new PostgresPlaylistStore(sql as never);
    const snapshot = { version: 1 as const, spotifyArtistId: "x".repeat(22), fullRunId: "r1", runId: "r1", runNumber: 1, mode: "full" as const, at: "2026-10-17T00:00:00.000Z", steps: {} };
    expect(await store.saveResearch("pid", snapshot)).toBe(true);
    expect(calls[0].text).toMatch(/UPDATE playlists SET research = \$2::jsonb, research_at = now\(\) WHERE id = \$1/);
    expect(calls[0].text).not.toMatch(/revision/);
    expect(JSON.parse(calls[0].params[1] as string)).toEqual(snapshot);
  });

  it("an edit that carries songs claims the revision first and changes songs only through that row", async () => {
    const calls: { text: string; params: unknown[] }[] = [];
    const sql = { query: async (text: string, params: unknown[]) => (calls.push({ text, params }), [] as unknown[]) };
    const store = new PostgresPlaylistStore(sql as never);
    const song = (title: string) => ({ title, artist: "A", own: false, source: "typed" as const });
    await store.update("pid", { revision: 3, songs: [song("One"), song("ONE"), song("Two")] });
    const { text, params } = calls[0];
    expect(text).toMatch(/WITH upd AS \(\s*UPDATE playlists[\s\S]*WHERE id = \$1 AND revision = \$2/);
    expect(text).toMatch(/DELETE FROM playlist_songs[\s\S]*playlist_id IN \(SELECT id FROM upd\)/);
    expect(text).toMatch(/FROM upd, jsonb_to_recordset/);
    expect(params[8]).toBe(true);
    expect(JSON.parse(params[9] as string).map((s: { title: string }) => s.title)).toEqual(["One", "Two"]);
    // Without songs, nothing about songs is touched.
    calls.length = 0;
    await store.update("pid", { revision: 3, actName: "Jess" });
    expect(calls[0].params[8]).toBe(false);
    expect(JSON.parse(calls[0].params[9] as string)).toEqual([]);
  });
});
