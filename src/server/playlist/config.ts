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

// --- Learn run caps (docs/playlist-architecture.md §1.4, §2.3, §2.9) ---

/** A run needs at least this many songs you can sing (409 `empty_playlist` below it). */
export const LEARN_MIN_SONGS = 3;
/** Pending suggestions: a run is refused with `list_full` past it. */
export const LEARN_MAX_PENDING = 40;
/** Picks per run: 3 to 8 (fewer only if fewer valid songs exist). */
export const LEARN_MIN_PICKS = 3;
export const LEARN_MAX_PICKS = 8;
/** Suggestions in all, per Repertoire; past it the oldest dismissed rows go and their keys move to dismissed_keys. */
export const LEARN_MAX_SUGGESTIONS = 400;
/** Runs kept per Repertoire; past it the oldest run rows go and their suggestions keep (run_id NULL). */
export const LEARN_MAX_RUNS = 50;
/** The stored steps of one run, in bytes of JSON; over it the tool outputs are trimmed to their summary. */
export const LEARN_STEPS_MAX_BYTES = 256 * 1024;
/** The window of the run limit. */
export const LEARN_WINDOW_MINUTES = 60;
/** Runs that ended before the model got any data (Qloo down, nothing matched) cost nothing and don't count towards either limit (B-028). */
export const LEARN_UNCOUNTED_END_CODES: readonly string[] = ["qloo_unavailable", "no_match", "spotify_unavailable", "spotify_not_found"];
/** Busk plan runs that ended because Qloo was down cost nothing and don't count towards the 5-an-hour fresh-run limit (B-043, like B-028 for learn runs). */
export const PLAN_UNCOUNTED_END_CODES: readonly string[] = ["qloo_unavailable"];
/** Max picks that one artist may have in a run, and the songs across the Repertoire that make an artist "over-represented". */
export const LEARN_MAX_PER_ARTIST = 2;
export const LEARN_OVER_REPRESENTED_AT = 3;
/** The history block in the prompt: characters ÷ 4 estimate of tokens (docs §2.8). */
export const LEARN_HISTORY_TOKENS = 1500;

/**
 * Caps on one run (docs §2.3), next to the busk agent's `LIMITS` in agent/models.ts.
 * `maxSteps` model steps (each may call several tools); `tokenBudget` is input + output over the whole run;
 * `maxOutputTokensPerStep` includes thinking; `timeoutMs` stops the model, then the fallback finishes the run.
 */
export const LEARN_LIMITS = {
  maxSteps: 10,
  tokenBudget: 120_000,
  maxOutputTokensPerStep: 4000,
  timeoutMs: 75_000,
  /** `finish_suggestions` rejections before the run gives up on the model's words. */
  maxRejections: 2,
  /** A `running` row older than timeoutMs + this is marked failed by the next request for that Repertoire. */
  staleGraceMs: 30_000,
} as const;

/** Per-run call caps for the model's tools (a further call is a tool error the model sees). */
export const LEARN_TOOL_CAPS = { related_artists: 2, crowd_at: 3, rising: 2, crowd_profile: 1, top_tracks: 3, finish_suggestions: 3 } as const;

// --- Suggested fill in a busk's set (docs/plan-inputs-architecture.md §3.1, stage S4) ---

/** Suggested songs per pitch, at most (matches planRequestSchema performer.fillSuggested.max(8)). */
export const SUGGEST_MAX_PER_PITCH = 8;
/** Artists whose songs one pitch's fill looks up. Two songs each (LEARN_MAX_PER_ARTIST) fill the 8. */
export const SUGGEST_ARTISTS_PER_PITCH = 4;
/** Spotify/Last.fm catalogue lookups for the whole busk (3 pitches x 4 artists, fewer when pitches share artists). Not Qloo quota. */
export const SUGGEST_CATALOGUE_LOOKUPS = 12;
/** Extra Qloo calls the fill may make for a busk: the related-artists read (taste_artists). Warm: 0. */
export const SUGGEST_EXTRA_QLOO_CALLS = 1;
/** Related artists asked of Qloo for the fill (the city crowd's own artists are added to them). */
export const SUGGEST_RELATED_TAKE = 20;

// --- Repertoire research (hackathons/qloo-2026/repertoire-research-spec.md) ---

/** Your own songs a research run adds to Songs you can sing (step 2), at most: the rest of the 60 stay free for covers. */
export const RESEARCH_OWN_SONGS_MAX = 20;
/** Sound-alikes (step 4) saved as your "Artists you sound like" when that list is empty. */
export const RESEARCH_SOUNDS_LIKE_SAVED = 6;
/** Sound-alikes that join your own artist in step 6's signal. */
export const RESEARCH_SIGNAL_SOUND_ALIKES = 4;
/** Artists asked of Qloo in step 6 (sound-alikes and you are left out after), and kept. */
export const RESEARCH_FANS_LOVE_TAKE = 24;
export const RESEARCH_FANS_LOVE_KEPT = 10;
/** Artists whose top tracks step 7 looks up, and songs taken per artist. */
export const RESEARCH_LEARN_ARTISTS = 4;
export const RESEARCH_LEARN_PER_ARTIST = 2;
/** Genre tags asked of Qloo in step 8. */
export const RESEARCH_GENRES_TAKE = 8;
/** Step 9: one short call. */
export const RESEARCH_SUMMARY_LIMITS = { maxOutputTokens: 1500, timeoutMs: 30_000, maxPicks: 6, summaryChars: 700 } as const;
