/**
 * Spotify storage purge (Spotify Developer Terms IV.3: no indefinite storage). Stored Spotify data is kept until
 * 10 Nov 2026 (UTC), then removed by `pnpm purge:spotify`. Pure of process state: the SQL client and the clock are
 * passed in, so tests use fakes. Our own data and the Spotify IDs stay.
 */

/** The first day (UTC) the purge may run without --force. */
export const PURGE_FROM = "2026-11-10T00:00:00.000Z";

const SCDN = "'^https://([a-z0-9-]+\\.)*scdn\\.co/'";

/**
 * { action: "run" | "refuse", reason }. Before PURGE_FROM it refuses unless `--force` is in `flags`.
 */
export function purgeGate(now, flags = []) {
  const from = new Date(PURGE_FROM).getTime();
  if (now.getTime() >= from) return { action: "run", reason: "on or after 10 Nov 2026 (UTC)" };
  if (flags.includes("--force")) return { action: "run", reason: "before 10 Nov 2026 (UTC), but --force was passed" };
  return { action: "refuse", reason: "Stored Spotify data is kept until 10 Nov 2026 (UTC). Pass --force to purge earlier." };
}

/**
 * Each step nulls or deletes Spotify-sourced data and only touches rows that still hold some, so a re-run changes nothing.
 * Kept: spotify_artist_id, spotify_track_id, titles, artist names, song keys, our own rows and Qloo/Last.fm data.
 */
export const PURGE_STEPS = [
  { name: "playlist_songs.image (Spotify hosts)", sql: `UPDATE playlist_songs SET image = NULL WHERE image ~ ${SCDN}` },
  { name: "playlist_songs.artist_image (Spotify hosts)", sql: `UPDATE playlist_songs SET artist_image = NULL WHERE artist_image ~ ${SCDN}` },
  { name: "playlist_songs.year, duration_ms (source = spotify)", sql: "UPDATE playlist_songs SET year = NULL, duration_ms = NULL WHERE source = 'spotify' AND (year IS NOT NULL OR duration_ms IS NOT NULL)" },
  { name: "learn_suggestions.image_url", sql: "UPDATE learn_suggestions SET image_url = NULL WHERE image_url IS NOT NULL" },
  { name: "learn_suggestions.year, duration_ms (song_source = spotify)", sql: "UPDATE learn_suggestions SET year = NULL, duration_ms = NULL WHERE song_source = 'spotify' AND (year IS NOT NULL OR duration_ms IS NOT NULL)" },
  { name: "learn_suggestions.source_url (Spotify links)", sql: "UPDATE learn_suggestions SET source_url = NULL WHERE source_url ~ '^https://open\\.spotify\\.com/'" },
  { name: "playlists.spotify_profile", sql: "UPDATE playlists SET spotify_profile = NULL WHERE spotify_profile IS NOT NULL" },
  { name: "playlists.research, research_at", sql: "UPDATE playlists SET research = NULL, research_at = NULL WHERE research IS NOT NULL OR research_at IS NOT NULL" },
  { name: "learn_runs.steps", sql: "UPDATE learn_runs SET steps = NULL WHERE steps IS NOT NULL" },
  { name: "plan_store (cached runs)", sql: "DELETE FROM plan_store" },
  { name: "adapter_backoff (spotify)", sql: "DELETE FROM adapter_backoff WHERE adapter = 'spotify'" },
  { name: "adapter_usage (spotify)", sql: "DELETE FROM adapter_usage WHERE adapter = 'spotify'" },
];

/**
 * Runs every step through `sql.query(text)` and logs the rows each one changed. Returns the total.
 * @param {{ query: (text: string) => Promise<any[]> }} sql
 * @param {(line: string) => void} [log]
 */
export async function runPurge(sql, log = () => {}) {
  let total = 0;
  for (const step of PURGE_STEPS) {
    const rows = await sql.query(`WITH changed AS (${step.sql} RETURNING 1) SELECT count(*)::int AS n FROM changed`);
    const n = Number(rows[0]?.n ?? 0);
    total += n;
    log(`${step.name}: ${n} row${n === 1 ? "" : "s"}`);
  }
  return total;
}
