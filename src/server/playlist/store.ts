import "server-only";
import { neon } from "@neondatabase/serverless";
import { playlistSongKey, type AddSongInput, type PatchPlaylistInput, type PlaylistSongView, type PlaylistView, type SongSource, type SongState, type SoundsLike, type UsualPitch } from "@/lib/playlist-schema";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { processMap } from "@/server/memo";
import { MAX_SONGS, PLAYLIST_EXPIRY_MONTHS, TOUCH_INTERVAL_MS } from "./config";

/**
 * Repertoires (tables `playlists` and `playlist_songs`, migrations/004_playlists.sql).
 * Found by the sha256 of the cookie token; the id never leaves the server.
 */
export type PlaylistRecord = {
  id: string;
  actName: string | null;
  soundsLike: SoundsLike[];
  usualPitches: UsualPitch[];
  city: string;
  revision: number;
  createdAt: number;
  lastSeenAt: number;
};

export type StoredSong = Omit<PlaylistSongView, "addedAt"> & { songKey: string; addedAt: number };

export type AddSongResult = { ok: true; song: StoredSong } | { ok: false; reason: "duplicate" | "full" };
export type UpdateResult = { ok: true; playlist: PlaylistRecord } | { ok: false; reason: "stale" | "missing" };

export interface PlaylistStore {
  readonly kind: "postgres" | "memory";
  /** The Repertoire for a token hash, or null. Touches last_seen_at (at most once an hour). */
  findByTokenHash(tokenHash: string, now?: number): Promise<PlaylistRecord | null>;
  create(tokenHash: string, now?: number): Promise<PlaylistRecord>;
  /** By internal id, without touching last_seen_at (to read the revision after a write). */
  get(playlistId: string): Promise<PlaylistRecord | null>;
  songs(playlistId: string): Promise<StoredSong[]>;
  /** Adds a "can sing" song. Refuses a repeat (same song key) and the 61st song, in one conditional statement. */
  addSong(playlistId: string, song: AddSongInput): Promise<AddSongResult>;
  setSongState(playlistId: string, songId: string, state: SongState): Promise<StoredSong | null>;
  removeSong(playlistId: string, songId: string): Promise<boolean>;
  /** Act name, sounds like, usual pitches. A stale `revision` is refused. */
  update(playlistId: string, patch: PatchPlaylistInput): Promise<UpdateResult>;
  /** Forget: the Repertoire and (by cascade) everything under it. */
  forget(playlistId: string): Promise<boolean>;
  /** Delete Repertoires not seen for 13 months. Returns how many. */
  sweepExpired(now?: number): Promise<number>;
}

const MONTH_MS = 30 * 24 * 60 * 60_000;
const expiryCutoff = (now: number) => now - PLAYLIST_EXPIRY_MONTHS * MONTH_MS;

export function toSongView(song: StoredSong): PlaylistSongView {
  const { songKey: _key, addedAt, ...rest } = song; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...rest, addedAt: new Date(addedAt).toISOString() };
}

export function toPlaylistView(playlist: PlaylistRecord, songs: StoredSong[]): PlaylistView {
  return {
    revision: playlist.revision,
    actName: playlist.actName,
    soundsLike: playlist.soundsLike,
    usualPitches: playlist.usualPitches,
    city: playlist.city,
    songs: songs.map(toSongView),
    maxSongs: MAX_SONGS,
  };
}

export class MemoryPlaylistStore implements PlaylistStore {
  readonly kind = "memory" as const;
  /** Keyed by token hash. */
  readonly playlists = new Map<string, PlaylistRecord & { tokenHash: string }>();
  readonly songRows = new Map<string, StoredSong[]>();
  private nextSongId = 1;

  private byId(id: string) {
    for (const p of this.playlists.values()) if (p.id === id) return p;
    return undefined;
  }

  async findByTokenHash(tokenHash: string, now = Date.now()) {
    const row = this.playlists.get(tokenHash);
    if (!row) return null;
    if (now - row.lastSeenAt > TOUCH_INTERVAL_MS) row.lastSeenAt = now;
    return this.record(row);
  }

  async get(playlistId: string) {
    const row = this.byId(playlistId);
    return row ? this.record(row) : null;
  }

  private record(row: PlaylistRecord & { tokenHash: string }): PlaylistRecord {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tokenHash: _hash, ...rest } = structuredClone(row);
    return rest;
  }

  async create(tokenHash: string, now = Date.now()) {
    const row = { id: crypto.randomUUID(), tokenHash, actName: null, soundsLike: [], usualPitches: [], city: "melbourne", revision: 1, createdAt: now, lastSeenAt: now };
    this.playlists.set(tokenHash, row);
    this.songRows.set(row.id, []);
    if (this.playlists.size > 1000) {
      const oldest = this.playlists.keys().next().value!;
      this.songRows.delete(this.playlists.get(oldest)!.id);
      this.playlists.delete(oldest);
    }
    return this.record(row);
  }

  async songs(playlistId: string) {
    return structuredClone(this.songRows.get(playlistId) ?? []);
  }

  private bump(playlistId: string) {
    const p = this.byId(playlistId);
    if (p) p.revision++;
  }

  async addSong(playlistId: string, input: AddSongInput): Promise<AddSongResult> {
    const rows = this.songRows.get(playlistId);
    if (!rows) return { ok: false, reason: "full" };
    const songKey = playlistSongKey(input.artist, input.title);
    if (rows.some((s) => s.songKey === songKey)) return { ok: false, reason: "duplicate" };
    if (rows.length >= MAX_SONGS) return { ok: false, reason: "full" };
    const song: StoredSong = {
      id: String(this.nextSongId++),
      songKey,
      title: input.title,
      artist: input.artist,
      own: input.own,
      state: "can_sing",
      source: input.source,
      spotifyTrackId: input.spotifyTrackId ?? null,
      year: input.year ?? null,
      durationMs: input.durationMs ?? null,
      addedAt: Date.now(),
    };
    rows.push(song);
    this.bump(playlistId);
    return { ok: true, song: structuredClone(song) };
  }

  async setSongState(playlistId: string, songId: string, state: SongState) {
    const song = this.songRows.get(playlistId)?.find((s) => s.id === songId);
    if (!song) return null;
    song.state = state;
    this.bump(playlistId);
    return structuredClone(song);
  }

  async removeSong(playlistId: string, songId: string) {
    const rows = this.songRows.get(playlistId);
    const index = rows?.findIndex((s) => s.id === songId) ?? -1;
    if (!rows || index < 0) return false;
    rows.splice(index, 1);
    this.bump(playlistId);
    return true;
  }

  async update(playlistId: string, patch: PatchPlaylistInput): Promise<UpdateResult> {
    const row = this.byId(playlistId);
    if (!row) return { ok: false, reason: "missing" };
    if (row.revision !== patch.revision) return { ok: false, reason: "stale" };
    if (patch.actName !== undefined) row.actName = patch.actName;
    if (patch.soundsLike) row.soundsLike = structuredClone(patch.soundsLike);
    if (patch.usualPitches) row.usualPitches = structuredClone(patch.usualPitches);
    row.revision++;
    return { ok: true, playlist: this.record(row) };
  }

  async forget(playlistId: string) {
    const row = this.byId(playlistId);
    if (!row) return false;
    this.playlists.delete(row.tokenHash);
    this.songRows.delete(playlistId);
    return true;
  }

  async sweepExpired(now = Date.now()) {
    let n = 0;
    for (const row of [...this.playlists.values()]) {
      if (row.lastSeenAt < expiryCutoff(now)) {
        await this.forget(row.id);
        n++;
      }
    }
    return n;
  }
}

type Sql = ReturnType<typeof neon>;
type Time = string | Date;
const ms = (v: Time) => new Date(v).getTime();

type PlaylistRow = {
  id: string;
  act_name: string | null;
  sounds_like: SoundsLike[];
  usual_pitches: UsualPitch[];
  city: string;
  revision: number;
  created_at: Time;
  last_seen_at: Time;
};

type SongRow = {
  id: string;
  song_key: string;
  state: SongState;
  source: SongSource;
  title: string;
  artist: string;
  own: boolean;
  spotify_track_id: string | null;
  year: number | null;
  duration_ms: number | null;
  added_at: Time;
};

const PLAYLIST_COLUMNS = "id, act_name, sounds_like, usual_pitches, city, revision, created_at, last_seen_at";
const SONG_COLUMNS = "id::text AS id, song_key, state, source, title, artist, own, spotify_track_id, year, duration_ms, added_at";

const toRecord = (r: PlaylistRow): PlaylistRecord => ({
  id: r.id,
  actName: r.act_name,
  soundsLike: r.sounds_like,
  usualPitches: r.usual_pitches,
  city: r.city,
  revision: r.revision,
  createdAt: ms(r.created_at),
  lastSeenAt: ms(r.last_seen_at),
});

const toSong = (r: SongRow): StoredSong => ({
  id: r.id,
  songKey: r.song_key,
  title: r.title,
  artist: r.artist,
  own: r.own,
  state: r.state,
  source: r.source,
  spotifyTrackId: r.spotify_track_id,
  year: r.year,
  durationMs: r.duration_ms,
  addedAt: ms(r.added_at),
});

/** Song ids are BIGSERIAL: anything else can't match a row (and must not reach the cast). */
const isSongId = (id: string) => /^\d{1,18}$/.test(id);

/** Neon over the pooled DATABASE_URL (HTTP driver). Every statement is parameterised. */
export class PostgresPlaylistStore implements PlaylistStore {
  readonly kind = "postgres" as const;
  constructor(private readonly sql: Sql) {}

  async findByTokenHash(tokenHash: string, now = Date.now()) {
    const rows = (await this.sql.query(`SELECT ${PLAYLIST_COLUMNS} FROM playlists WHERE token_hash = $1`, [tokenHash])) as PlaylistRow[];
    const row = rows[0];
    if (!row) return null;
    if (now - ms(row.last_seen_at) > TOUCH_INTERVAL_MS) {
      await this.sql.query("UPDATE playlists SET last_seen_at = now() WHERE id = $1", [row.id]);
    }
    return toRecord(row);
  }

  async create(tokenHash: string) {
    await this.sweepExpired();
    const rows = (await this.sql.query(`INSERT INTO playlists (token_hash) VALUES ($1) RETURNING ${PLAYLIST_COLUMNS}`, [tokenHash])) as PlaylistRow[];
    return toRecord(rows[0]);
  }

  async get(playlistId: string) {
    const rows = (await this.sql.query(`SELECT ${PLAYLIST_COLUMNS} FROM playlists WHERE id = $1`, [playlistId])) as PlaylistRow[];
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async songs(playlistId: string) {
    const rows = (await this.sql.query(`SELECT ${SONG_COLUMNS} FROM playlist_songs WHERE playlist_id = $1 ORDER BY added_at, id`, [playlistId])) as SongRow[];
    return rows.map(toSong);
  }

  private bump(playlistId: string) {
    return this.sql.query("UPDATE playlists SET revision = revision + 1, updated_at = now() WHERE id = $1", [playlistId]);
  }

  async addSong(playlistId: string, s: AddSongInput): Promise<AddSongResult> {
    const songKey = playlistSongKey(s.artist, s.title);
    // One conditional statement: the limit and the no-repeat rule are checked where the row is written.
    const rows = (await this.sql.query(
      `INSERT INTO playlist_songs (playlist_id, song_key, state, source, title, artist, own, spotify_track_id, year, duration_ms)
       SELECT $1::uuid, $2::text, 'can_sing', $3::text, $4::text, $5::text, $6::boolean, $7::text, $8::smallint, $9::integer
        WHERE (SELECT count(*) FROM playlist_songs WHERE playlist_id = $1::uuid AND state IN ('can_sing', 'learned')) < $10::integer
       ON CONFLICT (playlist_id, song_key) DO NOTHING
       RETURNING ${SONG_COLUMNS}`,
      [playlistId, songKey, s.source, s.title, s.artist, s.own, s.spotifyTrackId ?? null, s.year ?? null, s.durationMs ?? null, MAX_SONGS],
    )) as SongRow[];
    if (rows[0]) {
      await this.bump(playlistId);
      return { ok: true, song: toSong(rows[0]) };
    }
    const existing = (await this.sql.query("SELECT 1 AS one FROM playlist_songs WHERE playlist_id = $1 AND song_key = $2", [playlistId, songKey])) as unknown[];
    return { ok: false, reason: existing.length ? "duplicate" : "full" };
  }

  async setSongState(playlistId: string, songId: string, state: SongState) {
    if (!isSongId(songId)) return null;
    const rows = (await this.sql.query(
      `UPDATE playlist_songs SET state = $3, updated_at = now() WHERE playlist_id = $1 AND id = $2::bigint RETURNING ${SONG_COLUMNS}`,
      [playlistId, songId, state],
    )) as SongRow[];
    if (!rows[0]) return null;
    await this.bump(playlistId);
    return toSong(rows[0]);
  }

  async removeSong(playlistId: string, songId: string) {
    if (!isSongId(songId)) return false;
    const rows = (await this.sql.query("DELETE FROM playlist_songs WHERE playlist_id = $1 AND id = $2::bigint RETURNING id", [playlistId, songId])) as unknown[];
    if (!rows.length) return false;
    await this.bump(playlistId);
    return true;
  }

  async update(playlistId: string, patch: PatchPlaylistInput): Promise<UpdateResult> {
    const rows = (await this.sql.query(
      `UPDATE playlists
          SET act_name = CASE WHEN $3::boolean THEN $4::text ELSE act_name END,
              sounds_like = CASE WHEN $5::boolean THEN $6::jsonb ELSE sounds_like END,
              usual_pitches = CASE WHEN $7::boolean THEN $8::jsonb ELSE usual_pitches END,
              revision = revision + 1, updated_at = now()
        WHERE id = $1 AND revision = $2
        RETURNING ${PLAYLIST_COLUMNS}`,
      [
        playlistId,
        patch.revision,
        patch.actName !== undefined,
        patch.actName ?? null,
        patch.soundsLike !== undefined,
        JSON.stringify(patch.soundsLike ?? []),
        patch.usualPitches !== undefined,
        JSON.stringify(patch.usualPitches ?? []),
      ],
    )) as PlaylistRow[];
    if (rows[0]) return { ok: true, playlist: toRecord(rows[0]) };
    const exists = (await this.sql.query("SELECT 1 AS one FROM playlists WHERE id = $1", [playlistId])) as unknown[];
    return { ok: false, reason: exists.length ? "stale" : "missing" };
  }

  async forget(playlistId: string) {
    const rows = (await this.sql.query("DELETE FROM playlists WHERE id = $1 RETURNING id", [playlistId])) as unknown[];
    return rows.length > 0;
  }

  async sweepExpired(now = Date.now()) {
    const rows = (await this.sql.query("DELETE FROM playlists WHERE last_seen_at < to_timestamp($1::double precision / 1000) RETURNING id", [expiryCutoff(now)])) as unknown[];
    return rows.length;
  }
}

const stores = processMap<"db" | "memory", PlaylistStore>("playlist-stores");

/** Offline (tests): memory. With DATABASE_URL (pooled): Postgres. Without it: memory, said once in the log. One of each per process. */
export function playlistStore(offline: boolean): PlaylistStore {
  const url = offline ? undefined : env().DATABASE_URL;
  const kind = url ? "db" : "memory";
  let store = stores.get(kind);
  if (!store) {
    if (!url && !offline) log.info("Repertoires are kept in memory: DATABASE_URL is not set");
    store = url ? new PostgresPlaylistStore(neon(url)) : new MemoryPlaylistStore();
    stores.set(kind, store);
  }
  return store;
}

/** Memory only lasts on a single long-lived server (local dev, `next start`); on Vercel without a database nothing would persist. */
export function playlistDurable(store: PlaylistStore): boolean {
  return store.kind === "postgres" || !process.env.VERCEL;
}

export function resetPlaylistStoresForTests() {
  stores.clear();
}
