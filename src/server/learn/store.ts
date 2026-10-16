import "server-only";
import { neon } from "@neondatabase/serverless";
import { becauseText, type LearnInputs, type LearnModel, type LearnRunStatus, type LearnTotals, type StoredLearnStep } from "@/lib/learn-schema";
import { playlistSongKey, type LearnSuggestionView, type PlaylistSongView } from "@/lib/playlist-schema";
import { env } from "@/server/env";
import { processMap } from "@/server/memo";
import { LEARN_LIMITS, LEARN_MAX_RUNS, LEARN_MAX_SUGGESTIONS, LEARN_STEPS_KEPT_DAYS, LEARN_STEPS_KEPT_RUNS, MAX_SONGS } from "@/server/playlist/config";
import { MemoryPlaylistStore, playlistStore, type PlaylistStore, type StoredSong } from "@/server/playlist/store";
import type { Evidence, FinishRun, HistoryData, MemorySuggestion, NewSuggestion, RunRecord, RunUsage, SetStatusResult, StartRunResult } from "./types";

/**
 * Learn runs and their suggestions (tables `learn_runs` and `learn_suggestions`, migrations/005_learn_runs.sql;
 * docs/playlist-architecture.md §1.2, §1.4, §2.7). `MemoryLearnStore` works on the rows the Repertoire's memory store holds
 * offline; `PostgresLearnStore` is every statement parameterised, each write one conditional statement.
 *
 * No repeats (D9): the unique key on (playlist_id, song_key) is the last line of defence, under the guardrail in
 * tools.ts and the filter in top_tracks. A song is suggested once per Repertoire, whatever its status.
 */
export type RunListItem = Omit<RunRecord, "steps"> & { stepsKept: boolean };

export interface LearnStore {
  readonly kind: "postgres" | "memory";
  /** Marks `running` rows older than timeoutMs + 30 s as failed (a crashed instance must not block the one-running index). */
  sweepStale(playlistId: string, now?: number): Promise<number>;
  /** Inserts the run (`running`) with the next number. Refused while another is running for this Repertoire. Prunes old steps. */
  startRun(playlistId: string, input: { model: LearnModel; inputs: LearnInputs }, now?: number): Promise<StartRunResult>;
  finishRun(runId: string, finish: FinishRun, now?: number): Promise<void>;
  getRun(playlistId: string, runId: string): Promise<RunRecord | null>;
  /** Runs started in the window that reached the model (runs that ended qloo_unavailable or no_match are not counted). */
  recentRuns(playlistId: string, sinceMs: number): Promise<{ count: number; oldestStartedAt: number | null }>;
  /** Saves the accepted picks in one statement; a song already suggested, sung or dismissed is skipped. Returns the rows saved, in rank order. */
  insertSuggestions(playlistId: string, runId: string, picks: NewSuggestion[], now?: number): Promise<LearnSuggestionView[]>;
  history(playlistId: string): Promise<HistoryData>;
  list(playlistId: string): Promise<{ runs: RunListItem[]; suggestions: LearnSuggestionView[]; pending: number }>;
  /** A run's suggestions with their current status, in rank order. */
  runSuggestions(playlistId: string, runId: string): Promise<LearnSuggestionView[]>;
  /** pending → learned (a Songs you can sing row), pending → dismissed, learned or dismissed → pending (Undo). */
  setStatus(playlistId: string, suggestionId: string, status: "pending" | "learned" | "dismissed", now?: number): Promise<SetStatusResult>;
  /** Keeps steps for the last N runs and N days. Returns how many runs lost their steps. */
  pruneSteps(playlistId: string, now?: number): Promise<number>;
  /** The caps: 50 runs, 400 suggestions (oldest dismissed first, their keys move to dismissed_keys). */
  trim(playlistId: string): Promise<void>;
}

const DAY_MS = 24 * 60 * 60_000;
const OUT_OF_BUDGET_CODES = ["qloo_unavailable", "no_match"];
const staleBefore = (now: number) => now - (LEARN_LIMITS.timeoutMs + LEARN_LIMITS.staleGraceMs);
/** Steps older than this, or beyond the last N runs, are pruned. */
const stepsCutoff = (now: number) => now - LEARN_STEPS_KEPT_DAYS * DAY_MS;

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

function viewOf(row: MemorySuggestion, runNumber: number | null, isNew: boolean): LearnSuggestionView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { songKey: _k, spotifyTrackId: _s, qlooArtistId: _q, evidence: _e, ...view } = row;
  return { ...view, runNumber, isNew };
}

export function viewFromPick(id: string, runId: string, runNumber: number, pick: NewSuggestion, now: number): MemorySuggestion {
  return {
    id,
    runId,
    runNumber,
    rank: pick.rank,
    title: pick.title,
    artist: pick.artist,
    year: pick.year,
    durationMs: pick.durationMs,
    image: pick.imageUrl,
    songSource: pick.songSource,
    sourceUrl: pick.sourceUrl,
    reason: pick.reason,
    because: becauseText(pick.evidence.because),
    basedOn: pick.evidence.basedOn,
    growth: pick.evidence.growth,
    trendDelta: pick.evidence.trendDelta,
    isNew: true,
    status: "pending",
    suggestedAt: new Date(now).toISOString(),
    learnedAt: null,
    dismissedAt: null,
    songKey: pick.songKey,
    spotifyTrackId: pick.spotifyTrackId,
    qlooArtistId: pick.qlooArtistId,
    evidence: pick.evidence,
  };
}

export class MemoryLearnStore implements LearnStore {
  readonly kind = "memory" as const;
  constructor(private readonly playlists: MemoryPlaylistStore) {}

  private runs(playlistId: string): RunRecord[] {
    let rows = this.playlists.runRows.get(playlistId);
    if (!rows) this.playlists.runRows.set(playlistId, (rows = []));
    return rows;
  }
  private suggestions(playlistId: string): MemorySuggestion[] {
    let rows = this.playlists.suggestionRows.get(playlistId);
    if (!rows) this.playlists.suggestionRows.set(playlistId, (rows = []));
    return rows;
  }
  private latestFinished(playlistId: string): RunRecord | undefined {
    return [...this.runs(playlistId)].reverse().find((r) => r.status === "done" || r.status === "fallback");
  }

  async sweepStale(playlistId: string, now = Date.now()) {
    let n = 0;
    for (const run of this.runs(playlistId)) {
      if (run.status === "running" && run.startedAt < staleBefore(now)) {
        Object.assign(run, { status: "failed", endCode: "timeout", finishedAt: now });
        n++;
      }
    }
    return n;
  }

  async startRun(playlistId: string, input: { model: LearnModel; inputs: LearnInputs }, now = Date.now()): Promise<StartRunResult> {
    await this.sweepStale(playlistId, now);
    const runs = this.runs(playlistId);
    const running = runs.find((r) => r.status === "running");
    if (running) return { ok: false, reason: "already_running", runId: running.id };
    const run: RunRecord = {
      id: crypto.randomUUID(),
      playlistId,
      number: Math.max(0, ...runs.map((r) => r.number)) + 1,
      startedAt: now,
      finishedAt: null,
      status: "running",
      endCode: null,
      model: input.model,
      inputs: structuredClone(input.inputs),
      steps: null,
      totals: null,
      usage: null,
      newCount: 0,
      skippedCount: 0,
    };
    runs.push(run);
    await this.pruneSteps(playlistId, now);
    return { ok: true, run: structuredClone(run) };
  }

  async finishRun(runId: string, finish: FinishRun, now = Date.now()) {
    for (const runs of this.playlists.runRows.values()) {
      const run = runs.find((r) => r.id === runId);
      if (!run) continue;
      Object.assign(run, { ...structuredClone(finish), finishedAt: now });
      await this.pruneSteps(run.playlistId, now);
      await this.trim(run.playlistId);
      return;
    }
  }

  async getRun(playlistId: string, runId: string) {
    const run = this.runs(playlistId).find((r) => r.id === runId);
    return run ? structuredClone(run) : null;
  }

  async recentRuns(playlistId: string, sinceMs: number) {
    const counted = this.runs(playlistId).filter((r) => r.startedAt > sinceMs && !OUT_OF_BUDGET_CODES.includes(r.endCode ?? ""));
    return { count: counted.length, oldestStartedAt: counted.length ? Math.min(...counted.map((r) => r.startedAt)) : null };
  }

  async insertSuggestions(playlistId: string, runId: string, picks: NewSuggestion[], now = Date.now()) {
    const run = this.runs(playlistId).find((r) => r.id === runId);
    if (!run) return [];
    const rows = this.suggestions(playlistId);
    const sung = new Set((this.playlists.songRows.get(playlistId) ?? []).map((s) => s.songKey));
    const dismissed = this.playlists.dismissedKeys.get(playlistId) ?? new Set<string>();
    const saved: MemorySuggestion[] = [];
    for (const pick of [...picks].sort((a, b) => a.rank - b.rank)) {
      if (sung.has(pick.songKey) || dismissed.has(pick.songKey) || rows.some((r) => r.songKey === pick.songKey)) continue;
      const row = viewFromPick(String(this.playlists.nextSuggestionId++), runId, run.number, pick, now);
      rows.push(row);
      saved.push(row);
    }
    return saved.map((r) => viewOf(r, run.number, true));
  }

  async history(playlistId: string): Promise<HistoryData> {
    const runs = this.runs(playlistId);
    const finished = this.latestFinished(playlistId);
    const numberOf = new Map(runs.map((r) => [r.id, r.number]));
    return {
      songs: (this.playlists.songRows.get(playlistId) ?? []).map((s) => ({ title: s.title, artist: s.artist, key: s.songKey, state: s.state })),
      suggestions: [...this.suggestions(playlistId)]
        .map((s) => ({ title: s.title, artist: s.artist, key: s.songKey, status: s.status, runNumber: s.runId ? (numberOf.get(s.runId) ?? s.runNumber) : null, at: Date.parse(s.suggestedAt) }))
        .reverse(),
      dismissedKeys: [...(this.playlists.dismissedKeys.get(playlistId) ?? [])],
      earlierRuns: runs.filter((r) => r.status === "done" || r.status === "fallback").length,
      lastRun: finished ? { number: finished.number, startedAt: finished.startedAt, newCount: finished.newCount } : null,
    };
  }

  async list(playlistId: string) {
    const latest = this.latestFinished(playlistId);
    const numberOf = new Map(this.runs(playlistId).map((r) => [r.id, r.number]));
    const suggestions = [...this.suggestions(playlistId)]
      .map((s) => viewOf(s, s.runId ? (numberOf.get(s.runId) ?? null) : null, Boolean(s.runId && latest && s.runId === latest.id)))
      .sort((a, b) => (b.runNumber ?? -1) - (a.runNumber ?? -1) || (a.rank ?? 1e9) - (b.rank ?? 1e9) || b.suggestedAt.localeCompare(a.suggestedAt));
    const runs = [...this.runs(playlistId)].reverse().map(({ steps, ...rest }) => ({ ...structuredClone(rest), stepsKept: steps !== null }));
    return { runs, suggestions, pending: suggestions.filter((s) => s.status === "pending").length };
  }

  async runSuggestions(playlistId: string, runId: string) {
    const run = this.runs(playlistId).find((r) => r.id === runId);
    const latest = this.latestFinished(playlistId);
    return this.suggestions(playlistId)
      .filter((s) => s.runId === runId)
      .map((s) => viewOf(s, run?.number ?? null, latest?.id === runId))
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  }

  async setStatus(playlistId: string, suggestionId: string, status: "pending" | "learned" | "dismissed", now = Date.now()): Promise<SetStatusResult> {
    const row = this.suggestions(playlistId).find((s) => s.id === suggestionId);
    if (!row) return { ok: false, reason: "missing" };
    const songs = this.playlists.songRows.get(playlistId) ?? [];
    const latest = this.latestFinished(playlistId);
    const run = row.runId ? this.runs(playlistId).find((r) => r.id === row.runId) : undefined;
    const done = (song: PlaylistSongView | null, changedSongs: boolean) => {
      if (changedSongs) {
        const hash = [...this.playlists.playlists].find(([, p]) => p.id === playlistId)?.[0];
        if (hash) this.playlists.playlists.get(hash)!.revision++;
      }
      const revision = [...this.playlists.playlists.values()].find((p) => p.id === playlistId)?.revision ?? 0;
      return { ok: true as const, suggestion: viewOf(row, run?.number ?? null, Boolean(row.runId && latest?.id === row.runId)), song, revision };
    };
    if (row.status === "pending" && status === "learned") {
      const have = songs.find((s) => s.songKey === row.songKey);
      if (!have && songs.length >= MAX_SONGS) return { ok: false, reason: "full" };
      Object.assign(row, { status: "learned", learnedAt: iso(now), dismissedAt: null });
      const song =
        have ??
        ({
          id: String(this.playlists.nextSongId++),
          songKey: row.songKey,
          title: row.title,
          artist: row.artist,
          own: false,
          state: "learned",
          source: "suggested",
          spotifyTrackId: row.spotifyTrackId ?? null,
          year: row.year,
          durationMs: row.durationMs,
          addedAt: now,
          suggestionId: row.id,
        } satisfies StoredSong);
      if (!have) {
        songs.push(song);
        this.playlists.songRows.set(playlistId, songs);
      }
      return done(toSongView(song), !have);
    }
    if (row.status === "pending" && status === "dismissed") {
      Object.assign(row, { status: "dismissed", dismissedAt: iso(now) });
      return done(null, false);
    }
    if (row.status === "learned" && status === "pending") {
      Object.assign(row, { status: "pending", learnedAt: null });
      const at = songs.findIndex((s) => s.suggestionId === row.id);
      if (at >= 0) songs.splice(at, 1);
      return done(null, at >= 0);
    }
    if (row.status === "dismissed" && status === "pending") {
      Object.assign(row, { status: "pending", dismissedAt: null });
      return done(null, false);
    }
    return { ok: false, reason: "invalid" };
  }

  async pruneSteps(playlistId: string, now = Date.now()) {
    const runs = this.runs(playlistId);
    const newest = new Set([...runs].sort((a, b) => b.number - a.number).slice(0, LEARN_STEPS_KEPT_RUNS).map((r) => r.id));
    let n = 0;
    for (const run of runs) {
      if (run.steps !== null && (!newest.has(run.id) || run.startedAt < stepsCutoff(now))) {
        run.steps = null;
        n++;
      }
    }
    return n;
  }

  async trim(playlistId: string) {
    const runs = this.runs(playlistId);
    if (runs.length > LEARN_MAX_RUNS) {
      const drop = new Set([...runs].sort((a, b) => a.number - b.number).slice(0, runs.length - LEARN_MAX_RUNS).map((r) => r.id));
      this.playlists.runRows.set(playlistId, runs.filter((r) => !drop.has(r.id)));
      for (const s of this.suggestions(playlistId)) if (s.runId && drop.has(s.runId)) Object.assign(s, { runId: null, runNumber: null });
    }
    const rows = this.suggestions(playlistId);
    let over = rows.length - LEARN_MAX_SUGGESTIONS;
    if (over <= 0) return;
    const keys = this.playlists.dismissedKeys.get(playlistId) ?? new Set<string>();
    const oldestDismissed = rows.filter((s) => s.status === "dismissed").sort((a, b) => (a.dismissedAt ?? "").localeCompare(b.dismissedAt ?? "") || Number(a.id) - Number(b.id));
    const gone = new Set<string>();
    for (const s of oldestDismissed) {
      if (over-- <= 0) break;
      keys.add(s.songKey);
      gone.add(s.id);
    }
    this.playlists.dismissedKeys.set(playlistId, keys);
    this.playlists.suggestionRows.set(playlistId, rows.filter((s) => !gone.has(s.id)));
  }
}

function toSongView(song: { id: string; title: string; artist: string; own: boolean; state: "can_sing" | "learned"; source: PlaylistSongView["source"]; spotifyTrackId: string | null; year: number | null; durationMs: number | null; addedAt: number }): PlaylistSongView {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    own: song.own,
    state: song.state,
    source: song.source,
    spotifyTrackId: song.spotifyTrackId,
    year: song.year,
    durationMs: song.durationMs,
    addedAt: new Date(song.addedAt).toISOString(),
  };
}

// --- Postgres ---

type Sql = ReturnType<typeof neon>;
type Time = string | Date;
const ms = (v: Time) => new Date(v).getTime();
const msOrNull = (v: Time | null) => (v === null ? null : ms(v));

type RunRow = {
  id: string;
  playlist_id: string;
  number: number;
  started_at: Time;
  finished_at: Time | null;
  status: LearnRunStatus;
  end_code: string | null;
  model: LearnModel;
  inputs: LearnInputs;
  steps?: StoredLearnStep[] | null;
  steps_kept?: boolean;
  totals: LearnTotals | Record<string, never> | null;
  usage: RunUsage | null;
  new_count: number;
  skipped_count: number;
};

const RUN_COLUMNS = "id, playlist_id, number, started_at, finished_at, status, end_code, model, inputs, totals, usage, new_count, skipped_count";

const toRun = (r: RunRow): RunRecord => ({
  id: r.id,
  playlistId: r.playlist_id,
  number: r.number,
  startedAt: ms(r.started_at),
  finishedAt: msOrNull(r.finished_at),
  status: r.status,
  endCode: r.end_code,
  model: r.model,
  inputs: r.inputs,
  steps: r.steps ?? null,
  totals: r.totals && Object.keys(r.totals).length ? (r.totals as LearnTotals) : null,
  usage: r.usage,
  newCount: r.new_count,
  skippedCount: r.skipped_count,
});

type SuggestionRow = {
  id: string;
  run_id: string | null;
  run_number: number | null;
  rank: number | null;
  title: string;
  artist: string;
  year: number | null;
  duration_ms: number | null;
  image_url: string | null;
  song_source: "spotify" | "lastfm" | "plan";
  source_url: string | null;
  reason: string;
  evidence: Evidence | { growth?: number | null };
  status: "pending" | "learned" | "dismissed";
  created_at: Time;
  learned_at: Time | null;
  dismissed_at: Time | null;
  is_new: boolean | null;
};

const SUGGESTION_SELECT = `s.id::text AS id, s.run_id::text AS run_id, r.number AS run_number, s.rank, s.title, s.artist, s.year, s.duration_ms, s.image_url,
  s.song_source, s.source_url, s.reason, s.evidence, s.status, s.created_at, s.learned_at, s.dismissed_at,
  (s.run_id IS NOT NULL AND s.run_id = (SELECT id FROM learn_runs WHERE playlist_id = s.playlist_id AND status IN ('done', 'fallback') ORDER BY number DESC LIMIT 1)) AS is_new`;

function toSuggestion(r: SuggestionRow): LearnSuggestionView {
  const evidence = r.evidence as Partial<Evidence>;
  return {
    id: r.id,
    runId: r.run_id,
    runNumber: r.run_number,
    rank: r.rank,
    title: r.title,
    artist: r.artist,
    year: r.year,
    durationMs: r.duration_ms,
    image: r.image_url,
    songSource: r.song_source,
    sourceUrl: r.source_url,
    reason: r.reason,
    because: becauseText(evidence.because ?? []),
    basedOn: evidence.basedOn ?? [],
    growth: evidence.growth ?? null,
    trendDelta: evidence.trendDelta ?? null,
    isNew: Boolean(r.is_new),
    status: r.status,
    suggestedAt: new Date(r.created_at).toISOString(),
    learnedAt: r.learned_at ? new Date(r.learned_at).toISOString() : null,
    dismissedAt: r.dismissed_at ? new Date(r.dismissed_at).toISOString() : null,
  };
}

type SongRow = { id: string; song_key: string; state: "can_sing" | "learned"; source: PlaylistSongView["source"]; title: string; artist: string; own: boolean; spotify_track_id: string | null; year: number | null; duration_ms: number | null; added_at: Time };
const SONG_COLUMNS = "id::text AS id, song_key, state, source, title, artist, own, spotify_track_id, year, duration_ms, added_at";
const toSong = (r: SongRow): PlaylistSongView =>
  toSongView({ id: r.id, title: r.title, artist: r.artist, own: r.own, state: r.state, source: r.source, spotifyTrackId: r.spotify_track_id, year: r.year, durationMs: r.duration_ms, addedAt: ms(r.added_at) });

const isSuggestionId = (id: string) => /^\d{1,18}$/.test(id);
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const uniqueViolation = (error: unknown) => typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";

export class PostgresLearnStore implements LearnStore {
  readonly kind = "postgres" as const;
  constructor(private readonly sql: Sql) {}

  async sweepStale(playlistId: string, now = Date.now()) {
    const rows = (await this.sql.query(
      "UPDATE learn_runs SET status = 'failed', end_code = 'timeout', finished_at = now() WHERE playlist_id = $1 AND status = 'running' AND started_at < to_timestamp($2::double precision / 1000) RETURNING id",
      [playlistId, staleBefore(now)],
    )) as unknown[];
    return rows.length;
  }

  async startRun(playlistId: string, input: { model: LearnModel; inputs: LearnInputs }, now = Date.now()): Promise<StartRunResult> {
    await this.sweepStale(playlistId, now);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // The next number in the insert; the partial unique index admits one running run per Repertoire.
        const rows = (await this.sql.query(
          `INSERT INTO learn_runs (playlist_id, number, status, model, inputs)
           SELECT $1::uuid, COALESCE(MAX(number), 0) + 1, 'running', $2::text, $3::jsonb FROM learn_runs WHERE playlist_id = $1::uuid
           RETURNING ${RUN_COLUMNS}`,
          [playlistId, input.model, JSON.stringify(input.inputs)],
        )) as RunRow[];
        await this.pruneSteps(playlistId, now);
        return { ok: true, run: toRun(rows[0]) };
      } catch (error) {
        if (!uniqueViolation(error)) throw error;
        const running = (await this.sql.query("SELECT id FROM learn_runs WHERE playlist_id = $1 AND status = 'running'", [playlistId])) as { id: string }[];
        if (running[0]) return { ok: false, reason: "already_running", runId: running[0].id };
        // A number clash with a run that just started and finished: try once more with the new maximum.
      }
    }
    return { ok: false, reason: "already_running", runId: null };
  }

  async finishRun(runId: string, f: FinishRun) {
    if (!isUuid(runId)) return;
    await this.sql.query(
      `UPDATE learn_runs SET status = $2, end_code = $3, model = $4, steps = $5::jsonb, totals = $6::jsonb, usage = $7::jsonb, new_count = $8, skipped_count = $9, finished_at = now()
        WHERE id = $1::uuid`,
      [runId, f.status, f.endCode, f.model, f.steps === null ? null : JSON.stringify(f.steps), JSON.stringify(f.totals), f.usage === null ? null : JSON.stringify(f.usage), f.newCount, f.skippedCount],
    );
    const owner = (await this.sql.query("SELECT playlist_id FROM learn_runs WHERE id = $1::uuid", [runId])) as { playlist_id: string }[];
    if (owner[0]) {
      await this.pruneSteps(owner[0].playlist_id);
      await this.trim(owner[0].playlist_id);
    }
  }

  async getRun(playlistId: string, runId: string) {
    if (!isUuid(runId)) return null;
    const rows = (await this.sql.query(`SELECT ${RUN_COLUMNS}, steps FROM learn_runs WHERE playlist_id = $1 AND id = $2::uuid`, [playlistId, runId])) as RunRow[];
    return rows[0] ? toRun(rows[0]) : null;
  }

  async recentRuns(playlistId: string, sinceMs: number) {
    const rows = (await this.sql.query(
      `SELECT count(*)::int AS n, min(started_at) AS oldest FROM learn_runs
        WHERE playlist_id = $1 AND started_at > to_timestamp($2::double precision / 1000) AND COALESCE(end_code, '') NOT IN ('qloo_unavailable', 'no_match')`,
      [playlistId, sinceMs],
    )) as { n: number; oldest: Time | null }[];
    return { count: rows[0]?.n ?? 0, oldestStartedAt: rows[0]?.oldest ? ms(rows[0].oldest) : null };
  }

  async insertSuggestions(playlistId: string, runId: string, picks: NewSuggestion[]) {
    if (picks.length === 0) return [];
    const rows = picks.map((p) => ({
      song_key: p.songKey,
      title: p.title,
      artist: p.artist,
      spotify_track_id: p.spotifyTrackId,
      qloo_artist_id: p.qlooArtistId,
      year: p.year,
      duration_ms: p.durationMs,
      image_url: p.imageUrl,
      source_url: p.sourceUrl,
      song_source: p.songSource,
      reason: p.reason,
      evidence: p.evidence,
      rank: p.rank,
    }));
    // One statement. The unique key (playlist_id, song_key) is the no-repeat rule; a song you sing, or dismissed and
    // later lost to the size cap (dismissed_keys), is skipped too.
    const saved = (await this.sql.query(
      `INSERT INTO learn_suggestions (run_id, playlist_id, song_key, spotify_track_id, title, artist, qloo_artist_id, year, duration_ms, image_url, source_url, song_source, reason, evidence, status, rank)
       SELECT $1::uuid, $2::uuid, x.song_key, x.spotify_track_id, x.title, x.artist, x.qloo_artist_id, x.year, x.duration_ms, x.image_url, x.source_url, x.song_source, x.reason, x.evidence, 'pending', x.rank
         FROM jsonb_to_recordset($3::jsonb) AS x(song_key text, spotify_track_id text, title text, artist text, qloo_artist_id text, year smallint, duration_ms integer, image_url text, source_url text, song_source text, reason text, evidence jsonb, rank smallint)
        WHERE NOT EXISTS (SELECT 1 FROM playlist_songs ps WHERE ps.playlist_id = $2::uuid AND ps.song_key = x.song_key)
          AND NOT (x.song_key = ANY (SELECT unnest(dismissed_keys) FROM playlists WHERE id = $2::uuid))
       ON CONFLICT (playlist_id, song_key) DO NOTHING
       RETURNING id`,
      [runId, playlistId, JSON.stringify(rows)],
    )) as { id: string }[];
    if (saved.length === 0) return [];
    return this.runSuggestions(playlistId, runId, saved.map((s) => String(s.id)));
  }

  async history(playlistId: string): Promise<HistoryData> {
    const [songs, suggestions, keys, runs] = (await Promise.all([
      this.sql.query("SELECT title, artist, song_key, state FROM playlist_songs WHERE playlist_id = $1", [playlistId]),
      this.sql.query(
        `SELECT s.title, s.artist, s.song_key, s.status, r.number AS run_number, s.created_at
           FROM learn_suggestions s LEFT JOIN learn_runs r ON r.id = s.run_id WHERE s.playlist_id = $1 ORDER BY s.created_at DESC, s.id DESC`,
        [playlistId],
      ),
      this.sql.query("SELECT dismissed_keys FROM playlists WHERE id = $1", [playlistId]),
      this.sql.query("SELECT number, started_at, new_count, status FROM learn_runs WHERE playlist_id = $1 AND status IN ('done', 'fallback') ORDER BY number DESC", [playlistId]),
    ])) as [
      { title: string; artist: string; song_key: string; state: "can_sing" | "learned" }[],
      { title: string; artist: string; song_key: string; status: "pending" | "learned" | "dismissed"; run_number: number | null; created_at: Time }[],
      { dismissed_keys: string[] }[],
      { number: number; started_at: Time; new_count: number }[],
    ];
    return {
      songs: songs.map((s) => ({ title: s.title, artist: s.artist, key: s.song_key, state: s.state })),
      suggestions: suggestions.map((s) => ({ title: s.title, artist: s.artist, key: s.song_key, status: s.status, runNumber: s.run_number, at: ms(s.created_at) })),
      dismissedKeys: keys[0]?.dismissed_keys ?? [],
      earlierRuns: runs.length,
      lastRun: runs[0] ? { number: runs[0].number, startedAt: ms(runs[0].started_at), newCount: runs[0].new_count } : null,
    };
  }

  async list(playlistId: string) {
    const [runs, suggestions] = (await Promise.all([
      this.sql.query(`SELECT ${RUN_COLUMNS}, (steps IS NOT NULL) AS steps_kept FROM learn_runs WHERE playlist_id = $1 ORDER BY number DESC`, [playlistId]),
      this.sql.query(
        `SELECT ${SUGGESTION_SELECT} FROM learn_suggestions s LEFT JOIN learn_runs r ON r.id = s.run_id WHERE s.playlist_id = $1
          ORDER BY COALESCE(r.number, -1) DESC, s.rank NULLS LAST, s.created_at DESC, s.id DESC`,
        [playlistId],
      ),
    ])) as [RunRow[], SuggestionRow[]];
    const views = suggestions.map(toSuggestion);
    return {
      runs: runs.map((r) => {
        const { steps, ...rest } = toRun(r);
        void steps;
        return { ...rest, stepsKept: Boolean(r.steps_kept) };
      }),
      suggestions: views,
      pending: views.filter((s) => s.status === "pending").length,
    };
  }

  async runSuggestions(playlistId: string, runId: string, onlyIds?: string[]) {
    if (!isUuid(runId)) return [];
    const rows = (await this.sql.query(
      `SELECT ${SUGGESTION_SELECT} FROM learn_suggestions s LEFT JOIN learn_runs r ON r.id = s.run_id
        WHERE s.playlist_id = $1 AND s.run_id = $2::uuid AND ($3::text[] IS NULL OR s.id::text = ANY ($3::text[])) ORDER BY s.rank, s.id`,
      [playlistId, runId, onlyIds ?? null],
    )) as SuggestionRow[];
    return rows.map(toSuggestion);
  }

  async setStatus(playlistId: string, suggestionId: string, status: "pending" | "learned" | "dismissed", now = Date.now()): Promise<SetStatusResult> {
    void now;
    if (!isSuggestionId(suggestionId)) return { ok: false, reason: "missing" };
    const read = async () => (await this.sql.query(`SELECT ${SUGGESTION_SELECT} FROM learn_suggestions s LEFT JOIN learn_runs r ON r.id = s.run_id WHERE s.playlist_id = $1 AND s.id = $2::bigint`, [playlistId, suggestionId])) as SuggestionRow[];
    const revisionOf = async () => ((await this.sql.query("SELECT revision FROM playlists WHERE id = $1", [playlistId])) as { revision: number }[])[0]?.revision ?? 0;
    const before = (await read())[0];
    if (!before) return { ok: false, reason: "missing" };
    const from = before.status;

    if (from === "pending" && status === "learned") {
      // One transaction: lock the Repertoire, then move the suggestion and add the song, under the 60-song limit.
      const [, moved, songRows] = (await this.sql.transaction((txn) => [
        txn.query("SELECT id FROM playlists WHERE id = $1::uuid FOR UPDATE", [playlistId]),
        txn.query(
          `UPDATE learn_suggestions SET status = 'learned', learned_at = now(), dismissed_at = NULL
            WHERE id = $2::bigint AND playlist_id = $1::uuid AND status = 'pending'
              AND ((SELECT count(*) FROM playlist_songs WHERE playlist_id = $1::uuid AND state IN ('can_sing', 'learned')) < $3::integer
                   OR EXISTS (SELECT 1 FROM playlist_songs WHERE playlist_id = $1::uuid AND song_key = learn_suggestions.song_key))
            RETURNING id`,
          [playlistId, suggestionId, MAX_SONGS],
        ),
        txn.query(
          `INSERT INTO playlist_songs (playlist_id, song_key, state, source, title, artist, spotify_track_id, qloo_artist_id, year, duration_ms, suggestion_id)
           SELECT s.playlist_id, s.song_key, 'learned', 'suggested', s.title, s.artist, s.spotify_track_id, s.qloo_artist_id, s.year, s.duration_ms, s.id
             FROM learn_suggestions s WHERE s.id = $2::bigint AND s.playlist_id = $1::uuid AND s.status = 'learned' AND s.learned_at = now()
           ON CONFLICT (playlist_id, song_key) DO NOTHING
           RETURNING ${SONG_COLUMNS}`,
          [playlistId, suggestionId],
        ),
      ])) as [unknown, { id: string }[], SongRow[]];
      if (moved.length === 0) return { ok: false, reason: "full" };
      await this.sql.query("UPDATE playlists SET revision = revision + 1, updated_at = now() WHERE id = $1", [playlistId]);
      const song = songRows[0] ? toSong(songRows[0]) : await this.songOf(playlistId, suggestionId);
      return { ok: true, suggestion: toSuggestion((await read())[0]), song, revision: await revisionOf() };
    }

    if (from === "pending" && status === "dismissed") {
      await this.sql.query("UPDATE learn_suggestions SET status = 'dismissed', dismissed_at = now() WHERE id = $2::bigint AND playlist_id = $1::uuid AND status = 'pending'", [playlistId, suggestionId]);
      return { ok: true, suggestion: toSuggestion((await read())[0]), song: null, revision: await revisionOf() };
    }

    if (from === "learned" && status === "pending") {
      // Undo: the song leaves Songs you can sing in the same statement.
      const rows = (await this.sql.query(
        `WITH s AS (UPDATE learn_suggestions SET status = 'pending', learned_at = NULL WHERE id = $2::bigint AND playlist_id = $1::uuid AND status = 'learned' RETURNING id),
              del AS (DELETE FROM playlist_songs WHERE playlist_id = $1::uuid AND suggestion_id IN (SELECT id FROM s) RETURNING id),
              bump AS (UPDATE playlists SET revision = revision + 1, updated_at = now() WHERE id = $1::uuid AND EXISTS (SELECT 1 FROM s) RETURNING revision)
         SELECT (SELECT count(*) FROM s)::int AS moved, (SELECT count(*) FROM del)::int AS removed`,
        [playlistId, suggestionId],
      )) as { moved: number; removed: number }[];
      if (!rows[0]?.moved) return { ok: false, reason: "invalid" };
      return { ok: true, suggestion: toSuggestion((await read())[0]), song: null, revision: await revisionOf() };
    }

    if (from === "dismissed" && status === "pending") {
      await this.sql.query("UPDATE learn_suggestions SET status = 'pending', dismissed_at = NULL WHERE id = $2::bigint AND playlist_id = $1::uuid AND status = 'dismissed'", [playlistId, suggestionId]);
      return { ok: true, suggestion: toSuggestion((await read())[0]), song: null, revision: await revisionOf() };
    }
    return { ok: false, reason: "invalid" };
  }

  private async songOf(playlistId: string, suggestionId: string) {
    const rows = (await this.sql.query(`SELECT ${SONG_COLUMNS} FROM playlist_songs WHERE playlist_id = $1 AND suggestion_id = $2::bigint`, [playlistId, suggestionId])) as SongRow[];
    return rows[0] ? toSong(rows[0]) : null;
  }

  async pruneSteps(playlistId: string, now = Date.now()) {
    const rows = (await this.sql.query(
      `UPDATE learn_runs SET steps = NULL
        WHERE playlist_id = $1 AND steps IS NOT NULL
          AND (started_at < to_timestamp($3::double precision / 1000)
               OR id NOT IN (SELECT id FROM learn_runs WHERE playlist_id = $1 ORDER BY number DESC LIMIT $2::integer))
        RETURNING id`,
      [playlistId, LEARN_STEPS_KEPT_RUNS, stepsCutoff(now)],
    )) as unknown[];
    return rows.length;
  }

  async trim(playlistId: string) {
    // Runs past the cap go (their suggestions stay, run_id → NULL by the foreign key).
    await this.sql.query(
      "DELETE FROM learn_runs WHERE playlist_id = $1 AND id IN (SELECT id FROM learn_runs WHERE playlist_id = $1 ORDER BY number DESC OFFSET $2::integer)",
      [playlistId, LEARN_MAX_RUNS],
    );
    // Suggestions past the cap: the oldest dismissed ones go and their keys move to dismissed_keys, so no-repeat still holds.
    await this.sql.query(
      `WITH over AS (
         SELECT id FROM learn_suggestions WHERE playlist_id = $1 AND status = 'dismissed'
          ORDER BY dismissed_at ASC NULLS FIRST, id ASC
          LIMIT GREATEST((SELECT count(*) FROM learn_suggestions WHERE playlist_id = $1) - $2::integer, 0)
       ), del AS (DELETE FROM learn_suggestions WHERE id IN (SELECT id FROM over) RETURNING song_key)
       UPDATE playlists SET dismissed_keys = ARRAY(SELECT DISTINCT k FROM unnest(dismissed_keys || ARRAY(SELECT song_key FROM del)) AS k)
        WHERE id = $1 AND EXISTS (SELECT 1 FROM del)`,
      [playlistId, LEARN_MAX_SUGGESTIONS],
    );
  }
}

const dbStore = processMap<"db", LearnStore>("learn-stores");
const memoryStores = new WeakMap<PlaylistStore, LearnStore>();

/** The same choice as the Repertoire's store: memory offline or without DATABASE_URL, Postgres with it. */
export function learnStore(offline: boolean, playlists: PlaylistStore = playlistStore(offline)): LearnStore {
  const url = offline ? undefined : env().DATABASE_URL;
  if (url) {
    let store = dbStore.get("db");
    if (!store) dbStore.set("db", (store = new PostgresLearnStore(neon(url))));
    return store;
  }
  let store = memoryStores.get(playlists);
  if (!store) memoryStores.set(playlists, (store = new MemoryLearnStore(playlists as MemoryPlaylistStore)));
  return store;
}

export function resetLearnStoresForTests() {
  dbStore.clear();
}

/** The key of a song, as the Repertoire keys it. */
export const keyOf = playlistSongKey;
