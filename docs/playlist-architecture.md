# Repertoire: architecture proposal (for approval, no code yet)

> **Name (user decision D2, 17 Oct): the feature is called "Repertoire"** in every user-facing label and in the copy module (`PLAYLIST_COPY.name = "Repertoire"`).
> **Code names deliberately stay `playlist`:** the tables `playlists` and `playlist_songs`, the cookie `buskmap_playlist`, `src/lib/playlist-copy.ts` and the routes under `/api/playlist/*`. The codebase already uses "repertoire" for the Spotify catalogue lookup (`src/server/adapters/repertoire/`, `/api/repertoire`, `RepertoirePicker`), so reusing that word for the saved list would collide. The wire fields stay as agreed in §7. A later rename stays cheap: one copy module for words, and internal names that are never shown.


Status: **proposal**, 16 Oct 2026, updated 17 Oct for "Songs you should learn is its own AI run", `dev/core`. Input: the user's draft spec and its 17 Oct update (`hackathon/hackathons/qloo-2026/playlist-spec.md`) and BRAND's learn-run sketch (`hackathon/hackathons/qloo-2026/design-handoff/playlist/learn-run-sketch.md` §5–6). Nothing here is built. "Exists" means it is in the code today, with `file:function`. "Proposed" means new.

The feature is a saved **Repertoire** with three parts:
- **Songs you can sing**: saved once, then used by Plan a busk and the week planner.
- **A suggested set per pitch**: today's setlist logic, unchanged.
- **Songs you should learn**: new, and **its own AI agent run** (the "learn run"). The performer presses "Find songs to learn". A second `ToolLoopAgent` investigates with Qloo (artists, crowds, growth), takes songs from Spotify (Last.fm as backup), and picks and explains them. Its steps stream live with the busk research pattern. Every run's picks are saved to the To learn list, grouped by run, and each new run reads that history so it never repeats itself.

## 0. Decisions needed from you

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Storage (HQ card `playlist-storage`) | **A: a device Repertoire in Neon behind an anonymous cookie** | It keeps the no-login rule, works on every browser including Safari, and moves into accounts later in one migration (§1.6). Run history needs a server store anyway |
| D2 | Name | Keep **"Repertoire"** for now. Every user-facing word lives in one module (§4.1), so "Songbook" costs one file later | You chose it. A rename stays cheap |
| D3 (changed) | **Run limit** (was the refresh limit) | **3 learn runs an hour per Repertoire and 6 an hour per IP. At most 25 Qloo requests per run.** One run at a time per Repertoire | §2.9: a run costs about US$0.08–0.14 of model time and 8–9 Qloo requests typically, 25 at worst |
| D4 | Usual pitches (the crowd input) | **Automatic:** the top pitch of each of the last 3 plans made with the Repertoire. With none, the city crowd | No new UI to design. It reflects where you actually play |
| D5 | A "Not for me" button on suggestions | **Yes:** a `dismissed` state, kept per run, undoable, never suggested again | Without it, a run brings back songs you rejected. BRAND's sketch already designs it |
| D6 | Last.fm on the Brain page | **Show it as a third secondary source** | It is the named songs backup. Today the Brain shows only Spotify and Ticketmaster (`qloo-map.ts:secondarySources`) |
| D7 (new) | **Learn run model** | **Claude Sonnet 5.5 with medium adaptive thinking**, the busk agent's settings (`models.ts:MODELS.planner`, `PLANNER_PROVIDER_OPTIONS`) | §2.5: summarised thinking is proven on the feed, and the guardrails reject fewer answers. About US$0.08–0.14 a run against Haiku's US$0.004–0.007. Swappable in one constant |
| D8 (new) | **History retention** | Keep **every suggestion** (they are the memory). Keep a run's **steps** (the replayable feed) for the **last 5 runs, and at most 30 days**. Older runs keep their header and suggestions, without steps | Steps hold tool outputs (Qloo data). Keeping them short-lived matches how `plan_store` treats runs (`002_agent_v2.sql`), and suggestions alone are enough for no-repeat |
| D9 (new) | **Re-suggest policy** | **Never re-suggest** a song already suggested (any status) or already in Songs you can sing. Enforced by a unique index | Simplest to explain and to test. "Undo" on a dismissed song brings it back to To learn; that is the only way back |

## 1. Data model and migrations

### 1.1 Identity: an anonymous device cookie (recommended, D1 = A)

- **Cookie:** `buskmap_playlist`. The value is a random **128-bit token** (16 bytes from `crypto.getRandomValues`, base64url, 22 characters).
  - Flags: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=34560000` (400 days, Chrome's cap). The expiry slides forward on each write.
  - It is set only by the server, on the first save. Browsing never creates a Repertoire.
- **Stored hashed:** the database keeps `sha256(token)` and never the token.
  - A leaked table can't be replayed as cookies.
  - A 128-bit random token needs no pepper or slow hash.
- **CSRF:** SameSite=Lax blocks cross-site POSTs. Every mutating route also checks that `Origin` matches the host, and joins `BOTID_PROTECTED_ROUTES` (`src/lib/botid-routes.ts`). `POST /api/playlist/learn` is the one that spends model money, so BotID matters most there.
- **The id never leaves the server.** It is not in URLs, plan requests or short links. A shared `/p/<id>` link carries a snapshot of the songs, never a pointer to anyone's Repertoire (§3.2). Learn run ids are random UUIDs and are only served to the cookie that owns them.
- The tip log stays as it is: a separate, script-written cookie (`src/lib/tips.ts:TIP_COOKIE`).

### 1.2 Tables: migrations `004_playlists.sql` and `005_learn_runs.sql`

`004` is the next number after `003_plans.sql`, and `005` follows it. Both are idempotent (`CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), because `scripts/migrate.mjs` reapplies every file in order. They are split so S1 (storage) can ship before S3 (learn runs). Both go to the Neon `dev` branch first (`pnpm db:migrate:dev`); production needs your approval, as the agent-v2 brief requires.

**`playlists`** (004)

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Internal only |
| `token_hash` | `TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$')` | sha256 hex of the cookie token |
| `act_name` | `TEXT NULL CHECK (char_length(act_name) BETWEEN 1 AND 80)` | Optional. Planners default to "My act", as the landing form does today (`performer-form.tsx:submit`) |
| `sounds_like` | `JSONB NOT NULL DEFAULT '[]'` | `[{name, spotifyId?, qlooId?}]`, at most 10 (matches `planRequestSchema.performer.artists.max(10)`) |
| `usual_pitches` | `JSONB NOT NULL DEFAULT '[]'` | `[{name, lat, lon}]`, at most 3 (D4) |
| `city` | `TEXT NOT NULL DEFAULT 'melbourne'` | `CITY_IDS` |
| `revision` | `INTEGER NOT NULL DEFAULT 1` | Bumped on every write. Two tabs get a 409 instead of losing an edit |
| `dismissed_keys` | `TEXT[] NOT NULL DEFAULT '{}'` | Added by **005**. `song_key`s of dismissed suggestions deleted by the size cap (§1.4), so no-repeat still holds |
| `created_at`, `updated_at`, `last_seen_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | `last_seen_at` drives expiry |

(Changed from the 16 Oct draft: `suggest_input_hash` and `suggested_at` are gone. A learn run is always an explicit, fresh run; the last run's date comes from `learn_runs`.)

**`playlist_songs`** (004): the repertoire only

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | |
| `playlist_id` | `UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE` | |
| `song_key` | `TEXT NOT NULL` | `lib/text.ts:trackKey(artist, title)`, the dedupe key the setlist already uses (`setlist.ts:buildSetlist`) |
| `state` | `TEXT NOT NULL CHECK (state IN ('can_sing','learned'))` | **Changed:** `to_learn` and `dismissed` now live in `learn_suggestions`. `learned` = can sing, learned through the To learn list |
| `source` | `TEXT NOT NULL CHECK (source IN ('spotify','lastfm','typed','suggested'))` | |
| `title` | `TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120)` | Same bounds as `plan-schema.ts:repertoireSongSchema` |
| `artist` | `TEXT NOT NULL CHECK (char_length(artist) BETWEEN 1 AND 80)` | |
| `own` | `BOOLEAN NOT NULL DEFAULT false` | The act's own song, as in `repertoireSongSchema.own` |
| `spotify_track_id` | `TEXT NULL CHECK (spotify_track_id ~ '^[A-Za-z0-9]{22}$')` | |
| `qloo_artist_id` | `TEXT NULL` | Cached Qloo entity id of the artist, so runs skip `/search` |
| `year` | `SMALLINT NULL CHECK (year BETWEEN 1900 AND 2100)` | |
| `duration_ms` | `INTEGER NULL CHECK (duration_ms > 0 AND duration_ms <= 3600000)` | |
| `suggestion_id` | `BIGINT NULL REFERENCES learn_suggestions(id) ON DELETE SET NULL` | Added by **005** (`ADD COLUMN IF NOT EXISTS`). Set when the row came from "Mark learned" |
| `added_at`, `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

Indexes: `UNIQUE (playlist_id, song_key)`; `(playlist_id, state)`; `playlists (last_seen_at)` for the expiry sweep.

**`learn_runs`** (005, proposed)

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | `runId` on the wire |
| `playlist_id` | `UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE` | |
| `number` | `INTEGER NOT NULL` | "Run 3": per Repertoire, `max(number)+1` in the insert |
| `started_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `finished_at` | `TIMESTAMPTZ NULL` | |
| `status` | `TEXT NOT NULL CHECK (status IN ('running','done','failed','fallback'))` | `fallback` = finished with the deterministic picks (§2.6) |
| `end_code` | `TEXT NULL` | The `end` event's `code` (§7.2), e.g. `timeout`, `qloo_unavailable`, `nothing_new` |
| `model` | `TEXT NOT NULL` | `anthropic/claude-sonnet-5.5`, `mock`, or `template` |
| `inputs` | `JSONB NOT NULL` | `{songs, soundsLike, pitches}` as in the `run` event (§7.2) |
| `steps` | `JSONB NULL` | The run's stream events except `run` and `suggestion` (notes, tool-start/end with outputs, totals, usage). **NULL once pruned** (D8). At most 256 KB, checked before the write; over it, tool outputs are trimmed to their `summary` |
| `totals` | `JSONB NOT NULL DEFAULT '{}'` | The final learn totals (§2.7) |
| `usage` | `JSONB NULL` | The `usage` event (steps, tokens, ms, stoppedBy) |
| `new_count`, `skipped_count` | `SMALLINT NOT NULL DEFAULT 0` | For the run header without reading suggestions |

Indexes:
- `UNIQUE (playlist_id, number)`.
- `(playlist_id, started_at DESC)`: the run list, the history query and the per-Repertoire run limit (§2.10).
- **`UNIQUE (playlist_id) WHERE status = 'running'`** (partial): one run at a time per Repertoire, enforced atomically. A second start gets a 409 with the running `runId`.

**`learn_suggestions`** (005, proposed): the To learn list and the memory

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | `id` on the wire (as a string) |
| `run_id` | `UUID NULL REFERENCES learn_runs(id) ON DELETE SET NULL` | NULL for a song added from a plan's Learn these (§3.3), or after its run row was capped (§1.4) |
| `playlist_id` | `UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE` | Denormalised, so history and the unique key need no join |
| `song_key` | `TEXT NOT NULL` | `trackKey(artist, title)` |
| `spotify_track_id` | `TEXT NULL CHECK (spotify_track_id ~ '^[A-Za-z0-9]{22}$')` | NULL when the song came from Last.fm |
| `title`, `artist` | as `playlist_songs` | Always copied **from the catalogue record**, never from model text |
| `qloo_artist_id` | `TEXT NULL` | |
| `year`, `duration_ms` | as `playlist_songs` | Spotify only; NULL from Last.fm |
| `image_url` | `TEXT NULL CHECK (image_url ~ '^https://i\.scdn\.co/')` | Spotify album art only |
| `source_url` | `TEXT NULL` | `https://open.spotify.com/track/<id>` or the Last.fm track URL |
| `song_source` | `TEXT NOT NULL CHECK (song_source IN ('spotify','lastfm','plan'))` | |
| `reason` | `TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 240)` | The model's "why" line, after the guardrail, or the template line |
| `evidence` | `JSONB NOT NULL` | `{ranker: "claude"\|"mock"\|"template", artistFrom: "related_artists"\|"crowd_at"\|"plan", because: string[], affinity, growth, trendDelta, pitch?, basedOn: [{kind, name}]}`: small derived numbers only, never raw tool output |
| `status` | `TEXT NOT NULL CHECK (status IN ('pending','learned','dismissed'))` | |
| `rank` | `SMALLINT NULL` | Order within the run |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | `suggestedAt` |
| `learned_at`, `dismissed_at` | `TIMESTAMPTZ NULL` | |

Indexes:
- **`UNIQUE (playlist_id, song_key)`**: the no-repeat rule (D9) in the database. A song can be suggested once per Repertoire, whatever its status. This is the backstop under the guardrail in §2.6.
- `(playlist_id, status, created_at DESC)`: the To learn list and the history block.
- `(run_id, rank)`: a run's group.

**How they relate.** `playlists` 1–n `learn_runs` 1–n `learn_suggestions`. "Mark learned" sets the suggestion to `learned` and inserts a `playlist_songs` row (`state='learned'`, `source='suggested'`, `suggestion_id` set) in one transaction. "Undo" deletes that row and sets the suggestion back to `pending`. A song typed into Songs you can sing that matches a pending suggestion's `song_key` marks that suggestion `learned` too, so the two lists never disagree.

### 1.3 States and transitions (proposed)

| Where | From → to | Trigger | Notes |
|---|---|---|---|
| `playlist_songs` | (none) → `can_sing` | Picked from Spotify search, loaded from "my Spotify artist" (`source=spotify`), typed (`typed`) | |
| `learn_suggestions` | (none) → `pending` | A learn run's accepted picks, or "Add to Repertoire" on a plan's Learn these (`run_id NULL`, `song_source='plan'`) | |
| both | `pending` → `learned` | "Mark learned" | `learned_at = now()`, plus the `playlist_songs` row (§1.2). Planners treat it as can sing |
| both | `learned` → `pending` | "Undo" | The `playlist_songs` row goes |
| `learn_suggestions` | `pending` → `dismissed` | "Not for me" (D5) | `dismissed_at = now()`. Folded under its run, never suggested again |
| `learn_suggestions` | `dismissed` → `pending` | "Undo" | |
| `playlist_songs` | any → (deleted) | Remove | A suggestion is never deleted by the user: its row is the memory |

**Planners read `playlist_songs`** (`can_sing` and `learned`). `learned` stays its own state for the "you've learned N songs" line and for the history block's "Learned" group (§2.8).

### 1.4 Soft limits (enforced in the store, in one conditional statement)

| Limit | Value | Why |
|---|---|---|
| Can sing + learned | **60** | `planRequestSchema.performer.songs.max(60)`: a Repertoire must always fit one plan request |
| Picks per run | **3 to 8** (fewer only if fewer valid songs exist) | BRAND's demo shows 6. Keeps a run's list readable |
| Pending suggestions | **40** | A run is refused with `list_full` past it ("Mark some learned or dismiss them first") |
| Suggestions in all | **400** per Repertoire | Bounds the memory; at 8 a run, about 50 runs. Past it, the oldest **dismissed** rows of pruned runs are deleted first, and their `song_key` goes into `playlists.dismissed_keys`, so no-repeat still holds |
| Runs | **50** per Repertoire | Past it, the oldest run rows are deleted; their suggestions stay (`run_id` → NULL, shown under "Earlier runs") |
| Steps kept | **Last 5 runs, at most 30 days** (D8) | Pruned in the same statement that inserts a new run |
| New Repertoires | 10 an hour per IP | Stops table spam (`rate-limit.ts:createRateLimiter`) |
| Expiry | Delete a Repertoire 13 months after `last_seen_at` | A small sweep run when `/api/playlist` writes, or a cron later. The cascade removes runs and suggestions |

### 1.5 Privacy

- No PII is required. The act name is optional, and nothing ties a row to a person, an email or an IP. IPs are used only by the in-memory limiters (`rate-limit.ts`).
- **"Forget my Repertoire"** (`DELETE /api/playlist`) deletes the row (songs, runs and suggestions go with it through the cascade) and clears the cookie.
- The privacy note on the landing page says what is stored and for how long.
- Stored run steps hold Qloo tool outputs at runtime only, are never committed, and are pruned under D8. Suggestions keep only small derived numbers.

### 1.6 Later: accounts (plan B, not now)

- Migration `00N_playlist_accounts.sql` adds `user_id TEXT NULL UNIQUE` to `playlists`.
- **On sign-in:**
  - The user has no Repertoire: set `user_id` on the device Repertoire.
  - The user already has one: merge the device Repertoire into it, then delete the device row.
    - Songs: union by `song_key`, `learned` > `can_sing`.
    - Suggestions: union by `song_key`, status precedence `learned` > `pending` > `dismissed`, the earliest `created_at` wins. Runs move across and are renumbered by `started_at`.
    - `sounds_like` is a union, capped at 10.
- After sign-in the cookie is only a pointer. Each device merges once.
- Because everything hangs off `playlist_id`, never off the cookie, nothing else changes.

### 1.7 The comparison

| | **A. Neon + anonymous cookie** (recommended) | B. Accounts now (magic link) | C. localStorage only |
|---|---|---|---|
| No-login rule | Kept | Breaks it unless sign-in is optional | Kept |
| Cross-device | No (until accounts) | Yes | No |
| Survives clearing site data | No (the cookie goes) | Yes | No |
| Safari | Fine: an httpOnly server cookie isn't capped at 7 days | Fine | **Script-written storage is wiped after 7 days without a visit (ITP)** |
| Learn run history and limits | Yes: runs and suggestions are stored per Repertoire, the run limit counts stored runs, replays come from Neon | Yes | **No.** The server can't remember what it suggested, the limit can only be per IP, and every run must re-send the whole history |
| Server-rendered prefill of the forms | Yes (the cookie is read server-side) | Yes | No: the forms flash empty, then fill from script |
| Merge into accounts later | One migration (§1.6) | n/a | Import on first sign-in, from each browser |
| Cost and extra work | 2 migrations, 2 stores, the routes in §3.6 | Resend account, sign-in design, email flows | None on the server |

## 2. Songs to learn: the learn agent (proposed)

### 2.1 The split, and one run end to end

Qloo has no song-level data, so the work stays split, now inside an agent loop:
1. **Qloo** finds and scores the **artists** (the Repertoire's taste, the crowds at your pitches, who is rising).
2. **Spotify** (Last.fm as backup) supplies the **songs** of the artists the agent chose.
3. **Claude** decides what to look at next, chooses the picks from the songs the tools returned, and writes one reason per pick. It never adds a song.

Code (proposed): `src/server/learn/agent.ts` (`runLearnAgent`, `LEARN_INSTRUCTIONS`, `buildLearnPrompt`), `src/server/learn/tools.ts` (`createLearnTools`, `LearnState`, `checkPicks`), `src/server/learn/history.ts` (`loadHistory`, `formatHistory`), `src/server/learn/store.ts` (Memory and Postgres), `src/server/learn/fallback.ts`, `src/lib/learn-schema.ts` and `src/lib/learn-totals.ts` (client-safe). It mirrors `src/server/agent/` file for file, so the two agents read alike.

**One run** (`POST /api/playlist/learn`):
1. Load the Repertoire. Refuse before spending anything: no Repertoire (404), fewer than 3 songs you can sing (409 `empty_playlist`), a run already going (409 `already_running` with its `runId`), pending list full (409 `list_full`), the run limit (429 `limit`, §2.10).
2. Insert the `learn_runs` row (`status='running'`). Emit `run`, then `status`.
3. **Server steps, no model** (emitted as ordinary `tool-start`/`tool-end` pairs so the feed shows them):
   - `match_playlist`: resolve the seed artists to Qloo ids (§2.2).
   - `history`: load and summarise what was suggested before (§2.8).
   If `match_playlist` gets nothing because Qloo is down, the run ends `qloo_unavailable` before any model call, as `agent.ts:runAgent` throws `QlooUnavailableError` today.
4. Run the `ToolLoopAgent` (§2.3–2.6), inside `withQlooUsage` (`adapters/qloo/usage.ts`) so the Qloo budget is counted and capped per run, exactly as `agent.ts:runPlanAgent` wraps `runAgent`. (Steps 3 and 4 share one `withQlooUsage` scope, so `match_playlist` counts too.)
5. On an accepted `finish_suggestions` (or the fallback, §2.6): insert the suggestions in one statement (the unique index is the last check), emit one `suggestion` event per saved row in rank order, the final `totals` and `usage`, then `end`. Update the run row (`status`, `steps`, `totals`, `usage`, counts).

### 2.2 Tools (proposed `learn/tools.ts`), with BRAND's names

Names follow BRAND's sketch (§7). Two are **server steps** the model never calls; five are model tools. Every model tool takes a zod input, records its output in a `NumberBag` (`tools.ts:NumberBag`, reused) for the reasons check, and returns a one-line `summary`, as the busk tools do (`tools.ts` header). Mapping from the brief: `taste_artists` → `related_artists`, `crowd_artists_at` → `crowd_at`, `artist_momentum` → `rising`, `find_songs` → `top_tracks`, `finish_learn` → `finish_suggestions`.

| Tool | Who calls it | Input (zod) | What it does | Data call | Output the model and the card see |
|---|---|---|---|---|---|
| `match_playlist` | **Server**, once, first | – | Resolves seed artists: the can-sing and learned songs' artists plus `sounds_like`, unique, most frequent first, at most 10 (`qloo/index.ts:MAX_ARTISTS`). Stored ids first (`playlist_songs.qloo_artist_id`, `sounds_like[].qlooId`), then `qloo/index.ts:resolveArtists` / `resolveSpotifyArtists` for the rest, writing the ids back | Qloo #1 `/search` or #2 `/entities` (existing) | `{summary, songs, artists: [{name, matched}], unmatched: string[]}` |
| `history` | **Server**, once, second | – | Loads the history (§2.8). Its numbers feed the totals | Neon only | `{summary, canSing, pending, learned, dismissed, earlierRuns, lastRunAt}` (counts and the last date; the lists themselves are in the prompt) |
| `related_artists` | Model | `{ seeds: z.array(z.string().max(80)).max(10).optional(), take: z.number().int().min(5).max(30).default(20) }`. `seeds` are artist names from `match_playlist` (default: all); anything else is a tool error that lists the valid names | Artists whose fans overlap the Repertoire's seeds, anywhere | **Qloo #12 (new)** `/v2/insights` `filter.type=urn:entity:artist`, `signal.interests.entities`, `feature.explainability=true`, no location. Proposed `client.ts:tasteArtists`, cached and counted like the others (`countLookup` + `lookupScope`, `cacheLife("days")`) | `{summary, artists: [{artistId, name, affinity, because: string[], growth, alreadyInPlaylist}]}`, at most 20 rows |
| `crowd_at` | Model | `{ pitch: z.enum([...usualPitchNames, "city"]), take: z.number().int().min(5).max(15).default(10) }` | Artists the crowd at one of **your** usual pitches likes, from fans of your seeds | **Qloo #5c** `client.ts:localArtists` with `where.ts:boxAround(pitch, 400 m)` (existing function, same shape as the busk agent's `crowd_at`, so it can share cache entries). `"city"` = #5 over `CITIES[city].bbox` | `{summary, pitch, artists: [{artistId, name, affinity, because, growth, alreadyInPlaylist}]}` |
| `rising` | Model | `{ artistIds: z.array(z.string().max(80)).min(1).max(5) }`, ids from earlier results only | Momentum for up to 5 candidate artists | **Qloo #8** `client.ts:trendingWindow` (cached for the day) then `client.ts:trending` (one request each, existing) | `{summary, window: {start, end} \| null, artists: [{artistId, name, growth, trendDelta \| null}]}`, flat rows dropped as `context.ts:PlanContext.rising` does |
| `crowd_profile` | Model, optional | `{}` | The age lean of the seeds' fans, for era fit | **Qloo #9** `client.ts:demographics` (existing) | `{summary, ageLean, bands}` |
| `top_tracks` | Model | `{ artistIds: z.array(z.string().max(80)).min(1).max(4), perArtist: z.number().int().min(1).max(3).default(3) }`, ids from earlier results only | Songs by those artists. **Already-suggested, dismissed and can-sing songs are filtered out here, server-side**, and reported as counts | Spotify (primary): proposed `repertoire/client.ts:searchArtistTracks(artist, market)` (`/v1/search?q=artist:"…"&type=track`, `nameKey` match; the top-tracks endpoint returns 403, see the `repertoire/client.ts` header). Last.fm (backup per artist): `songs/client.ts:fetchTopTracks` (existing) | `{summary, songs: [{songId: "s-<n>", title, artist, artistId, year, durationMs, source, popularity}], skipped: {alreadySuggested, dismissed, canSing}, overRepresented: string[]}` |
| `finish_suggestions` | Model | §2.6 | The final answer, checked | none | `{accepted, summary, problems?}` |

Per-run call caps (a further call is a tool error the model sees): `related_artists` 2, `crowd_at` 3, `rising` 2, `crowd_profile` 1, `top_tracks` 3 (so at most 12 artists' catalogues), `finish_suggestions` 3.

**Why history is in the prompt and also a server step, not a model tool.** Every run needs it, so a model tool would cost a step (a full re-send of the context) and the model might skip it. Putting it in the prompt makes it always present. The `history` server step gives the feed BRAND's card ("Left out 5 songs suggested before and 2 you dismissed") without a model call. `match_playlist` is a server step for the same reason: it is deterministic, and the model has nothing to decide there.

### 2.3 Gating and caps (proposed `learn/tools.ts`, the investigate-first pattern)

Mirrors `tools.ts:scoringOpen`, `tools.ts:gateMessage` and the `prepareStep` in `agent.ts:runAgent`:
- **`top_tracks` opens** after at least 1 successful `related_artists` **and** at least 1 successful `crowd_at` or `rising` (`songsOpen(state)`). Before that, `prepareStep` offers only `related_artists`, `crowd_at`, `rising` and `crowd_profile`, and a direct call returns a `gateMessage`-style error saying what is still needed.
- **`finish_suggestions` opens** after at least 1 successful `top_tracks` that returned songs.
- **Wrap-up**, as `agent.ts` does: from step `maxSteps − 2`, or past 60% of the token budget with no songs found yet (75% once songs are found), `state.wrappingUp = true` and the active tools shrink to `top_tracks` + `finish_suggestions`, then to `finish_suggestions` only, with an instruction appended. If `finish_suggestions` is called while wrapping up with no songs, the server runs `top_tracks` itself for the 4 best artists seen (as `finish_plan` calls `scorePool` when wrapping up).

**Caps** (proposed `LEARN_LIMITS` in `agent/models.ts`, next to `LIMITS`):

| Cap | Value | Busk agent today (`models.ts:LIMITS`) |
|---|---|---|
| `maxSteps` | **10** | 12 |
| `tokenBudget` (in + out, whole run) | **120,000** | 200,000 |
| `maxOutputTokensPerStep` (thinking included) | **4,000** (reuse) | 4,000 |
| `timeoutMs` | **75,000** | 90,000 |
| Qloo requests per run | **25** (`LEARN_QLOO_BUDGET`, §2.9) | none (24–33 measured per cold busk) |
| `finish_suggestions` rejections before giving up | **2** (`MAX_LEARN_REJECTIONS`) | 2 (`tools.ts:MAX_FINISH_REJECTIONS`) |

### 2.4 Instructions (draft, proposed `learn/agent.ts:LEARN_INSTRUCTIONS`)

```
You are Busk Map's song scout. A street performer wants new songs to learn: songs that fit their
taste and voice, that the crowds where they busk will like, and that they haven't been offered
before. You investigate with tools. You never invent a song: you choose only from songs that
top_tracks returned in this run.

What you already know (in the prompt): the songs they can sing, the artists they sound like, their
usual pitches, and the history of earlier runs: what was suggested, what they learned, what they
dismissed. Build on it. If they learned a song, look for artists close to it. If they dismissed
several songs by one kind of artist, look elsewhere. Never offer a song from the history again.

How to work:
1. Investigate first. top_tracks stays closed until you have used related_artists at least once
   and crowd_at or rising at least once. Decide each next look from what you found: a strong
   related artist, a crowd at one of their pitches, an artist who is rising.
2. Shortlist artists that fit both their taste and their crowds. Prefer artists who are not
   already in their Repertoire. No more than 2 songs by one artist.
3. Call top_tracks for your shortlist. It already leaves out songs from the history.
4. Finish with finish_suggestions: 3 to 8 songIds from top_tracks, best first, each with a
   one-sentence reason a busker would find useful. If it is rejected, fix what it says and call it
   again.

Before each tool call, write one short sentence saying what you will check next and why. You have
about 8 tool calls. Don't repeat a call with the same inputs.

Rules:
- Every number in a reason must come from a tool result. Don't add numbers you weren't given.
- Say "builds on <song>" only for a song in their Learned list.
- Taste data is aggregate. Never describe an individual.
- Be brief and concrete. Australian English.
```

`buildLearnPrompt` (proposed) gives: the act name, the matched seeds and the unmatched names (from `match_playlist`), the usual pitches by name (D4) or "none: use city", the city, today's date, and the history block (§2.8). As in `agent.ts:runAgent`, the prompt and the instructions are added to `state.seen`, so dates and counts there are allowed numbers.

### 2.5 The model: Sonnet or Haiku for a visible demo run

Prices and measurements are the ones already recorded in `dev-log.md` (16 Oct: Sonnet 5.5 US$2 / US$10, Haiku 5.5 US$0.10 / US$0.50 per million tokens, Anthropic list price through AI Gateway; busk runs measured at 27–37k input and 1.3–1.9k output tokens, 5–6 steps, 24.6–35.8 s).

**Estimated learn run size:** about 6 model steps (related_artists, crowd_at ×1–2 in one step, rising, top_tracks, finish ×1–2). Each step re-sends the context, and the history block adds up to 1,500 tokens to every step (§2.8), so: **30–55k input, 1.5–3k output tokens** (8 reasons of about 40 tokens, the pre-call sentences, the thinking summaries). These are estimates until the S3 live check.

| | **Sonnet 5.5, medium adaptive thinking** (recommended) | Haiku 5.5 |
|---|---|---|
| Thinking summaries on the feed | **Proven here**: `PLANNER_PROVIDER_OPTIONS` (`display: "summarized"`) streams readable reasoning notes; measured 85–196 thinking tokens a run | **Unverified in this repo.** `models.ts` only configures thinking for Sonnet. It must be checked on the gateway before choosing; without it the feed has only the pre-call sentences |
| Quality | Follows investigate-first and the number rule; the busk agent's `finish_plan` was rejected once in the measured runs and fixed itself | Weaker at multi-step tool choice and at "build on what was learned" (an expectation, not measured here). More rejections mean more template fallbacks, the worst outcome on stage |
| Cost per run | 30–55k × $2/M + 1.5–3k × $10/M = **US$0.075–0.14** | 30–55k × $0.10/M + 1.5–3k × $0.50/M = **US$0.004–0.007** |
| 100 runs | US$7.50–14 | US$0.40–0.70 |
| Latency per run | **25–40 s** (scaled from 24.6–35.8 s for 5–6 busk steps; BRAND's copy says "about 30 s") | Not measured here; expect roughly half |
| Reuse | Same model id, options and gateway path as the busk agent: no new configuration | New thinking options to verify |

**Recommendation (D7): Sonnet 5.5 with medium thinking** for the visible run. The run is a demo moment, the guardrail rejects bad answers, and a fallback in front of judges costs more than US$0.10. Proposed `MODELS.learn = MODELS.planner` and `LEARN_PROVIDER_OPTIONS = PLANNER_PROVIDER_OPTIONS`, so switching to Haiku later is a one-line change. S3 includes a small live check: 3 Sonnet runs on one test Repertoire (about US$0.40), with tokens, timings and rejections recorded in `dev-log.md`. Offline, a proposed `mock-model.ts:createMockLearner(scenario)` drives the same tools.

### 2.6 `finish_suggestions`: the guardrail, the rejection loop, the fallback

**Input (proposed):**

```
finishSuggestionsSchema = z.object({
  picks: z.array(z.object({
    songId: z.string().max(20),              // "s-<n>" from this run's top_tracks
    reason: z.string().min(1).max(240),      // one sentence
    buildsOn: z.string().max(120).optional() // a title from the Learned list, if the pick follows it
  })).min(1).max(8),
  summary: z.string().max(400),              // one or two sentences for the run (raw view and status line)
  notes: z.array(z.string().max(300)).max(4) // data caveats
})
```

**Checks** (a pure `checkPicks(answer, state)`, like `tools.ts:checkAnswer`):
1. **From this run's catalogue:** every `songId` must be in `state.found` (filled only by this run's `top_tracks`). Unknown ids are rejected with a list of the best valid ones, as `checkAnswer` lists the scored pool.
2. **No repeats (D9):** no `song_key` already in `learn_suggestions` for this Repertoire (any status), in `playlists.dismissed_keys` or in `playlist_songs`, and no duplicate within the picks. `top_tracks` already filters these, so this is a backstop. Re-suggesting is **not allowed**; there is no "re-suggest with a reason" path.
3. **Artist cap:** at most **2 picks per artist** in a run, and **0** for an artist who already has 3 or more songs across can-sing, learned and pending (`overRepresented`).
4. **Count:** at least `min(3, valid songs found)`.
5. **Numbers:** every number in `reason`, `summary` and `notes` must be in `state.seen` (`NumberBag.unknownIn`, reused).
6. **`buildsOn`:** must match a title in the Learned list, else it is dropped silently (not a rejection).

**Rejection loop:** any problem returns `{accepted: false, summary: "Rejected: …", problems}` and `state.rejections++`, as `finish_plan` does. After `MAX_LEARN_REJECTIONS` (2):
- picks with only number problems are kept, with the offending reasons **replaced by the template reason** (never shown with unverified numbers; stricter than `finish_plan`, which accepts and records `unverifiedNumbers`);
- picks that break rules 1–3 are dropped;
- if at least `min(3, found)` remain, the run is accepted (`status='done'`); otherwise it falls back.

**Server-side fields, never from the model:** title, artist, year, duration, image, source URL and Spotify id come from the `top_tracks` record. `because` comes from Qloo explainability of the artist's result. `basedOn`, `growth`, `isNew` and the rank are computed by the server (§2.8, §7.2).

**Deterministic fallback** (proposed `learn/fallback.ts`, the `setlist.ts:learnThese` ranking): used when the model fails, times out, hits the step or token cap without an accepted answer, or ends with too few valid picks.
1. Candidates: every artist from this run's `related_artists` and `crowd_at` outputs, minus excluded and over-represented artists.
2. Rank: growth (`audience_growth`), then trend delta, then best affinity with a bonus for an artist found both in `related_artists` and at a pitch, then Last.fm listeners.
3. Songs: this run's `top_tracks` results, or, if it never ran, the server calls it for the top 4 artists (Spotify and Last.fm don't count against the Qloo budget).
4. Up to 6 picks, 2 per artist at most, with template reasons ("Fans of Dolly Parton also like Gillian Welch, and the crowd at Bourke St Mall likes her too."). `evidence.ranker = "template"`, `learn_runs.status = 'fallback'`, the `end` event says `mode: "fallback"`.
5. If even that finds no songs: `end` with `code: "nothing_new"` (all songs were already in the history) or `ok: false, code: "qloo_unavailable"` (no artists at all).

### 2.7 Streaming and replay

**Route (proposed):** `POST /api/playlist/learn` returns `application/x-ndjson`, as `api/plan/route.ts` does. Pre-run refusals are plain JSON errors (§2.10, §7.2), not a stream.

**Schema (proposed `src/lib/learn-schema.ts`):** `planStreamEventSchema` (`plan-schema.ts`) stays exactly as it is on the wire. Its member objects (`status`, `note`, `tool-start`, `tool-end`, `usage`) are exported from `plan-schema.ts` as named schemas, and `learnStreamEventSchema` is a new discriminated union of those five plus `run`, `totals` (with `learnTotalsSchema`), `suggestion` and `end`. It has **no `plan` and no `error` event**: every learn stream ends with exactly one `end`. The fields are in §7.2.

**Event order of a run:** `run` → `status` → `tool-start`/`tool-end` `match_playlist` → `totals` → `tool-start`/`tool-end` `history` → `totals` → (`note`* → `tool-start` → `tool-end` → `totals`)* → `suggestion`* → `totals` (final) → `usage` → `end`.

**`learnTotalsSchema` (proposed `src/lib/learn-totals.ts`, pure, like `research-totals.ts:fromToolOutputs`):** counted over the finished tool calls so far, sent after each `tool-end` and once more before `end`. All non-negative integers:

| Field | Meaning |
|---|---|
| `artists` | Seed artists matched on Qloo (`match_playlist`) |
| `crowds` | Distinct `crowd_at` reads that returned at least one artist |
| `liked` | Distinct artists found across `related_artists` and `crowd_at`, excluding seeds |
| `songsChecked` | Distinct songs `top_tracks` looked at, before filtering |
| `alreadySuggested` | Songs `top_tracks` left out because they were suggested before (pending or learned) |
| `dismissedSkipped` | Songs left out because you dismissed them |
| `alreadyKnown` | Songs left out because they are in Songs you can sing |
| `newSongs` | Suggestions saved by this run: **0 until the run is accepted**, then the final count |
| `qlooCalls`, `qlooCacheHits` | As in `research-totals.ts` (requests sent, cached lookups), from the run's `withQlooUsage` counter |

**Runs in flight:** reuse `agent/runs.ts:AgentRun` (push, follow, finish) through a learn-specific `processMap` keyed by `runId`, so a reload or a second tab joins the live feed: `GET /api/playlist/learn/runs/<runId>/events` follows an in-flight run on this instance. A run keeps going if the viewer leaves (as `runs.ts` already does), and its suggestions land in the list. On another instance, the row says `running` and the client polls `GET /api/playlist/learn` every 5 s until it finishes.

**Replay of a stored run:** the same `GET …/events` on a finished run replays the stored events from `learn_runs.steps` (the `AgentRun.replay` pattern, `runs.ts`), with `run.replay: true` and `status.replay: true`, then the run's stored suggestions as `suggestion` events (with their **current** status) and `end`. A pruned run (D8) replays as `run` (`stepsKept: false`), its suggestions, and `end`. A replay never calls a model or Qloo and is never counted against the limit.

**Stale runs:** a `running` row older than `timeoutMs + 30 s` is marked `failed` (`end_code='timeout'`) by the next request for that Repertoire, so a crashed instance never blocks the partial unique index for long.

### 2.8 History in the prompt

**Loaded by `learn/history.ts:loadHistory` (proposed)** with two queries: `playlist_songs` (can sing, learned) and `learn_suggestions` (all statuses, newest first), plus the last finished run.

**Format (compact, grouped by artist so repeated names cost once):**

```
Songs you can sing (14): Dolly Parton: Jolene, 9 to 5 | Gillian Welch: Orphan Girl | …
Learned from earlier runs (2): Edge of Town (Middle Kids, run 2, 12 Oct) | …
On your To learn list, not learned yet (5): Shelter From the Storm (Bob Dylan, run 3) | …
Dismissed, never suggest again (4): Old Town Road (Lil Nas X) | …
Earlier runs: 3. Last run: 17 Oct 2026 (run 3, 6 new).
```

Titles and artists are the stored, length-bounded values, with newlines and `|` stripped (they are the user's own data, but a typed title is still kept from reading like an instruction).

**Token budget: 1,500 tokens** for the whole block, estimated as characters ÷ 4 (about 6,000 characters), checked as it is built. Truncation, applied in this order until it fits, **most recent first within each group**:
1. "On your To learn list": keep the newest 20, then "and N more".
2. "Dismissed": keep the newest 20, then "and N more, mostly by <top 3 artists>".
3. "Songs you can sing": keep every artist, but at most 2 titles each, then "+N".
4. "Learned": never truncated below the newest 10 (it drives "builds on").

**The prompt is guidance only.** No-repeat is enforced on the **full** history whatever the truncation: `top_tracks` filters against every `song_key` in `learn_suggestions`, `dismissed_keys` and `playlist_songs`, `checkPicks` checks again, and the unique index is the last line.

**"New this run" is computed by the server, never trusted from the model:**
- In a run's stream: a `suggestion` is emitted only for a row this run inserted. Under D9 every one of them is new, so `isNew: true`.
- In the stored list: `isNew = (run_id = the Repertoire's latest finished run)`. Older runs' rows read `false`, so "New this run" moves on with each run.
- `basedOn` (server, from the run's tool data): `learned` when the artist's Qloo `because` list (or the model's checked `buildsOn`) names a learned song's artist or title; `repertoire` when it names a can-sing artist; `soundsLike` when it names a sounds-like artist; `crowd` when the artist came from `crowd_at` (with the pitch name).

### 2.9 Cost per run

**Qloo requests per run** (call numbers from `docs/qloo-data-map.md` §1):

| Part | Cold (ids not stored, nothing cached) | Typical (ids stored, today's trending window cached) |
|---|---|---|
| `match_playlist` (#1 `/search` or #2 `/entities`) | ≤ 10 | 0 |
| `related_artists` (#12), ≤ 2 calls | ≤ 2 | 1 |
| `crowd_at` (#5c), ≤ 3 calls | ≤ 3 | 2 |
| `rising`: window probes (#8) | ≤ 5 | 0 |
| `rising`: trending (#8), ≤ 2 calls × ≤ 5 artists | ≤ 10 | 5 |
| `crowd_profile` (#9), ≤ 1 call | ≤ 1 | 0–1 |
| **Sum of the per-tool caps** | **≤ 31** | **8–9** |

- **Hard cap: 25 requests per run** (proposed `LEARN_QLOO_BUDGET = 25`), below the 31 the tool caps alone would allow. `runLearnAgent` keeps the `QlooUsage` object that `withQlooUsage` passes in. Before each Qloo tool runs, it checks `usage.calls + worstCost(tool, input) ≤ 25` (worst costs: `related_artists` 1, `crowd_at` 1, `crowd_profile` 1, `rising` `artistIds.length` plus 5 if today's window isn't cached yet). Over the cap, the tool returns `{summary: "The Qloo budget for this run is used up", skipped: "budget"}` instead of calling, and the model is told to finish. The counter can't stop a request in flight, so the pre-check uses the worst case.
- Against the quota (10,000 a month, `qloo-map.ts:QUOTA`): 100 typical runs ≤ 900 requests (9%), 100 cold ones ≤ 2,500.
- Spotify (≤ 12 searches) and Last.fm (≤ 12 top-track calls) per run are cached for days and weeks and are not Qloo quota.

**Model per run** (D7, §2.5): Sonnet **US$0.075–0.14**; Haiku US$0.004–0.007. With the limits below, one Repertoire can spend at most 3 runs an hour, about US$0.42. The gateway's US$50 a month budget stays the backstop (`docs/deploy.md`).

### 2.10 The run limit (D3)

Proposed `rate-limit.ts:learnRunGate`, the `freshRunGate` pattern:
- **Per Repertoire: 3 runs an hour**, counted from `learn_runs` (`started_at > now() − 1 h`), so it holds across server instances. Runs that ended before the model (`qloo_unavailable`, `no_match`) are not counted.
- **Per IP: 6 runs an hour**, `learnIpLimiter = createRateLimiter(6, 60 * 60_000)`, per instance like the other limiters.
- **Free:** replays and joining an in-flight run never count. Offline test mode is never limited (the e2e tests share one IP), as in `freshRunGate`.
- **Test fault:** `faults=learn-limit` (proposed `request.ts:LEARN_LIMIT_FAULT`, the `FRESH_LIMIT_FAULT` gate: only with `BUSKMAP_ALLOW_FAULTS=1`, never in production) forces a refusal with `retryAfterS = 2700` (`FORCED_LIMIT_RETRY_S`).
- **Refusal:** HTTP 429 with `Retry-After` and `Cache-Control: no-store`, body `{ error: { code: "limit", message, retryAt, retryAfterS, limit: { scope, max, windowMinutes, retryInMinutes, resetAt } } }`. `scope` says which limit was hit:
  - `"repertoire"` (max 3 an hour, counted from this Repertoire's stored runs): "You've started 3 runs this hour. Try again in about 40 minutes."
  - `"ip"` (max 6 an hour from one network): worded so it doesn't blame the performer, e.g. "A lot of runs have started from this network in the last hour. Try again in about 25 minutes."

  When both limits are hit, `scope` is the one that resets later. `resetAt` (ISO) equals `retryAt`; it's kept for BRAND's naming. Messages stay relative (the B-013 rule).
- A WAF rule on `^/api/playlist/learn$` (`docs/deploy.md`), higher than 6, as for `/api/plan`.

### 2.11 When Qloo or the catalogues return nothing

| Situation | What happens | `end` |
|---|---|---|
| Qloo down at `match_playlist` | No model call, run `failed`, not counted against the limit | `ok: false, code: "qloo_unavailable"` |
| No seed artist matches on Qloo | No model call. The feed shows "Qloo couldn't match …" | `ok: false, code: "no_match"` |
| Qloo fails mid-run | The tool returns an error the model sees; it carries on with what it has, or the fallback ranks what was found | `ok: true, mode: "fallback"` if picks were made |
| Spotify and Last.fm have nothing for an artist | The artist is dropped from that `top_tracks` result. Artist-only suggestions are never offered | – |
| Every song found was already in the history | Nothing saved. "No new songs this time: everything we found was suggested before." | `ok: true, newCount: 0, code: "nothing_new"` |

(Changed from the 16 Oct draft: the Last.fm similar-artists fallback is dropped. Qloo is the brain, BRAND's sketch says "Suggestions need Qloo's taste data", and it removes a code path.)

## 3. The planners

### 3.1 How /plan and /week read the Repertoire

- **The landing performer form** (`components/landing/performer-form.tsx:PerformerForm`) is where both planners start. Submitting goes to Plan (`openPlan` → `POST /api/plans`) or to `/week?…` (`submit`).
- When the server finds a Repertoire cookie, `src/app/page.tsx:OwnActForm` passes the Repertoire to the form as its prefill. The form already takes a `prefill` of a performer: today it comes from `?again=<plan id>`, and the Repertoire would be a second source, with `?again` still winning.
  - A default **"Use my Repertoire (N songs)"** switch is on. Name, sounds-like and songs (can sing + learned) are filled from the Repertoire.
  - **"Edit for this busk only":** any change to songs or artists while it is on turns the badge into "Edited for this busk". The saved Repertoire is **not** changed.
    - An explicit **"Save these changes to my Repertoire"** button (`PATCH /api/playlist`) is the only way the form writes.
    - With no Repertoire yet, the same button reads **"Save as my Repertoire"** and creates it.
- **The request stays what it is today:**
  - The form submits a full `PlanRequest` (`plan-schema.ts:planRequestSchema`) or `WeekRequest` (`week-schema.ts:weekRequestSchema`) with `performer.songs` copied from the Repertoire.
  - `/api/plans`, `/api/plan`, `/api/week` and the URL helpers (`plan-url.ts:planSearchParams`, `week-url.ts:weekSearchParams`) need **no change**.
  - The only optional addition is `performer.songsFrom: "playlist" | "edited"`, for the badge on the plan. It is `.optional()`, so old links still parse.
- **The week planner:** `week.ts:buildWeekPlan` does not score songs today. It gets them from the same form. Its per-session "Plan this busk" links (`week-view.tsx`, via `planSearchParams`) already carry `performer.songs`, so they carry the Repertoire snapshot.
- **The Repertoire page (`/playlist`, proposed)** edits the three sections. Its song search reuses `components/landing/song-search.tsx`, the artist picker reuses `artist-picker.tsx`, and both use `/api/repertoire`. The To learn section holds the learn runs (§7).

### 3.2 Snapshot, not reference (recommended)

- `plans.request` already stores the request "as the act typed it", songs included (`003_plans.sql`, `plans/store.ts` header). A short link is therefore a **snapshot** today. Keep it that way.
  - `/p/<id>` keeps showing the songs it was planned with after the Repertoire changes.
  - The link is safe to share: it holds no Repertoire id or cookie.
  - `requestHash` dedupe (`plans/store.ts:requestHash`) still works: same songs, same day, same id.
- A reference (a Repertoire id in the request) would make shared links change under the viewer, leak a handle to someone's Repertoire, and break when the Repertoire is forgotten. Not recommended.

### 3.3 Learn these → the Repertoire

- The plan keeps its per-crowd **Learn these** (`context.ts:PlanContext.learn` → `setlist.ts:learnThese`, shown from `plan.learnThese`). It answers "what suits *this* crowd", and the busk agent's `learn_these` tool is unchanged.
- Each item with a title gets **"Add to Repertoire"**. It sends `POST /api/playlist/learn/suggestions` with `{title, artist, reason, evidence: {artistFrom: "plan", growth}}`, which inserts a `learn_suggestions` row with `run_id NULL` and `song_source='plan'`, status `pending`.
  - No Repertoire yet → the first add creates one and sets the cookie.
  - Already in the Repertoire or the history (any state) → "In your Repertoire". The unique index answers it.
- These rows are part of the history, so a learn run never suggests them again. The list shows them under "Added from plans".

### 3.4 The suggested set per pitch keeps working

- `setlist.ts:buildSetlist` is **unchanged in behaviour**:
  - 48% affinity, 32% popularity, 20% era fit;
  - the opener rule;
  - no artist twice in a row.
- It is fed by `context.ts:PlanContext.repertoire` from `request.performer.songs`, which now come from the Repertoire's can-sing and learned songs (§3.1).
- `tests/unit/scoring/setlist.test.ts` stays green untouched.
- **Optional saving (proposed, S5):** `qloo_artist_id` from the Repertoire could seed `repertoire()` and skip the `songArtists` `/search` calls. That needs a request field and changes `requestHash`, so it is deferred.

### 3.5 The examples stay input-only

- The presets (`lib/examples.ts:EXAMPLES`, `/plan?example=…`) never read or write a Repertoire.
  - The "Use my Repertoire" switch is not shown on example runs.
  - "Add to Repertoire" is hidden when `exampleId` is set.
- `/api/warm` and the examples' plan-store replay keep working as now.
- An e2e checks that an example run leaves the Repertoire unchanged (§5).

### 3.6 Routes (proposed)

All of these are route handlers, like the existing `/api/*`. The mutating ones get the Origin check and BotID (§1.1).

| Route | Does |
|---|---|
| `GET /api/playlist` | The current Repertoire, or `null`. Never creates one |
| `POST /api/playlist` | Create, sets the cookie (limit: 10 an hour per IP) |
| `PATCH /api/playlist` | Act name, sounds like, usual pitches. Needs `revision` (409 if it is stale) |
| `POST /api/playlist/songs` | Add a can-sing song (from search or typed) |
| `DELETE /api/playlist/songs/[id]` | Remove a song |
| `GET /api/playlist/learn` | The To learn list: runs, suggestions, the limit state and any running run (§7.3) |
| `POST /api/playlist/learn` | **Start a learn run** (the §2.10 gate). NDJSON stream (§7.2) |
| `GET /api/playlist/learn/runs/[runId]/events` | Join an in-flight run, or replay a finished one (§2.7). NDJSON |
| `POST /api/playlist/learn/suggestions` | Add a song from a plan's Learn these (§3.3) |
| `PATCH /api/playlist/learn/suggestions/[id]` | `{status: "learned" \| "pending" \| "dismissed"}`: a transition from §1.3. Anything else is a 400 |
| `DELETE /api/playlist` | Forget: deletes the Repertoire and clears the cookie |

**The stores:**
- `src/server/playlist/store.ts` and `src/server/learn/store.ts` (proposed): `Memory…` offline and `Postgres…` with `DATABASE_URL`, chosen like `plans/store.ts:shortPlanStore` (Neon HTTP driver, `processMap`).
- Without a database outside tests, the Repertoire routes return 503 "Saving isn't available", and the form keeps working without a Repertoire.

## 4. Renames

### 4.1 One module for user-facing words

Proposed `src/lib/playlist-copy.ts`, client-safe:

```
PLAYLIST_COPY = { name: "Repertoire", canSing: "Songs you can sing", toLearn: "Songs to learn",
  learned: "Learned", suggestedSet: "Suggested set", addTo: "Add to Repertoire", useMine: "Use my Repertoire",
  findToLearn: "Find songs to learn", findMore: "Find more songs to learn", newThisRun: "New this run", … }
```

- Every component and page string about the feature reads from it, and so do the `TOOL_LABELS` and the proposed `LEARN_TOOL_LABELS` display labels.
- **Code identifiers stay neutral and stable:** tables `playlists`, `learn_runs`, `learn_suggestions`, routes `/api/playlist`, `src/server/playlist/`, `src/server/learn/`.
- A later rename to "Songbook":
  - edit this one file;
  - optionally move the page route, with a redirect from `/playlist`;
  - update the docs.
- No schema change, no migration.

### 4.2 What changes, and what doesn't

| Where | Today | Proposal |
|---|---|---|
| UI copy | "Setlist", "Learn these" (`setlist-panel.tsx`, `plan-view.tsx`, `crowd-panel.tsx`, `week-view.tsx`, `app/page.tsx`) | "Suggested set" per pitch. "Songs to learn" on the plan, "To learn" in the Repertoire. All of it from `PLAYLIST_COPY` |
| Plan schema (`plan-schema.ts:planPitchSchema.setlist`, `planSchema.learnThese`) | Stored in Neon (`plans.plan`, `plan_store`) and on short links | **Keep the wire names.** Renaming them breaks the parsing of stored plans. Add TypeScript aliases only: `type SuggestedSet = PlanPitch["setlist"]`. If a rename is wanted later: accept both keys with `z.preprocess` (`setlist` → `suggestedSet`) for 7 days, then drop the old one |
| Plan stream (`plan-schema.ts:planStreamEventSchema`) | | **Unchanged on the wire.** Its member schemas are exported by name for the learn stream (§2.7) |
| Agent tools (`tools.ts:createTools`: `build_setlist`, `learn_these`) | The design contract fixes `build_setlist` `songs[]` (`dev-brief-agent-v2.md`) | **Keep the tool names and output fields.** Change only the display labels (`TOOL_LABELS.build_setlist` → "Suggested set for a pitch", `learn_these` → "Songs to learn"), and tell BRAND[busk-map] in the same round, as the contract asks |
| Scoring (`setlist.ts:buildSetlist`, `SetlistEntry`, `learnThese`) | | Keep. `learnThese`'s ranking is reused by the learn fallback (§2.6) |
| Plain-AI baseline (`baselineViewSchema.setlist`, `compare.ts`) | | Keep (wire field). Copy only |
| `researchTotals.songs` | | Keep |
| Design system (Honeycomb) | | BRAND renames components after the Honeycomb round. DEV adds rows to `design-backlog.md` for the Repertoire page, the "Use my Repertoire" switch, Add to Repertoire, and the learn run pieces in BRAND's sketch §6 |

### 4.3 The Brain page (`src/lib/qloo-map.ts`) and its drift test

| Change in `qloo-map.ts` | Detail |
|---|---|
| New call **`c12`** | `num: "12"`, "Artists like your Repertoire", `/v2/insights`, `urn:entity:artist`, `keyParams: ["signal.interests.entities=<Repertoire ids>", "feature.explainability=true", "take=20"]`, `codeRef: "client.ts:tasteArtists"`, `via: ["learn/tools.ts:related_artists"]` |
| New variant **`c5c`** | `variantOf: "c5"`, "Crowd at your usual pitches", `codeRef: "client.ts:localArtists"`, `via: ["learn/tools.ts:crowd_at"]` |
| `c1`, `c2`, `c8`, `c9` | Add `via` entries for `learn/tools.ts` (`match_playlist`, `rising`, `crowd_profile`) |
| New data points | `d_taste_artists` ("artists your Repertoire's fans like", from c12 and c5c), `d_tracks` ("songs by those artists", from Spotify, with Last.fm as backup) |
| Features | `f_setlist` is relabelled "Suggested set" (the id is kept, so the test traces stay valid). A new **`f_learn`** "Songs to learn", in the Repertoire page's To learn section, `combined` with Spotify, Last.fm and **Claude Sonnet (the learn agent)** |
| Secondary sources (D6) | Add `lastfm`: songs backup |
| Facts | A new `CALLS_PER_LEARN_RUN = "≤ 25"`. `CALLS_PER_NEW_BUSK` is unchanged |

**What the drift test (`tests/unit/lib/qloo-map.test.ts`) then expects:**
- `callKinds` 11 → **12**.
- Variants `["c5b"]` → `["c5b","c5c"]`.
- `featureCount` 9 → **10**.
- Data points 15 → **17**.
- Secondary sources `["Spotify","Ticketmaster"]` → `["Spotify","Ticketmaster","Last.fm"]` (if D6).
- `facts` → `["12", "24–33", "0", "25"]`.
- The c3 trace is unchanged.

The "names exactly the client functions that send a Qloo request" check fails by design as soon as `tasteArtists` lands without its map entry. That check is the guard.

`docs/qloo-data-map.md` gets row 12 and row 5c, a §4 "Per learn run" budget table (§2.9), and a §6 note for the Last.fm songs backup.

## 5. Tests

**Unit (DEV, Vitest):**

| File (proposed) | Covers |
|---|---|
| `tests/unit/server/playlist-store.test.ts` | Both stores share one contract suite (as `stored-plans.test.ts` does): the token is stored only as its hash, the cookie value is never logged, `song_key` dedupe, the cascade on forget, `revision` gives a 409, the 61st can-sing song is refused |
| `tests/unit/server/learn-store.test.ts` | Both learn stores: run numbering, **one running run per Repertoire** (the second insert fails), the **unique `(playlist_id, song_key)`** refuses a repeat, mark learned inserts the `playlist_songs` row and undo removes it, dismiss and undo, the pending cap (`list_full`), step pruning keeps the last 5 runs and drops steps older than 30 days but keeps their suggestions, the 400-row cap moves keys into `dismissed_keys`, the stale-run sweep |
| `tests/unit/learn/guardrails.test.ts` | `checkPicks`: an id not from this run's `top_tracks` → rejected with the valid list; a song already in history (each status), in `dismissed_keys` or in can sing → rejected; a duplicate pick; a third song by one artist; an over-represented artist; a stray number; a `buildsOn` that isn't learned → dropped. After 2 rejections: number-only problems get the template reason, rule breaks are dropped, too few left → fallback. Title, artist and year always come from the record |
| `tests/unit/learn/gating.test.ts` | `top_tracks` closed until 1 `related_artists` + 1 `crowd_at` or `rising`, with the message; `finish_suggestions` closed until songs are found; wrap-up at `maxSteps − 2` and at 60% / 75% of the token budget; `finish_suggestions` while wrapping up with no songs runs `top_tracks` server-side; per-tool call caps; zod rejects bad inputs (an unknown seed, an artist id not seen, `take` out of range) |
| `tests/unit/learn/history.test.ts` | `formatHistory`: grouping by artist, the order of groups, most recent first, the 1,500-token budget with each truncation step in order, "and N more" lines, newlines and `|` stripped from titles; **no-repeat holds on the full history** even when the block is truncated (a song only in the truncated tail is still filtered by `top_tracks`) |
| `tests/unit/learn/new-this-run.test.ts` | `isNew` true only for rows the run inserted and, in the list, only for the latest finished run; `basedOn` kinds from `because` and `buildsOn` |
| `tests/unit/learn/fallback.test.ts` | The deterministic order, 2 per artist, template reasons with only known numbers, `nothing_new` when everything is in history |
| `tests/unit/lib/learn-totals.test.ts` | Each learn totals field from tool outputs; failed tools count 0; `newSongs` is 0 until accepted |
| `tests/unit/lib/learn-schema.test.ts` | Every event in §7.2 parses; `planStreamEventSchema` still parses every stored plan run fixture (no wire change) |
| `tests/unit/server/learn-run-limit.test.ts` | `learnRunGate`: the 4th run in an hour per Repertoire is refused (counted from stored runs, so a second instance sees it), the 7th per IP; replays, joins and offline are free; runs that ended before the model aren't counted; `forced` refuses; the 429 body and relative message |
| `tests/unit/agent/qloo-usage.test.ts` (extend) | **The budget:** with the emulated data cache, a cold run makes ≤ 25 Qloo requests, a typical one ≤ 10; the pre-check skips a tool whose worst case would cross 25, and the model sees the "budget used up" output |
| `tests/unit/lib/plan-url.test.ts` (extend) | `songsFrom` round-trips, and old URLs still parse |
| `tests/unit/lib/qloo-map.test.ts` | The new expectations in §4.3 |

**Mock-model e2e (DEV, `tests/e2e/playlist.spec.ts` and `tests/e2e/learn-run.spec.ts`, offline only, `createMockLearner`).**

Repertoire flow:
1. Type songs on the landing page, then "Save as my Repertoire".
2. Reload: the form is prefilled and "Use my Repertoire" is on.
3. Plan with it, which opens `/p/<id>`. "Add to Repertoire" on a Learn these song: it is under To learn, "Added from plans".
4. Start the week planner: the week request includes the Repertoire's songs.

Learn run flow:
1. On `/playlist`, press "Find songs to learn". The stream starts with `run` (number 1); the feed shows `match_playlist`, `history`, the model tools' steps and the funnel counting up, then `suggestion` events and `end` (`ok: true`). The new cards show "New this run".
2. Reload: the run is listed (Run 1, date, "test model", counts, done) and its suggestions are stored.
3. Mark one learned: it moves to Songs you can sing, and a plan request now carries it. Dismiss another.
4. Run again. The prompt the mock receives (recorded by the mock) lists run 1's items under Learned, To learn and Dismissed. The `history` step says what was left out, `totals.alreadySuggested` and `dismissedSkipped` are above 0, no run-1 song appears again, the new cards carry "New this run" and run 1's no longer do, and one card shows "Builds on <the learned song>".
5. Open run 1's replay: the same steps, labelled as a replay, no new model call (the mock's call count is unchanged).
6. Mock scenarios: `repeat` (the mock picks an old song first) → one rejection, then accepted; `never-finish` → `mode: "fallback"`; `fail` → fallback with the "AI was unavailable" message.

Plus:
- "Edit for this busk only" leaves the saved Repertoire unchanged.
- An example run leaves the Repertoire unchanged.
- The old `/p/<id>` still shows its original songs after the Repertoire changes (the snapshot).

**The cost guard:**
- The e2e offline guard exists and covers the new specs as-is (`tests/e2e/guard.ts:decideGuard`, `global-setup.ts`): no live model or Qloo call can happen in e2e.
- New: `faults=learn-limit` gives the limit state with the relative message, in `tests/e2e/fresh-limit.spec.ts` or a sibling spec.
- Offline, the run limit never applies, so the shared e2e IP isn't throttled.
- The only live spend is the S3 model check (3 Sonnet runs, about US$0.40), logged in `dev-log.md`.

**QA's paths (read-only for DEV):**
- `tests/e2e/qa/` (`a11y`, `layout`, `rate-limit`, `brain`, `baseline`) belongs to QA.
- Propose via MANAGER that QA extends:
  - `qa/rate-limit.spec.ts` with the learn run limit;
  - `qa/a11y.spec.ts` and `qa/layout.spec.ts` with `/playlist` (idle, running, done, limit) at 3 widths;
  - `qa/brain.spec.ts` with c12, c5c and f_learn.
- DEV doesn't edit `tests/e2e/qa/*`.
- Stage commits are announced, because the checkout is shared.

## 6. Effort, stages, risks

**Order (user's direction, 17 Oct):** two tracks run in parallel. Track A, the Honeycomb look in `../busk-map-honeycomb` (`design/honeycomb`), comes first and is not counted here. Track B, Repertoire, is built on `dev/core` alongside it, once this proposal is approved, and is not blocked by Track A. It is plain shadcn logic and UI only, so merging Honeycomb into `dev/core` stays a clean "look over features" merge; the only expected conflicts are where Repertoire renames Setlist labels, and they are resolved in favour of both. BRAND's Repertoire screens (DS v64+, `design-handoff/playlist/`, plus the learn-run iteration in `learn-run-sketch.md` §6) are applied afterwards as a brand sync, tagged `brandv1.<iteration>.0`. Until then DEV adds rows to `design-backlog.md`.

| Stage | Contents | Hours (was) |
|---|---|---|
| S1 Storage and API | `004_playlists.sql`, the Memory and Postgres Repertoire stores, the cookie, the Repertoire routes, the limits, forget, unit tests | 6 (6) |
| S2 Planners read the Repertoire | Form prefill, "Use my Repertoire", edit for this busk only, save to Repertoire, a basic `/playlist` page, Add to Repertoire on Learn these, the week flow | 6 (6) |
| **S3 The learn agent** | `005_learn_runs.sql` and the learn stores; `client.ts:tasteArtists`, `searchArtistTracks`; the 5 model tools and 2 server steps with zod, gating and call caps; `runLearnAgent` with `LEARN_INSTRUCTIONS`, wrap-up and the Qloo budget; `finish_suggestions` guardrails, rejection loop and fallback; history loading, formatting and truncation; `learn-schema.ts`, `learn-totals.ts`; the stream route, join and replay, the list and suggestion routes; `learnRunGate` and `faults=learn-limit`; `createMockLearner`; unit tests; the 3-run live check | **14** (8) |
| S4 Brain and naming | `playlist-copy.ts`, label renames, `qloo-map.ts` and the drift test, `docs/qloo-data-map.md`, a note to BRAND | 3 (3) |
| S5 Polish and tests | The two e2e flows, the limit fault spec, the learn UI states in plain shadcn (§7.4), the QA handoff, the expiry and pruning sweeps | **5** (4) |
| **Total** | | **34 h** (was 27 h; **+7 h**), about 4.5 working days |

**Risks:**

| Risk | Mitigation |
|---|---|
| The Qloo quota (10k a month) is shared with plans | A 25-request cap per run with a worst-case pre-check, explicit runs only (never on page view), 3 per Repertoire and 6 per IP an hour. `qlooCalls` is shown in the totals and logged per run |
| **New: model cost per run** (US$0.075–0.14 on Sonnet) | The run limit, BotID on the route, replays free, the gateway's US$50 budget. Haiku is a one-line switch (D7) |
| **New: the model repeats or invents songs** | Repeats are filtered before the model sees them (`top_tracks`), checked again in `checkPicks`, and refused by the unique index. Songs come only from `state.found`, by id, with record-sourced fields |
| **New: a weak or rejected answer on stage** | Two rejections, then the deterministic fallback, labelled. The offline mock gives a reliable rehearsal, labelled as the test model |
| **New: latency (25–40 s)** | Steps stream from the first second (`run` is sent before any lookup). The run carries on if the viewer leaves, and the list fills when it finishes |
| **New: history grows past the prompt budget** | The 1,500-token block with fixed truncation, while no-repeat is enforced on the full history server-side |
| **New: stored steps hold Qloo data** | Steps kept for 5 runs and 30 days (D8); suggestions keep derived numbers only. Nothing is committed |
| **New: a crashed instance leaves a run `running`** | The stale-run sweep marks it `failed` after `timeoutMs + 30 s`, freeing the partial unique index |
| **New: `crowd_at` is a tool name in both agents** | Labels and result cards are looked up per stream kind (plan or learn), never by tool name alone (§7.1) |
| **New: token estimates are not measured yet** | The S3 live check records real numbers before the demo; the token budget (120k) and timeout bound the worst case |
| Weak ranking signals live: `audience_growth` is 0, and trending is stale and flat (data map §5) | Growth is sent as `null` when Qloo returns 0, and the agent and the fallback rank by affinity and the taste∩pitch bonus. Say so in a note, as plans already do (`context.ts:PlanContext.rising`) |
| Spotify artist search picks a namesake | Filter by `nameKey`, prefer the Spotify id when the artist was picked in the form (`sounds_like[].spotifyId`), and fall back to Last.fm |
| A cookie lost on a cleared browser means a lost Repertoire and history | Say so on the page. Accounts (§1.6) are the cure. Optional later: export and import as a file |
| A migration on prod Neon | Both are idempotent and only add tables and columns. `npm run db:migrate:dev` runs on the dev branch first |
| Design not ready | Screens are built plain behind design-backlog rows. The contract (§7 and `dev-brief-agent-v2.md`) is fixed before UI work |
| The checkout is shared with QA | Commits by path only, per stage. No edits to `tests/e2e/qa/` |
| The rename comes late | One copy module (§4.1). Code names are neutral |

**Decisions:** D1–D9 in §0. The ones that block are **D1 (storage)** before S1, and **D3 (run limit), D7 (model), D8 (retention) and D9 (re-suggest)** before S3. D2 can come any time.

## 7. UI contract for BRAND

Agreed against BRAND's `learn-run-sketch.md` §5 (17 Oct). BRAND's tool names and event names are adopted where they fit. Any rename or shape change here goes to BRAND[busk-map] in the same round, as the agent-v2 design contract asks. Tool names and raw JSON stay behind the page-level "Show raw data" switch.

### 7.1 The run view reuses the plan's step stream

- The learn stream reuses the plan stream's `status`, `note`, `tool-start`, `tool-end` and `usage` events **field for field**, so the step stream (in code: `components/plan/agent-steps.tsx:AgentSteps`, folded by `lib/agent-steps.ts:applyStreamEvent`) works unchanged. `run`, `totals` (learn fields), `suggestion` and `end` are learn-only; the step reducer ignores them and the learn view handles them.
- Two changes the step view needs: the "rejected" badge must also apply to `finish_suggestions` (today it checks `finish_plan` only), and **result cards and labels are looked up by stream kind and tool**, because `crowd_at` exists in both agents with different outputs.
- **Tools, in the order they usually appear**, each needing a plain result card. `match_playlist` and `history` are run by the server (no model step) but stream like any other step.

| Tool | Label (`LEARN_TOOL_LABELS`) | Output fields the card reads | Example card line |
|---|---|---|---|
| `match_playlist` | "Matching your songs on Qloo" | `songs`, `artists[].name`, `artists[].matched`, `unmatched[]` | "Matched your 9 songs to 6 artists on Qloo" |
| `history` | "Reading your earlier runs" | `canSing`, `pending`, `learned`, `dismissed`, `earlierRuns`, `lastRunAt` | "3 earlier runs: 2 learned, 5 to learn, 4 dismissed" |
| `crowd_at` | "Who the crowd likes at your pitch" | `pitch`, `artists[].name`, `artists[].affinity`, `artists[].because[]` | "Read the crowd at Bourke St Mall" |
| `related_artists` | "Artists your fans also like" | `artists[].name`, `artists[].affinity`, `artists[].because[]`, `artists[].alreadyInPlaylist` | "Found 14 artists your fans also like" |
| `rising` | "Who's rising with those crowds" | `window` (or null), `artists[].name`, `artists[].growth`, `artists[].trendDelta` | "Checked who's rising with those crowds" |
| `crowd_profile` (optional) | "The age of your fans" | `ageLean`, `bands` | "Your fans lean 25–34" |
| `top_tracks` | "Top songs by those artists" | `songs[].title`, `songs[].artist`, `songs[].source`, `skipped.alreadySuggested`, `skipped.dismissed`, `skipped.canSing` | "Picked top tracks on Spotify (Last.fm for 1). Left out 5 songs suggested before and 2 you dismissed" |
| `finish_suggestions` | "Choosing and explaining" | `accepted`, `summary`, `problems[]` (when rejected) | "Ranked 6 songs and wrote why" / "Rejected: … (fixing)" |

### 7.2 The stream: `POST /api/playlist/learn` (NDJSON) and `GET /api/playlist/learn/runs/<runId>/events` (join or replay)

Order: `run` → `status` → steps (`note`, `tool-start`, `tool-end`, and `totals` after each `tool-end`) → `suggestion` × n → `totals` (final) → `usage` → `end`. Every stream ends with exactly one `end`. There is no `plan` and no `error` event in the learn stream.

| Event | Fields |
|---|---|
| `run` (first) | `runId` (string), `number` (int, "Run 3"), `startedAt` (ISO), `model` (`"claude"` \| `"mock"`), `inputs` {`songs` (int: can-sing + learned count), `soundsLike` (string[]), `pitches` (string[]: usual pitch names, or `[]` for the city crowd)}, `replay` (bool), `stepsKept` (bool; false on a pruned replay, which then has no steps) |
| `status` | as the plan: `message`, `replay?` |
| `note` | as the plan: `kind` (`reasoning` \| `text`), `text` |
| `tool-start` / `tool-end` | as the plan: `id`, `tool`, `label`, `source`, `input` / `id`, `tool`, `ok`, `summary`, `output` |
| `totals` | `artists`, `crowds`, `liked`, `songsChecked`, `alreadySuggested`, `dismissedSkipped`, `alreadyKnown`, `newSongs`, `qlooCalls`, `qlooCacheHits` (all integers ≥ 0; `newSongs` stays 0 until the picks are accepted) |
| `suggestion` (one per saved song, after acceptance) | `runId`, `id` (string), `rank` (int), `title`, `artist`, `year` (int \| null), `durationMs` (int \| null), `image` (URL \| null), `songSource` (`spotify` \| `lastfm`), `sourceUrl` (URL \| null), `reason` (string: the why line), `because` (string \| null: plain words from Qloo explainability, e.g. "Fans of Dolly Parton and Gillian Welch like them"), `basedOn` [{`kind`: `learned` \| `repertoire` \| `crowd` \| `soundsLike`, `name`}], `growth` (number \| null), `trendDelta` (number \| null), `isNew` (bool), `status` (`pending` on a live run; the current status on a replay) |
| `usage` | as the plan: `steps`, `inputTokens`, `outputTokens`, `reasoningTokens`, `ms`, `stoppedBy` (raw view only) |
| `end` (last) | `ok` (bool), `runId`, `mode` (`agent` \| `fallback` \| `mock` \| `none`), `newCount` (int), `skippedCount` (int: alreadySuggested + dismissedSkipped + alreadyKnown), `code` (null \| `timeout` \| `stopped` \| `model_unavailable` \| `qloo_unavailable` \| `no_match` \| `nothing_new`), `message` (plain words for the status line) |

Field notes (what the server can really know):
- `because`: from Qloo explainability on the artist's `related_artists` or `crowd_at` result. Every suggested artist comes from one of those, but explainability can be empty for a result, so it is nullable.
- `year`, `durationMs`, `image`: Spotify only. A Last.fm song has `null` for all three; its `sourceUrl` is the Last.fm track page.
- `growth`: Qloo `audience_growth`. Live Qloo returns 0 for every artist checked (data map §5), so the server sends `null` when it is 0 or missing, and the card hides it. `trendDelta` is from `rising`, in **percentile points**: the change in the artist's Qloo population percentile (0–100) between the oldest and newest week of the trending window, positive is rising. It is never the week-over-week `population_percent_delta` (a percent, a different unit). `null` when the artist wasn't checked, the trend is flat or the window has one week only.
- `isNew`: computed by the server. On a live run every `suggestion` is new (D9 forbids repeats), so it is `true`; on a replay or in the list it is true only for the latest finished run.
- `code` with `ok: true`: `timeout`, `stopped` (step or token cap) or `model_unavailable` together with `mode: "fallback"` means the picks came from the data, not the model; `nothing_new` with `newCount: 0` means everything found was already in the history. `mode: "none"` goes with `ok: false` (nothing was picked).
- `suggestion` events are **final, not provisional**: they are sent only after `finish_suggestions` is accepted (or the fallback ranked) and the rows are saved, in rank order, right before the final `totals`. A card never appears and then disappears. The client may drop them in one by one.

**Refusals before a run starts** are plain JSON errors, not a stream (the plan route's B-013 pattern), with `Cache-Control: no-store`. Body: `{ error: { code, message, …extra } }`.

| HTTP | `error.code` | Extra fields | LearnRunBar state |
|---|---|---|---|
| 429 (with `Retry-After`) | `limit` | `retryAt`, `retryAfterS`, `limit` {`scope`: `repertoire` \| `ip`, `max`, `windowMinutes`, `retryInMinutes`, `resetAt`} | limit reached (the copy depends on `scope`: the Repertoire's own 3 an hour, or the network's 6 an hour, worded not to blame the performer) |
| 409 | `empty_playlist` | `minSongs` (3) | empty Repertoire |
| 409 | `already_running` | `runId` | running (the client joins `…/runs/<runId>/events`) |
| 409 | `list_full` | `pending`, `max` (40) | list full |
| 404 | `no_playlist` | – | idle, first time (save the Repertoire first) |
| 503 | `unavailable` | – | error |

### 7.3 The Learn list: `GET /api/playlist/learn`

```
{
  running: { runId, number, startedAt } | null,
  limit: { max: 3, windowMinutes: 60, remaining, retryInMinutes | null },
  runs: [{ runId, number, startedAt, finishedAt, status: "running"|"done"|"fallback"|"failed",
           model: "claude"|"mock"|"template", inputs: { songs, soundsLike, pitches },
           newCount, skippedCount, stepsKept }],            // newest first
  suggestions: [{ id, runId | null, runNumber | null, rank, title, artist, year, durationMs, image,
                  songSource: "spotify"|"lastfm"|"plan", sourceUrl, reason, because, basedOn,
                  growth, trendDelta, isNew,
                  status: "pending"|"learned"|"dismissed",
                  suggestedAt, learnedAt | null, dismissedAt | null }]
}
```

- **Run history list (LearnRunGroup header):** `number`, `startedAt` (date and time), `model` (shown as "Claude", "test model" or "from the data"), `inputs` ("looked at 9 songs, 3 pitches"), `newCount`, `status`. Suggestions with `runId: null` are grouped as "Added from plans" (or "Earlier runs" once their run row was capped).
- **Suggestion card (LearnSongCard):** `title`, `artist`, `reason`, evidence chips from `because`, `basedOn` (a `learned` entry is the "Builds on …" line), `growth` and `trendDelta` (hidden when null), `year`, `image`, the source, `status`, the "New this run" badge from `isNew`, the run it came from (`runNumber`), plus the existing Learn it links (`lib/learn-links.ts:learnLinks`).
- **Actions:** `PATCH /api/playlist/learn/suggestions/<id>` with `{status}`:
  - **Learned** (`pending → learned`): moves into Songs you can sing; the response includes the new `playlist_songs` row for the toast.
  - **Not for me** (`pending → dismissed`).
  - **Undo** (`learned → pending`, `dismissed → pending`).
  - There is no separate "add" action: every suggestion lands in To learn as `pending`.

### 7.4 States

| State | When | Data |
|---|---|---|
| idle, first time | `runs` is empty | `limit.remaining` |
| idle, after runs | `runs[0]` finished | the last run's `startedAt`, `newCount` |
| running | `running` is set, or a live stream | the step stream, `totals` |
| done | `end.ok`, `mode: "agent"` (or `"mock"`, with the test-model wording) | `newCount`, new cards with `isNew` |
| fallback | `end.ok`, `mode: "fallback"` | `end.message`, `end.code` |
| nothing new | `end.ok`, `newCount: 0`, `code: "nothing_new"` | `skippedCount` |
| limit | 429 `limit` | `limit.scope` (`repertoire` \| `ip`), `limit.retryInMinutes`, `message` |
| Qloo down | `end.ok: false`, `code: "qloo_unavailable"` (or `no_match`) | `message` |
| error | `end.ok: false` with any other code, a 503, or a broken stream | `message` |
| empty Repertoire | 409 `empty_playlist`, or fewer than 3 songs you can sing on the page | `minSongs` |
| empty history | `runs` empty and no `suggestions` | the first-time copy |
| list full | 409 `list_full` | `pending`, `max` |

### 7.5 Differences from BRAND's sketch

1. **`match_playlist` and `history` are server steps, not model tools.** They stream as normal steps, so the cards are the same, but the model never calls them: both are deterministic, and the history must always be in the context (it goes into the prompt). It saves two model steps per run.
2. **`crowd_profile` is added** (optional, Qloo demographics, for era fit). It needs one plain card. The model may skip it.
3. **No `error` event and no `plan` event:** the learn stream always ends with `end`. The plan stream has no `end` today and still ends with `plan` or `error`; the learn stream is a new route, so this is safe.
4. **The limit and the other pre-run refusals are HTTP errors, not an `end` event** (`limit`, `empty_playlist`, `already_running`, `list_full`, `no_playlist`). No run starts, so there is no stream: this matches the plan route (B-013). The 429 body carries BRAND's `limit` {`max`, `windowMinutes`, `retryInMinutes`}, plus `scope` (`repertoire` | `ip`) and `resetAt`, so the UI can show BRAND's two different messages. So `end.code` does not include `limit` or `empty_playlist`.
5. **`end` gains `runId`, `mode` and `message`**, and its `code` list adds `model_unavailable`, `no_match` and `nothing_new`. `code` is null on a clean run. `mode: "fallback"` is the "from the data alone" ending.
6. **`suggestion` gains `rank`, `reason`, `trendDelta` and `status`.** `reason` is the AI's why line, separate from Qloo's `because`. `trendDelta` carries the rising signal, because `growth` is usually null live.
7. **`because`, `year`, `durationMs`, `image`, `sourceUrl` and `growth` are nullable** (see the field notes): only Spotify has year, duration and art, explainability can be empty, and live `audience_growth` is 0.
8. **`suggestion` events are final, not "as it's decided":** sent after the guardrail accepts and the rows are saved, so a card never appears and is then withdrawn.
9. **`totals` adds `alreadyKnown` and `qlooCacheHits`.** `alreadyKnown` counts songs left out because you can already sing them, separate from `alreadySuggested`.
10. **`run` adds `model`, `replay` and `stepsKept`.** `inputs.songs` is a count, and `inputs.soundsLike` and `inputs.pitches` are name lists, for "looked at 9 songs, 3 pitches".
11. **The limit copy is per hour, not per day:** "You've started 3 runs this hour. Try again in about M minutes." The sketch's "N times today" doesn't match D3.
12. **Qloo down ends the run, with no Last.fm artist fallback**, as the sketch's copy says ("Suggestions need Qloo's taste data"). The 16 Oct draft's Last.fm similar-artists path is dropped.
13. **Stored per run, beyond BRAND's `number`, `startedAt`, `inputs` and `newCount`:** `status`, `model`, `finishedAt`, `skippedCount` and `stepsKept`. Stored per suggestion: BRAND's fields as proposed, plus the card fields above. A `runId: null` group, "Added from plans", holds songs added from a plan's Learn these.
