import "server-only";
import { neon } from "@neondatabase/serverless";
import { playlistSongKey, type AddPlanSuggestionInput, type AddSongInput, type LearnSuggestionView, type PatchPlaylistInput, type PlaylistSongView, type PlaylistView, type SongSource, type SongState, type SoundsLike, type UsualPitch } from "@/lib/playlist-schema";
import { usualFromBusks, withBusk, type RecentBusk } from "@/lib/playlist-usual";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { processMap } from "@/server/memo";
import { MAX_SONGS, MAX_USUAL_PITCHES, PLAYLIST_EXPIRY_MONTHS, TOUCH_INTERVAL_MS, USUAL_PITCHES_FROM_LAST_PLANS } from "./config";

/**
 * Repertoires (tables `playlists` and `playlist_songs`, migrations/004_playlists.sql).
 * Found by the sha256 of the cookie token; the id never leaves the server.
 */
export type PlaylistRecord = {
  id: string;
  actName: string | null;
  soundsLike: SoundsLike[];
  usualPitches: UsualPitch[];
  /** The last few busks planned with it, newest first (migration 006): where usualPitches comes from. */
  recentBusks: RecentBusk[];
  city: string;
  revision: number;
  createdAt: number;
  lastSeenAt: number;
};

export type StoredSong = Omit<PlaylistSongView, "addedAt"> & { songKey: string; addedAt: number };

export type AddSongResult = { ok: true; song: StoredSong } | { ok: false; reason: "duplicate" | "full" };
/** "Add to Repertoire" from a plan: refused when the song is already suggested (any status) or already sung. */
export type AddSuggestionResult = { ok: true; suggestion: LearnSuggestionView } | { ok: false; reason: "already_suggested" | "in_repertoire" };
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
  /**
   * A song from a plan's Learn these becomes a pending suggestion with no run (docs §3.3). The unique key on
   * (playlist, song key) is the no-repeat rule. Does not bump the revision: it is not an edit of the Repertoire.
   */
  addPlanSuggestion(playlistId: string, input: AddPlanSuggestionInput): Promise<AddSuggestionResult>;
  /** Records the top pitch of a busk planned with the Repertoire and refreshes the usual pitches. No revision bump. */
  recordBusk(playlistId: string, busk: RecentBusk): Promise<UsualPitch[]>;
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

/** A suggestion row added from a plan, as the Learn list returns it (docs §7.3). */
function planSuggestionView(id: string, input: AddPlanSuggestionInput, suggestedAt: string): LearnSuggestionView {
  return {
    id,
    runId: null,
    runNumber: null,
    rank: null,
    title: input.title,
    artist: input.artist,
    year: null,
    durationMs: null,
    image: null,
    songSource: "plan",
    sourceUrl: null,
    reason: input.reason,
    because: [],
    basedOn: [],
    growth: input.growth ?? null,
    trendDelta: null,
    isNew: false,
    status: "pending",
    suggestedAt,
    learnedAt: null,
    dismissedAt: null,
  };
}

export class MemoryPlaylistStore implements PlaylistStore {
  readonly kind = "memory" as const;
  /** Keyed by token hash. */
  readonly playlists = new Map<string, PlaylistRecord & { tokenHash: string }>();
  readonly songRows = new Map<string, StoredSong[]>();
  /** Plan suggestions by Repertoire id (the learn runs of R3 write to the same table in Postgres). */
  readonly suggestionRows = new Map<string, (LearnSuggestionView & { songKey: string })[]>();
  private nextSongId = 1;
  private nextSuggestionId = 1;

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
    const row = { id: crypto.randomUUID(), tokenHash, actName: null, soundsLike: [], usualPitches: [], recentBusks: [], city: "melbourne", revision: 1, createdAt: now, lastSeenAt: now };
    this.playlists.set(tokenHash, row);
    this.songRows.set(row.id, []);
    if (this.playlists.size > 1000) {
      const oldest = this.playlists.keys().next().value!;
      this.songRows.delete(this.playlists.get(oldest)!.id);
      this.suggestionRows.delete(this.playlists.get(oldest)!.id);
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
    if (patch.songs) this.replaceSongs(row.id, patch.songs);
    row.revision++;
    return { ok: true, playlist: this.record(row) };
  }

  /** The songs after an edit: the ones missing are removed, new ones added as "can sing", the rest keep their row. */
  private replaceSongs(playlistId: string, wanted: AddSongInput[]) {
    const keyed = new Map<string, AddSongInput>();
    for (const s of wanted) {
      const key = playlistSongKey(s.artist, s.title);
      if (!keyed.has(key)) keyed.set(key, s);
    }
    const kept = (this.songRows.get(playlistId) ?? []).filter((r) => keyed.has(r.songKey));
    for (const row of kept) {
      const next = keyed.get(row.songKey)!;
      row.own = next.own;
      row.durationMs = next.durationMs ?? row.durationMs;
      keyed.delete(row.songKey);
    }
    for (const [songKey, s] of keyed) {
      kept.push({ id: String(this.nextSongId++), songKey, title: s.title, artist: s.artist, own: s.own, state: "can_sing", source: s.source, spotifyTrackId: s.spotifyTrackId ?? null, year: s.year ?? null, durationMs: s.durationMs ?? null, addedAt: Date.now() });
    }
    this.songRows.set(playlistId, kept);
  }

  async addPlanSuggestion(playlistId: string, input: AddPlanSuggestionInput): Promise<AddSuggestionResult> {
    const songKey = playlistSongKey(input.artist, input.title);
    if ((this.songRows.get(playlistId) ?? []).some((s) => s.songKey === songKey)) return { ok: false, reason: "in_repertoire" };
    const rows = this.suggestionRows.get(playlistId) ?? [];
    if (rows.some((s) => s.songKey === songKey)) return { ok: false, reason: "already_suggested" };
    const suggestion = { ...planSuggestionView(String(this.nextSuggestionId++), input, new Date().toISOString()), songKey };
    this.suggestionRows.set(playlistId, [...rows, suggestion]);
    const { songKey: _key, ...view } = suggestion; // eslint-disable-line @typescript-eslint/no-unused-vars
    return { ok: true, suggestion: view };
  }

  async recordBusk(playlistId: string, busk: RecentBusk) {
    const row = this.byId(playlistId);
    if (!row) return [];
    row.recentBusks = withBusk(row.recentBusks, busk, USUAL_PITCHES_FROM_LAST_PLANS);
    row.usualPitches = usualFromBusks(row.recentBusks, MAX_USUAL_PITCHES);
    return structuredClone(row.usualPitches);
  }

  async forget(playlistId: string) {
    const row = this.byId(playlistId);
    if (!row) return false;
    this.playlists.delete(row.tokenHash);
    this.songRows.delete(playlistId);
    this.suggestionRows.delete(playlistId);
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
  recent_busks: RecentBusk[];
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

const PLAYLIST_COLUMNS = "id, act_name, sounds_like, usual_pitches, recent_busks, city, revision, created_at, last_seen_at";
const SONG_COLUMNS = "id::text AS id, song_key, state, source, title, artist, own, spotify_track_id, year, duration_ms, added_at";

const toRecord = (r: PlaylistRow): PlaylistRecord => ({
  id: r.id,
  actName: r.act_name,
  soundsLike: r.sounds_like,
  usualPitches: r.usual_pitches,
  recentBusks: r.recent_busks ?? [],
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

type SuggestionRow = {
  id: string;
  title: string;
  artist: string;
  reason: string;
  evidence: { growth?: number | null } | null;
  status: LearnSuggestionView["status"];
  created_at: Time;
};

const SUGGESTION_COLUMNS = "id::text AS id, title, artist, reason, evidence, status, created_at";

/** What a plan suggestion keeps of the plan's numbers: small derived values only (docs §1.2). */
const planEvidence = (growth: number | null) => ({ ranker: "template", artistFrom: "plan", because: [], affinity: null, growth, trendDelta: null, basedOn: [] });

const toSuggestionView = (r: SuggestionRow): LearnSuggestionView =>
  planSuggestionView(r.id, { title: r.title, artist: r.artist, reason: r.reason, growth: r.evidence?.growth ?? null }, new Date(r.created_at).toISOString());

/** The songs of an edit by song key, the first of a repeat winning, as the rows the statement inserts. */
function uniqueSongs(songs: AddSongInput[]) {
  const byKey = new Map<string, { song_key: string; title: string; artist: string; own: boolean; duration_ms: number | null }>();
  for (const s of songs) {
    const song_key = playlistSongKey(s.artist, s.title);
    if (!byKey.has(song_key)) byKey.set(song_key, { song_key, title: s.title, artist: s.artist, own: s.own, duration_ms: s.durationMs ?? null });
  }
  return [...byKey.values()];
}

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
    // One transaction (one HTTP round trip): lock the Repertoire's row, then count and insert. Under READ COMMITTED the
    // count is read after the lock is held, so two saves at 59 songs can't both land. The limit and the no-repeat rule
    // (ON CONFLICT) are still checked where the row is written.
    const [, inserted] = (await this.sql.transaction((txn) => [
      txn.query("SELECT id FROM playlists WHERE id = $1::uuid FOR UPDATE", [playlistId]),
      txn.query(
        `INSERT INTO playlist_songs (playlist_id, song_key, state, source, title, artist, own, spotify_track_id, year, duration_ms)
         SELECT $1::uuid, $2::text, 'can_sing', $3::text, $4::text, $5::text, $6::boolean, $7::text, $8::smallint, $9::integer
          WHERE (SELECT count(*) FROM playlist_songs WHERE playlist_id = $1::uuid AND state IN ('can_sing', 'learned')) < $10::integer
         ON CONFLICT (playlist_id, song_key) DO NOTHING
         RETURNING ${SONG_COLUMNS}`,
        [playlistId, songKey, s.source, s.title, s.artist, s.own, s.spotifyTrackId ?? null, s.year ?? null, s.durationMs ?? null, MAX_SONGS],
      ),
    ])) as [unknown, SongRow[]];
    const rows = inserted;
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
    // One statement. The playlist row is claimed by its revision; the song changes are data-modifying CTEs on that
    // row, so a stale writer changes nothing at all (they join on `upd`, which is empty) and the edit is atomic.
    const wanted = patch.songs ? uniqueSongs(patch.songs) : null;
    const rows = (await this.sql.query(
      `WITH upd AS (
         UPDATE playlists
            SET act_name = CASE WHEN $3::boolean THEN $4::text ELSE act_name END,
                sounds_like = CASE WHEN $5::boolean THEN $6::jsonb ELSE sounds_like END,
                usual_pitches = CASE WHEN $7::boolean THEN $8::jsonb ELSE usual_pitches END,
                revision = revision + 1, updated_at = now()
          WHERE id = $1 AND revision = $2
          RETURNING ${PLAYLIST_COLUMNS}
       ), gone AS (
         DELETE FROM playlist_songs
          WHERE $9::boolean AND playlist_id IN (SELECT id FROM upd)
            AND song_key NOT IN (SELECT x.song_key FROM jsonb_to_recordset($10::jsonb) AS x(song_key text))
          RETURNING id
       ), added AS (
         INSERT INTO playlist_songs (playlist_id, song_key, state, source, title, artist, own, duration_ms)
         SELECT upd.id, x.song_key, 'can_sing', 'typed', x.title, x.artist, x.own, x.duration_ms
           FROM upd, jsonb_to_recordset($10::jsonb) AS x(song_key text, title text, artist text, own boolean, duration_ms integer)
          WHERE $9::boolean
         ON CONFLICT (playlist_id, song_key)
           DO UPDATE SET own = EXCLUDED.own, duration_ms = COALESCE(EXCLUDED.duration_ms, playlist_songs.duration_ms), updated_at = now()
         RETURNING id
       )
       SELECT ${PLAYLIST_COLUMNS} FROM upd`,
      [
        playlistId,
        patch.revision,
        patch.actName !== undefined,
        patch.actName ?? null,
        patch.soundsLike !== undefined,
        JSON.stringify(patch.soundsLike ?? []),
        patch.usualPitches !== undefined,
        JSON.stringify(patch.usualPitches ?? []),
        wanted !== null,
        JSON.stringify(wanted ?? []),
      ],
    )) as PlaylistRow[];
    if (rows[0]) return { ok: true, playlist: toRecord(rows[0]) };
    const exists = (await this.sql.query("SELECT 1 AS one FROM playlists WHERE id = $1", [playlistId])) as unknown[];
    return { ok: false, reason: exists.length ? "stale" : "missing" };
  }

  async addPlanSuggestion(playlistId: string, input: AddPlanSuggestionInput): Promise<AddSuggestionResult> {
    const songKey = playlistSongKey(input.artist, input.title);
    // One conditional statement: a song you already sing is not suggested, and the unique key refuses a repeat.
    const rows = (await this.sql.query(
      `INSERT INTO learn_suggestions (playlist_id, song_key, title, artist, song_source, reason, evidence, status)
       SELECT $1::uuid, $2::text, $3::text, $4::text, 'plan', $5::text, $6::jsonb, 'pending'
        WHERE NOT EXISTS (SELECT 1 FROM playlist_songs WHERE playlist_id = $1::uuid AND song_key = $2::text)
       ON CONFLICT (playlist_id, song_key) DO NOTHING
       RETURNING ${SUGGESTION_COLUMNS}`,
      [playlistId, songKey, input.title, input.artist, input.reason, JSON.stringify(planEvidence(input.growth ?? null))],
    )) as SuggestionRow[];
    if (rows[0]) return { ok: true, suggestion: toSuggestionView(rows[0]) };
    const sung = (await this.sql.query("SELECT 1 AS one FROM playlist_songs WHERE playlist_id = $1 AND song_key = $2", [playlistId, songKey])) as unknown[];
    return { ok: false, reason: sung.length ? "in_repertoire" : "already_suggested" };
  }

  async recordBusk(playlistId: string, busk: RecentBusk) {
    const rows = (await this.sql.query("SELECT recent_busks FROM playlists WHERE id = $1", [playlistId])) as { recent_busks: RecentBusk[] }[];
    if (!rows[0]) return [];
    const recent = withBusk(rows[0].recent_busks ?? [], busk, USUAL_PITCHES_FROM_LAST_PLANS);
    const usual = usualFromBusks(recent, MAX_USUAL_PITCHES);
    // Bookkeeping, not an edit: the revision stays, so an open busk form can still save.
    await this.sql.query("UPDATE playlists SET recent_busks = $2::jsonb, usual_pitches = $3::jsonb WHERE id = $1", [playlistId, JSON.stringify(recent), JSON.stringify(usual)]);
    return usual;
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
