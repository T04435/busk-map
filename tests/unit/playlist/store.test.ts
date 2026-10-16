import { describe, expect, it } from "vitest";
import { MAX_SONGS } from "@/server/playlist/config";
import { MemoryPlaylistStore, PostgresPlaylistStore, toPlaylistView, type PlaylistStore } from "@/server/playlist/store";
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
    const sql = { query: async (text: string, params: unknown[] = []) => (calls.push({ text, params }), results.shift() ?? []) };
    return { store: new PostgresPlaylistStore(sql as never), calls };
  }
  const songRow = { id: "7", song_key: "artist|song 1", state: "can_sing", source: "typed", title: "Song 1", artist: "Artist", own: false, spotify_track_id: null, year: null, duration_ms: null, added_at: new Date() };

  it("adds a song with one conditional INSERT (limit + ON CONFLICT), then bumps the revision", async () => {
    const { store, calls } = fake([[songRow], []]);
    const r = await store.addSong("pid", song(1));
    expect(r).toMatchObject({ ok: true, song: { id: "7", state: "can_sing" } });
    expect(calls[0].text).toMatch(/INSERT INTO playlist_songs/);
    expect(calls[0].text).toMatch(/count\(\*\) FROM playlist_songs WHERE playlist_id = \$1::uuid AND state IN \('can_sing', 'learned'\)\) < \$10/);
    expect(calls[0].text).toMatch(/ON CONFLICT \(playlist_id, song_key\) DO NOTHING/);
    expect(calls[0].params[1]).toBe("artist|song 1");
    expect(calls[0].params[9]).toBe(MAX_SONGS);
    expect(calls[1].text).toMatch(/revision = revision \+ 1/);
  });

  it("tells a repeat from a full list when the INSERT returns nothing", async () => {
    const dup = fake([[], [{ one: 1 }]]);
    expect(await dup.store.addSong("pid", song(1))).toEqual({ ok: false, reason: "duplicate" });
    const full = fake([[], []]);
    expect(await full.store.addSong("pid", song(1))).toEqual({ ok: false, reason: "full" });
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

  it("creates storing only the hash", async () => {
    const hash = hashToken("t");
    const f = fake([[], [{ id: "pid", act_name: null, sounds_like: [], usual_pitches: [], city: "melbourne", revision: 1, created_at: new Date(), last_seen_at: new Date() }]]);
    await f.store.create(hash);
    expect(f.calls[1].text).toMatch(/INSERT INTO playlists \(token_hash\)/);
    expect(f.calls[1].params).toEqual([hash]);
  });
});
