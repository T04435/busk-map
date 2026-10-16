/**
 * Repertoire limits and learn-run constants (docs/playlist-architecture.md §1.4, §2.3, §2.9–2.10, §0).
 * One place, so the user can change a number in one line. Anything marked PROVISIONAL still waits
 * for the user's confirmation (HQ cards); the rest is fixed by the architecture or already decided.
 */

/** Songs you can sing + learned: a Repertoire must always fit one plan request (planRequestSchema songs.max(60)). */
export const MAX_SONGS = 60;
/** Sounds-like artists (planRequestSchema performer.artists.max(10)). */
export const MAX_SOUNDS_LIKE = 10;
/** Usual pitches (D4). */
export const MAX_USUAL_PITCHES = 3;

/** New Repertoires: 10 an hour per IP (stops table spam). */
export const PLAYLIST_CREATIONS_PER_HOUR = 10;
/** A Repertoire is deleted this many months after its last_seen_at. */
export const PLAYLIST_EXPIRY_MONTHS = 13;
/** last_seen_at is touched at most this often (ms), so a read isn't a write. */
export const TOUCH_INTERVAL_MS = 60 * 60_000;

/** The cookie: 400 days, Chrome's cap. */
export const COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

// --- Learn runs (the agent comes in a later stage; the constants live here already) ---

/** Learn runs per hour per Repertoire. Confirmed by the user, 17 Oct. */
export const LEARN_RUNS_PER_HOUR_PER_PLAYLIST = 3;
/** Learn runs per hour per IP. Confirmed by the user, 17 Oct. */
export const LEARN_RUNS_PER_HOUR_PER_IP = 6;
/** Qloo requests allowed in one run. */
export const LEARN_QLOO_BUDGET = 25; // PROVISIONAL (HQ card learn-run-limit, with D3)
/** One run at a time per Repertoire (the partial unique index on learn_runs). */
export const LEARN_CONCURRENT_RUNS = 1; // PROVISIONAL (HQ card learn-run-limit, with D3)
/** Usual pitches: taken from the top pitch of the last N plans made with the Repertoire (D4). R2 records them (server/playlist/usual.ts). */
export const USUAL_PITCHES_FROM_LAST_PLANS = 3; // PROVISIONAL (HQ card usual-pitches, D4)
/** A "Not for me" button with a dismissed state and Undo (D5). Confirmed by the user, 17 Oct. */
export const DISMISSED_STATE = true;
/** Last.fm as a third source on the Brain page (D6): yes. Confirmed by the user, 17 Oct (built in stage R4). */
export const BRAIN_LASTFM_NODE = true;
/** The learn model. Sonnet 5.5 with medium thinking is the busk agent's setting; switching to Haiku is this one line (D7). Confirmed by the user, 17 Oct. */
export const LEARN_MODEL = "planner" as "planner" | "haiku"; // confirmed 17 Oct (HQ card learn-model, D7)
/** Run steps are kept for the last N runs ... */
export const LEARN_STEPS_KEPT_RUNS = 5; // PROVISIONAL (HQ card run-retention, D8)
/** ... and for at most this many days. Suggestions are kept forever. */
export const LEARN_STEPS_KEPT_DAYS = 30; // PROVISIONAL (HQ card run-retention, D8)
/** A song is never suggested twice (D9), enforced by UNIQUE (playlist_id, song_key) on learn_suggestions. Confirmed by the user, 17 Oct. */
export const NEVER_RESUGGEST = true;
