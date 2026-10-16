# Playlist: architecture proposal (for approval, no code yet)

Status: **proposal**, 16 Oct 2026, `dev/core`. Input: the user's draft spec (`hackathon/hackathons/qloo-2026/playlist-spec.md`). Nothing here is built. "Exists" means it is in the code today, with `file:function`. "Proposed" means new.

The feature is a saved **Playlist** with three parts:
- **Songs you can sing**: saved once, then used by Plan a busk and the week planner.
- **A suggested set per pitch**: today's setlist logic, unchanged.
- **Songs you should learn**: new. Qloo picks the artists, Spotify (or Last.fm as backup) picks the songs, and Claude ranks and explains them.

## 0. Decisions needed from you

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Storage (HQ card `playlist-storage`) | **A: a device Playlist in Neon behind an anonymous cookie** | It keeps the no-login rule, works on every browser including Safari, and moves into accounts later in one migration (§1.6) |
| D2 | Name | Keep **"Playlist"** for now. Every user-facing word lives in one module (§4.1), so "Songbook" costs one file later | You chose it. A rename stays cheap |
| D3 | Refresh limits | **3 refreshes an hour per Playlist and 6 an hour per IP. At most 25 Qloo requests per refresh** | §2.6 has the arithmetic: the worst case is about 2.5% of a month's quota per 10 refreshes |
| D4 | Usual pitches (the crowd input) | **Automatic:** the top pitch of each of the last 3 plans made with the Playlist. With none, the city crowd | No new UI to design. It reflects where you actually play |
| D5 | A "Not for me" button on suggestions | **Yes:** a `dismissed` state, never suggested again | Without it, a refresh brings back songs you rejected |
| D6 | Last.fm on the Brain page | **Show it as a third secondary source** | It is now a named backup (songs, similar artists). Today the Brain shows only Spotify and Ticketmaster (`qloo-map.ts:secondarySources`) |

## 1. Data model and migrations

### 1.1 Identity: an anonymous device cookie (recommended, D1 = A)

- **Cookie:** `buskmap_playlist`. The value is a random **128-bit token** (16 bytes from `crypto.getRandomValues`, base64url, 22 characters).
  - Flags: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=34560000` (400 days, Chrome's cap). The expiry slides forward on each write.
  - It is set only by the server, on the first save. Browsing never creates a Playlist.
- **Stored hashed:** the database keeps `sha256(token)` and never the token.
  - A leaked table can't be replayed as cookies.
  - A 128-bit random token needs no pepper or slow hash.
- **CSRF:** SameSite=Lax blocks cross-site POSTs. Every mutating route also checks that `Origin` matches the host, and joins `BOTID_PROTECTED_ROUTES` (`src/lib/botid-routes.ts`).
- **The id never leaves the server.** It is not in URLs, plan requests or short links. A shared `/p/<id>` link carries a snapshot of the songs, never a pointer to anyone's Playlist (§3.2).
- The tip log stays as it is: a separate, script-written cookie (`src/lib/tips.ts:TIP_COOKIE`).

### 1.2 Tables: migration `migrations/004_playlists.sql`

`004` is the next number after `003_plans.sql`. Like the others, it is idempotent (`CREATE … IF NOT EXISTS`), because `scripts/migrate.mjs` reapplies every file in order.

**`playlists`**

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Internal only |
| `token_hash` | `TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$')` | sha256 hex of the cookie token |
| `act_name` | `TEXT NULL CHECK (char_length(act_name) BETWEEN 1 AND 80)` | Optional. Planners default to "My act", as the landing form does today (`performer-form.tsx:submit`) |
| `sounds_like` | `JSONB NOT NULL DEFAULT '[]'` | `[{name, spotifyId?, qlooId?}]`, at most 10 (matches `planRequestSchema.performer.artists.max(10)`) |
| `usual_pitches` | `JSONB NOT NULL DEFAULT '[]'` | `[{name, lat, lon}]`, at most 3 (D4) |
| `city` | `TEXT NOT NULL DEFAULT 'melbourne'` | `CITY_IDS` |
| `revision` | `INTEGER NOT NULL DEFAULT 1` | Bumped on every write. Two tabs get a 409 instead of losing an edit |
| `suggest_input_hash` | `TEXT NULL` | Hash of the refresh inputs (§2.5) |
| `suggested_at` | `TIMESTAMPTZ NULL` | Last refresh |
| `created_at`, `updated_at`, `last_seen_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | `last_seen_at` drives expiry |

**`playlist_songs`**

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | |
| `playlist_id` | `UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE` | |
| `song_key` | `TEXT NOT NULL` | `lib/text.ts:trackKey(artist, title)`, the dedupe key the setlist already uses (`setlist.ts:buildSetlist`) |
| `state` | `TEXT NOT NULL CHECK (state IN ('can_sing','to_learn','learned','dismissed'))` | `dismissed` only if D5 = yes |
| `source` | `TEXT NOT NULL CHECK (source IN ('spotify','lastfm','typed','suggested'))` | |
| `title` | `TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120)` | Same bounds as `plan-schema.ts:repertoireSongSchema` |
| `artist` | `TEXT NOT NULL CHECK (char_length(artist) BETWEEN 1 AND 80)` | |
| `own` | `BOOLEAN NOT NULL DEFAULT false` | The act's own song, as in `repertoireSongSchema.own` |
| `spotify_track_id` | `TEXT NULL CHECK (spotify_track_id ~ '^[A-Za-z0-9]{22}$')` | |
| `qloo_artist_id` | `TEXT NULL` | Cached Qloo entity id of the artist, so refreshes skip `/search` |
| `year` | `SMALLINT NULL CHECK (year BETWEEN 1900 AND 2100)` | |
| `duration_ms` | `INTEGER NULL CHECK (duration_ms > 0 AND duration_ms <= 3600000)` | |
| `reason` | `TEXT NULL CHECK (char_length(reason) <= 280)` | Suggestions only: the "because" line |
| `evidence` | `JSONB NULL` | Suggestions only, §2.4 |
| `rank` | `SMALLINT NULL` | Suggestion order |
| `kept` | `BOOLEAN NOT NULL DEFAULT false` | A `to_learn` row the user added (from a plan, or by hand). A refresh never deletes it |
| `added_at`, `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `learned_at` | `TIMESTAMPTZ NULL` | Set on `to_learn → learned` |

**Indexes**
- `UNIQUE (playlist_id, song_key)`: one row per song, whatever its state.
- `(playlist_id, state)`: covers the planners' read and the page.
- `playlists (last_seen_at)`: for the expiry sweep.

### 1.3 States and transitions (proposed)

| From → to | Trigger | Notes |
|---|---|---|
| (none) → `can_sing` | Picked from Spotify search, loaded from "my Spotify artist" (`source=spotify`), typed (`typed`) | |
| (none) → `to_learn` | A refresh (`suggested`, `kept=false`), or "Add to Playlist" on a plan's Learn these (`suggested`, `kept=true`) | |
| `to_learn` → `learned` | "Mark learned" | `learned_at = now()`. Planners treat it as can sing |
| `learned` → `to_learn` | "Undo" | |
| `to_learn` → `dismissed` | "Not for me" (D5) | Hidden, and excluded from later refreshes |
| any → (deleted) | Remove | A `can_sing` or `learned` removal deletes the row |

**Planners read `state IN ('can_sing','learned')`.** `learned` is kept as its own state for two reasons:
- the "you've learned N songs" line;
- so a learned song is never suggested again.

### 1.4 Soft limits (enforced in the store, in one conditional statement)

| Limit | Value | Why |
|---|---|---|
| Can sing + learned | **60** | `planRequestSchema.performer.songs.max(60)`: a Playlist must always fit one plan request |
| To learn | **20** (10 per refresh plus up to 10 kept) | Keeps a refresh small |
| Rows in all | 120 | Bounds dismissed rows |
| New Playlists | 10 an hour per IP | Stops table spam (`rate-limit.ts:createRateLimiter`) |
| Expiry | Delete a Playlist 13 months after `last_seen_at` | A small sweep run when `/api/playlist` writes, or a cron later |

### 1.5 Privacy

- No PII is required. The act name is optional, and nothing ties a row to a person, an email or an IP. IPs are used only by the in-memory limiters (`rate-limit.ts`).
- **"Forget my Playlist"** (`DELETE /api/playlist`) deletes the row (the songs go with it through the cascade) and clears the cookie.
- The privacy note on the landing page says what is stored and for how long.

### 1.6 Later: accounts (plan B, not now)

- Migration `00N_playlist_accounts.sql` adds `user_id TEXT NULL UNIQUE` to `playlists`.
- **On sign-in:**
  - The user has no Playlist: set `user_id` on the device Playlist.
  - The user already has one: merge the device Playlist into it, then delete the device row.
    - Union by `song_key`.
    - The state is kept by precedence: `learned` > `can_sing` > `to_learn` > `dismissed`.
    - `kept = kept OR kept`, and the earliest `added_at` wins.
    - `sounds_like` is a union, capped at 10.
- After sign-in the cookie is only a pointer. Each device merges once.
- Because songs hang off `playlist_id`, never off the cookie, nothing else changes.

### 1.7 The comparison

| | **A. Neon + anonymous cookie** (recommended) | B. Accounts now (magic link) | C. localStorage only |
|---|---|---|---|
| No-login rule | Kept | Breaks it unless sign-in is optional | Kept |
| Cross-device | No (until accounts) | Yes | No |
| Survives clearing site data | No (the cookie goes) | Yes | No |
| Safari | Fine: an httpOnly server cookie isn't capped at 7 days | Fine | **Script-written storage is wiped after 7 days without a visit (ITP)** |
| Server-side suggestion caching | Yes: suggestions and reasons are stored per Playlist, so a refresh with unchanged inputs costs 0 calls | Yes | **No.** Every refresh must re-send the whole Playlist, the server can't tell an unchanged one, and the limit can only be per IP |
| Server-rendered prefill of the forms | Yes (the cookie is read server-side) | Yes | No: the forms flash empty, then fill from script |
| Merge into accounts later | One migration (§1.6) | n/a | Import on first sign-in, from each browser |
| Cost and extra work | 1 migration, 1 store, 6 routes | Resend account, sign-in design, email flows | None on the server |

## 2. The songs-to-learn pipeline

Qloo has no song-level data, so the work is split:
1. **Qloo** picks and scores the **artists**.
2. **Spotify** (Last.fm as backup) supplies the **songs** of the shortlisted artists.
3. **Claude Haiku** only **orders and explains** that closed candidate set.

Code lives in `src/server/playlist/suggest.ts`. It runs inside `withQlooUsage` (`adapters/qloo/usage.ts`) so it can count requests and enforce the budget.

### 2.1 Inputs

- **Seed ids:** the Qloo artist ids of the Playlist's can-sing and learned song artists plus the `sounds_like` artists, unique, capped at 10 (`qloo/index.ts:MAX_ARTISTS`).
  - Most frequent first. Sounds-like artists win a tie.
  - The ids are resolved once with the existing `index.ts:resolveArtists` (Spotify id first, then `/search`) and stored in `playlist_songs.qloo_artist_id` and `sounds_like[].qlooId`. Later refreshes don't look them up again.
- **Pitches:** `usual_pitches` (D4).
- **Exclusions:** every artist and song already in the Playlist, in any state, dismissed included.

### 2.2 The exact Qloo calls

Numbers follow `docs/qloo-data-map.md` §1.

| # | Call | New or existing | Why |
|---|---|---|---|
| **12 (new)** | **`GET /v2/insights` `filter.type=urn:entity:artist`**, `signal.interests.entities=<seed ids, ≤10>`, `feature.explainability=true`, `take=30`. **No location.** Proposed `client.ts:tasteArtists(backend, entityIds, take)`, cached and counted like the others (`"use cache: remote"`, `cacheLife("days")`, tag `qloo:taste-artists`, wrapped in `countLookup` and `lookupScope`) | **New.** No existing function sends an artist insights call with interest signals and no location: `localArtists` always sends `signal.location`, and `affinityFor` needs `filter.results.entities` | Artists whose fans overlap your Playlist's, anywhere. Per-result explainability gives the "because <your artist>" line |
| **5c (new variant of 5)** | **`GET /v2/insights` `filter.type=urn:entity:artist`**, `signal.location=<WKT POLYGON>` = `where.ts:boxAround(pitch, 400 m, city box)`, `signal.interests.entities=<seed ids>`, `feature.explainability=true`, `take=10`. One per usual pitch, at most 3 | **Existing:** `client.ts:localArtists`, the same shape the agent's `crowd_at` uses (`tools.ts:createTools` → `crowd_at`) | Artists the crowd at **your** pitches likes. Built the same way as `crowd_at`, so it can share cache entries with agent runs at the same pitch |
| 5 (fallback for 5c) | The same call over the city box (`CITIES.melbourne.bbox`), `take=20` (`context.ts:LOCAL_ARTISTS_TAKE`). Only when there are no usual pitches | **Existing:** `client.ts:localArtists`, as `context.ts:PlanContext.localCrowd` sends it | The same request as a plan's crowd read, so it is often a cache hit |
| (field of 12, 5 and 5c) | `query.measurements.audience_growth` per result | **Existing field**, read by `normalize.ts:toEntity` → `audienceGrowth`. **No extra request** | First ranking key, as in `setlist.ts:learnThese`. It returned 0 for every artist checked live (data map §5), so the next keys decide |
| 8 | `GET /v2/trending`: `trendingWindow` (probe ≤5, cached for the day), then `trending` for the top 5 candidates (42-day window) | **Existing:** `client.ts:trendingWindow`, `client.ts:trending`. Reused with the same rules as `context.ts:PlanContext.rising`, flat rows dropped | Second ranking key ("rising with this crowd") |
| 9 | `GET /v2/insights` `filter.type=urn:demographics`, `signal.interests.entities=<seed ids>` | **Existing:** `client.ts:demographics` | The age lean, for an era-fit hint on each suggestion (`setlist.ts:eraFit`), the same as the set |

**Not used:**
- `filter.exclude.entities`. It is unverified on the hackathon API, and Qloo silently ignores bad parameters (data map §5). Exclusion happens in our code.
- `affinityAt` (#6) per candidate. 5c already scores the candidates at each pitch.

**Candidate artists:** the union of 12 and 5c (or 5), minus excluded artists, ranked the way `learnThese` ranks:
1. audience growth;
2. trending delta;
3. best affinity, with a bonus when an artist shows up both in taste (12) and at a pitch (5c);
4. Last.fm listeners (`QlooEntity.lastfmListeners`).

The top **8 artists** go to the catalogue step.

### 2.3 Songs for the shortlisted artists

| Step | Call | New or existing |
|---|---|---|
| Spotify (primary) | `GET /v1/search?q=artist:"<name>"&type=track&limit=10&market=AU`. Results are kept only when `nameKey(artist)` matches (namesakes). Fields: track id, title, duration, album year | **New** `repertoire/client.ts:searchArtistTracks(artist, market)`, cached for days like `searchTracks`. The top-tracks endpoint returns 403 (see the header of `repertoire/client.ts`). `searchTracksByArtist` needs a title, and `fetchArtistCatalogue` costs up to 18 requests per artist |
| Last.fm (backup, per artist) | `artist.gettoptracks`, limit 10 | **Existing:** `songs/index.ts:getSongs` → `songs/client.ts:fetchTopTracks` (cached for weeks). Used when Spotify fails or has nothing for that artist. Its play counts also order the songs within an artist |

**Up to 3 songs per artist** (24 candidates) become the **candidate set**. Each candidate has a server-made id (`cand-<n>`), title, artist, the source catalogue, and the Qloo evidence.

### 2.4 The AI step and the guardrail

- **Model:** `MODELS.cheap` (Claude Haiku 5.5, `agent/models.ts`), called as `agent/compare.ts:plainLlmSuggestion` calls it: `generateText` with `Output.object`. In offline mode, a proposed `mock-model.ts:createMockLearnRanker`.
  - Ranking 24 known candidates and writing one short line each is a small task. Sonnet (the planner) would cost several times more for no gain.
  - It runs once per refresh with new inputs, never per page view.
- **Structured output (proposed):**

  ```
  { picks: [{ id: z.enum(candidateIds), reason: z.string().max(160) }].max(10) }
  ```

  The id enum is built from this refresh's candidate set, so the model can't name anything else.
- **The guardrail.** The model only orders and explains catalogue results. It never adds a song. On the server, after parsing:
  1. Drop any pick whose `id` is not in the candidate set, and any duplicate.
  2. Title, artist, Spotify id, year and duration always come **from the candidate record**, never from the model's text.
  3. A reason with a number that isn't in that candidate's evidence is replaced with the template reason. This is the same idea as `finish_plan`'s number check (`tools.ts:NumberBag`).
  4. If fewer than 3 valid picks remain, or the call fails or times out (`LIMITS.compareTimeoutMs`), use the deterministic order from §2.2 with the template reasons (the `learnThese` wording). `evidence.ranker` is then `"template"`.
- **Stored per suggestion:**
  - `reason`;
  - `evidence = { ranker: "claude"|"mock"|"template", catalogue: "spotify"|"lastfm", artistFrom: "qloo-taste"|"qloo-pitch"|"lastfm-similar", affinity, because: [{name, score}], pitch?, audienceGrowth, trendDelta, eraFit? }`.

  The UI shows a "Why" line and the evidence, so every claim traces back to a call. On the songs it shows the existing Learn it links (`lib/learn-links.ts:learnLinks`, `components/songs/learn-it-menu.tsx:LearnItMenu`).

### 2.5 Caching per layer

| Layer | Cache | TTL |
|---|---|---|
| Qloo calls (12, 5, 5c, 8, 9) | `"use cache: remote"`, keyed by backend and params (`client.ts`) | Next's `days` profile: stale after 5 min, revalidated at 24 h, expires after 7 days (data map §4) |
| Trending window | `client.ts:trendingWindow`, keyed by today's date | 1 day |
| Spotify artist search | `"use cache: remote"` | `days` (24 h), like `searchTracks` |
| Last.fm top tracks, similar artists | `"use cache: remote"` | `weeks`, like `fetchTopTracks` |
| The ranking (AI output) | `plan_store` (exists, `002_agent_v2.sql`), `kind='learn-rank'`, key = sha256 of the candidate set and seed ids | 24 h |
| The result | `playlist_songs` rows (`to_learn`, `kept=false`) plus `playlists.suggest_input_hash` and `suggested_at` | Until the next refresh. **A refresh with an unchanged input hash within 24 h returns the stored rows: 0 calls, and not counted against the limit** (like `reused` in `freshRunGate`) |

The input hash covers: seed ids, `usual_pitches`, excluded song keys, and the day.

### 2.6 Qloo budget per refresh

| Part | Cold (no cache, ids not stored yet) | Typical (ids stored, today's window cached) |
|---|---|---|
| Resolve seed artists (#1 `/search` or #2 `/entities`) | ≤ 10 | 0 (ids stored in the Playlist) |
| #12 taste artists | 1 | 1 |
| #5c crowds at usual pitches (or #5 once) | ≤ 3 | ≤ 3 |
| #8 trending window probes | ≤ 5 | 0 (cached for the day) |
| #8 trending, top 5 candidates | ≤ 5 | ≤ 5 |
| #9 demographics | 1 | 0–1 (often shared with plans) |
| **Total** | **≤ 25** | **≤ 10** |

- **Hard cap: 25 requests per refresh** (proposed `PLAYLIST_REFRESH_QLOO_BUDGET = 25`).
  - Before each optional stage (trending, demographics, the 2nd and 3rd pitch), `suggest.ts` reads `QlooUsage.calls` and skips the stage if it would cross the cap.
  - Skipping adds a note, like `context.ts:OPTIONAL_QLOO`. Only #12 is required.
- **Against the quota** (10,000 a month, `qloo-map.ts:QUOTA`): 100 typical refreshes cost ≤ 1,000 requests (10%). 100 cold ones cost ≤ 2,500. Cold busks stay at 24–33 each (data map §4).
- **Refresh trigger:**
  - the **Refresh suggestions** button on the Playlist page;
  - one automatic fill the first time the Playlist has at least 3 songs you can sing.

  Never on page view.
- **Refresh limit (D3).** A proposed `rate-limit.ts:learnRefreshGate`, the same pattern as `freshRunGate`:
  - `learnRefreshLimiter = createRateLimiter(3, 60 * 60_000)` keyed by the Playlist id, plus a per-IP limiter of 6 an hour.
  - `reused` (an unchanged input hash) and `offline` are free.
  - A test fault, `faults=learn-limit`, forces a refusal, like `request.ts:FRESH_LIMIT_FAULT`.
  - The refusal is a 429 with `Retry-After`, `retryAt` and a relative message (the B-013 rule).

### 2.7 When Qloo returns nothing

| Situation | What happens | Label on screen |
|---|---|---|
| #12 and #5c/#5 return no artists, or Qloo is down | **Last.fm similar artists:** `artist.getSimilar` (limit 10) for up to 3 seed artists. Proposed `songs/client.ts:fetchSimilarArtists`, cached for weeks. Then §2.3 and §2.4 as usual, `evidence.artistFrom = "lastfm-similar"` | "Qloo had no suggestions this time. These are similar artists from Last.fm." Nothing is attributed to Qloo |
| Spotify and Last.fm have no songs for an artist | The artist is dropped from the candidate set. Artist-only suggestions are not offered | – |
| Nothing at all | An empty "To learn" section with the reason and a retry time | "No suggestions yet: …" |
| No seed artist resolves on Qloo | The same as the first row, plus the existing "Qloo couldn't match X" wording (`plan-view.tsx`) | |

## 3. The planners

### 3.1 How /plan and /week read the Playlist

- **The landing performer form** (`components/landing/performer-form.tsx:PerformerForm`) is where both planners start. Submitting goes to Plan (`openPlan` → `POST /api/plans`) or to `/week?…` (`submit`).
- When the server finds a Playlist cookie, `src/app/page.tsx:OwnActForm` passes the Playlist to the form as its prefill. The form already takes a `prefill` of a performer: today it comes from `?again=<plan id>`, and the Playlist would be a second source, with `?again` still winning.
  - A default **"Use my Playlist (N songs)"** switch is on. Name, sounds-like and songs are filled from the Playlist.
  - **"Edit for this busk only":** any change to songs or artists while it is on turns the badge into "Edited for this busk". The saved Playlist is **not** changed.
    - An explicit **"Save these changes to my Playlist"** button (`PATCH /api/playlist`) is the only way the form writes.
    - With no Playlist yet, the same button reads **"Save as my Playlist"** and creates it.
- **The request stays what it is today:**
  - The form submits a full `PlanRequest` (`plan-schema.ts:planRequestSchema`) or `WeekRequest` (`week-schema.ts:weekRequestSchema`) with `performer.songs` copied from the Playlist.
  - `/api/plans`, `/api/plan`, `/api/week` and the URL helpers (`plan-url.ts:planSearchParams`, `week-url.ts:weekSearchParams`) need **no change**.
  - The only optional addition is `performer.songsFrom: "playlist" | "edited"`, for the badge on the plan. It is `.optional()`, so old links still parse.
- **The week planner:** `week.ts:buildWeekPlan` does not score songs today. It gets them from the same form. Its per-session "Plan this busk" links (`week-view.tsx`, via `planSearchParams`) already carry `performer.songs`, so they carry the Playlist snapshot.
- **The Playlist page (`/playlist`, proposed)** edits the three sections. Its song search reuses `components/landing/song-search.tsx`, the artist picker reuses `artist-picker.tsx`, and both use `/api/repertoire`.

### 3.2 Snapshot, not reference (recommended)

- `plans.request` already stores the request "as the act typed it", songs included (`003_plans.sql`, `plans/store.ts` header). A short link is therefore a **snapshot** today. Keep it that way.
  - `/p/<id>` keeps showing the songs it was planned with after the Playlist changes.
  - The link is safe to share: it holds no Playlist id or cookie.
  - `requestHash` dedupe (`plans/store.ts:requestHash`) still works: same songs, same day, same id.
- A reference (a Playlist id in the request) would make shared links change under the viewer, leak a handle to someone's Playlist, and break when the Playlist is forgotten. Not recommended.

### 3.3 Learn these → the Playlist

- The plan keeps its per-crowd **Learn these** (`context.ts:PlanContext.learn` → `setlist.ts:learnThese`, shown from `plan.learnThese`). It answers "what suits *this* crowd".
- Each item with a title gets **"Add to Playlist"**. It sends `POST /api/playlist/songs` with:
  - `{title, artist, state: "to_learn", source: "suggested", kept: true, reason, evidence: {artistFrom: "plan", audienceGrowth}}`.
  - No Playlist yet → the first add creates one and sets the cookie.
  - Already in the Playlist (any state) → "In your Playlist". The client checks `song_key`.
- The landing and plan pages say where the songs went: "Saved to To learn in your Playlist".

### 3.4 The suggested set per pitch keeps working

- `setlist.ts:buildSetlist` is **unchanged in behaviour**:
  - 48% affinity, 32% popularity, 20% era fit;
  - the opener rule;
  - no artist twice in a row.
- It is fed by `context.ts:PlanContext.repertoire` from `request.performer.songs`, which now come from the Playlist's can-sing and learned songs (§3.1).
- `tests/unit/scoring/setlist.test.ts` stays green untouched.
- **Optional saving (proposed, S5):** `qloo_artist_id` from the Playlist could seed `repertoire()` and skip the `songArtists` `/search` calls. That needs a request field and changes `requestHash`, so it is deferred.

### 3.5 The examples stay input-only

- The presets (`lib/examples.ts:EXAMPLES`, `/plan?example=…`) never read or write a Playlist.
  - The "Use my Playlist" switch is not shown on example runs.
  - "Add to Playlist" is hidden when `exampleId` is set.
- `/api/warm` and the examples' plan-store replay keep working as now.
- An e2e checks that an example run leaves the Playlist unchanged (§5).

### 3.6 Routes (proposed)

All of these are route handlers, like the existing `/api/*`. The mutating ones get the Origin check and BotID (§1.1).

| Route | Does |
|---|---|
| `GET /api/playlist` | The current Playlist, or `null`. Never creates one |
| `POST /api/playlist` | Create, sets the cookie (limit: 10 an hour per IP) |
| `PATCH /api/playlist` | Act name, sounds like, usual pitches. Needs `revision` (409 if it is stale) |
| `POST /api/playlist/songs` | Add a song (from search, typed, or from a plan) |
| `PATCH /api/playlist/songs/[id]` | A state change from §1.3. Anything else is a 400 |
| `DELETE /api/playlist/songs/[id]` | Remove a song |
| `POST /api/playlist/suggestions` | Refresh (§2.6 gate) |
| `DELETE /api/playlist` | Forget: deletes the Playlist and clears the cookie |

**The store:**
- `src/server/playlist/store.ts` (proposed): `MemoryPlaylistStore` offline and `PostgresPlaylistStore` with `DATABASE_URL`, chosen like `plans/store.ts:shortPlanStore` (Neon HTTP driver, `processMap`).
- Without a database outside tests, the Playlist routes return 503 "Saving isn't available", and the form keeps working without a Playlist.

## 4. Renames

### 4.1 One module for user-facing words

Proposed `src/lib/playlist-copy.ts`, client-safe:

```
PLAYLIST_COPY = { name: "Playlist", canSing: "Songs you can sing", toLearn: "Songs to learn",
  learned: "Learned", suggestedSet: "Suggested set", addTo: "Add to Playlist", useMine: "Use my Playlist", … }
```

- Every component and page string about the feature reads from it, and so do the `TOOL_LABELS` display labels.
- **Code identifiers stay neutral and stable:** tables `playlists`, routes `/api/playlist`, `src/server/playlist/`.
- A later rename to "Songbook":
  - edit this one file;
  - optionally move the page route, with a redirect from `/playlist`;
  - update the docs.
- No schema change, no migration.

### 4.2 What changes, and what doesn't

| Where | Today | Proposal |
|---|---|---|
| UI copy | "Setlist", "Learn these" (`setlist-panel.tsx`, `plan-view.tsx`, `crowd-panel.tsx`, `week-view.tsx`, `app/page.tsx`) | "Suggested set" per pitch. "Songs to learn" on the plan, "To learn" in the Playlist. All of it from `PLAYLIST_COPY` |
| Plan schema (`plan-schema.ts:planPitchSchema.setlist`, `planSchema.learnThese`) | Stored in Neon (`plans.plan`, `plan_store`) and on short links | **Keep the wire names.** Renaming them breaks the parsing of stored plans. Add TypeScript aliases only: `type SuggestedSet = PlanPitch["setlist"]`. If a rename is wanted later: accept both keys with `z.preprocess` (`setlist` → `suggestedSet`) for 7 days, then drop the old one |
| Agent tools (`tools.ts:createTools`: `build_setlist`, `learn_these`) | The design contract fixes `build_setlist` `songs[]` (`dev-brief-agent-v2.md`) | **Keep the tool names and output fields.** Change only the display labels (`TOOL_LABELS.build_setlist` → "Suggested set for a pitch", `learn_these` → "Songs to learn"), and tell BRAND[busk-map] in the same round, as the contract asks |
| Scoring (`setlist.ts:buildSetlist`, `SetlistEntry`, `learnThese`) | | Keep. Optional re-exports `buildSuggestedSet = buildSetlist` only if the reviewers want the new word in code. Churn is the risk while QA shares the checkout |
| Plain-AI baseline (`baselineViewSchema.setlist`, `compare.ts`) | | Keep (wire field). Copy only |
| `researchTotals.songs` | | Keep |
| Design system (Honeycomb) | | BRAND renames components after the Honeycomb round. DEV adds rows to `design-backlog.md` for the Playlist page, the "Use my Playlist" switch and the Add to Playlist button |

### 4.3 The Brain page (`src/lib/qloo-map.ts`) and its drift test

| Change in `qloo-map.ts` | Detail |
|---|---|
| New call **`c12`** | `num: "12"`, "Artists like your Playlist", `/v2/insights`, `urn:entity:artist`, `keyParams: ["signal.interests.entities=<Playlist ids>", "feature.explainability=true", "take=30"]`, `codeRef: "client.ts:tasteArtists"`, `via: ["suggest.ts:suggestSongs"]` |
| New variant **`c5c`** | `variantOf: "c5"`, "Crowd at your usual pitches", `codeRef: "client.ts:localArtists"` |
| `c8`, `c9` | Add `via` entries for `suggest.ts` |
| New data points | `d_taste_artists` ("artists your Playlist's fans like", from c12 and c5c), `d_tracks` ("songs by those artists", from Spotify, with Last.fm as backup) |
| Features | `f_setlist` is relabelled "Suggested set" (the id is kept, so the test traces stay valid). A new **`f_learn`** "Songs to learn", in the Playlist page's To learn section, `combined` with Spotify, Last.fm and Claude Haiku |
| Secondary sources (D6) | Add `lastfm`: songs backup, similar artists |
| Facts | A new `CALLS_PER_REFRESH = "≤ 25"`. `CALLS_PER_NEW_BUSK` is unchanged |

**What the drift test (`tests/unit/lib/qloo-map.test.ts`) then expects:**
- `callKinds` 11 → **12**.
- Variants `["c5b"]` → `["c5b","c5c"]`.
- `featureCount` 9 → **10**.
- Data points 15 → **17**.
- Secondary sources `["Spotify","Ticketmaster"]` → `["Spotify","Ticketmaster","Last.fm"]` (if D6).
- `facts` → `["12", "24–33", "0", "10"]`.
- The c3 trace is unchanged.

The "names exactly the client functions that send a Qloo request" check fails by design as soon as `tasteArtists` lands without its map entry. That check is the guard.

`docs/qloo-data-map.md` gets row 12 and row 5c, a §4 "Per Playlist refresh" budget table (§2.6), and §6 notes for the Last.fm fallback.

## 5. Tests

**Unit (DEV, Vitest):**

| File (proposed) | Covers |
|---|---|
| `tests/unit/server/playlist-store.test.ts` | Both stores share one contract suite (as `stored-plans.test.ts` does): the token is stored only as its hash, the cookie value is never logged, `song_key` dedupe, the cascade on forget, `revision` gives a 409, and the limits (the 61st can-sing song and the 21st to-learn song are refused) |
| `tests/unit/lib/playlist-state.test.ts` | Every allowed transition in §1.3. Forbidden ones throw. Planners see can_sing + learned. A refresh keeps `kept` rows and skips dismissed ones |
| `tests/unit/server/playlist-suggest.test.ts` | **The guardrail:** a mock model that returns an unknown id, a duplicate, an invented title, or a reason with a stray number → dropped or replaced with the template. Fewer than 3 valid picks → the template order. The Last.fm fallback is labelled. Excluded artists never appear |
| `tests/unit/agent/qloo-usage.test.ts` (extend) | **The budget:** with the emulated data cache, a cold refresh makes ≤ 25 requests, a typical one ≤ 10, and an identical rerun 0. The cap skips the optional stages with a note |
| `tests/unit/server/learn-refresh-limit.test.ts` | `learnRefreshGate`: the 4th refresh in an hour is refused, `reused` and `offline` are free, `forced` refuses |
| `tests/unit/lib/plan-url.test.ts` (extend) | `songsFrom` round-trips, and old URLs still parse |
| `tests/unit/lib/qloo-map.test.ts` | The new expectations in §4.3 |

**Mock-model e2e (DEV, `tests/e2e/playlist.spec.ts`, offline only).** One flow:
1. Type songs on the landing page, then "Save as my Playlist".
2. Reload: the form is prefilled and "Use my Playlist" is on.
3. Plan with it, which opens `/p/<id>`.
4. "Add to Playlist" on a Learn these song.
5. On `/playlist`, it is under To learn. Mark it learned: it moves to Songs you can sing.
6. Start the week planner: the week request includes that song.

Plus:
- "Edit for this busk only" leaves the saved Playlist unchanged.
- An example run leaves the Playlist unchanged.
- The old `/p/<id>` still shows its original songs after the Playlist changes (the snapshot).

**The cost guard:**
- The e2e offline guard exists and covers the new specs as-is (`tests/e2e/guard.ts:decideGuard`, `global-setup.ts`).
- New: `faults=learn-limit` gives a 429 page with the relative message. It is added to `tests/e2e/fresh-limit.spec.ts`, or to a sibling spec.
- In offline mode the refresh limit never applies, so the shared e2e IP isn't throttled.

**QA's paths (read-only for DEV):**
- `tests/e2e/qa/` (`a11y`, `layout`, `rate-limit`, `brain`, `baseline`) belongs to QA.
- Propose via MANAGER that QA extends:
  - `qa/rate-limit.spec.ts` with the refresh limit;
  - `qa/a11y.spec.ts` and `qa/layout.spec.ts` with `/playlist` at 3 widths;
  - `qa/brain.spec.ts` with c12, c5c and f_learn.
- DEV doesn't edit `tests/e2e/qa/*`.
- Stage commits are announced, because the checkout is shared.

## 6. Effort, stages, risks

**Order (user's direction, 17 Oct):** two tracks run in parallel. Track A, the Honeycomb look in `../busk-map-honeycomb` (`design/honeycomb`), comes first and is not counted here. Track B, Playlist, is built on `dev/core` alongside it, once this proposal is approved, and is not blocked by Track A. It is plain shadcn logic and UI only, so merging Honeycomb into `dev/core` stays a clean "look over features" merge; the only expected conflicts are where Playlist renames Setlist labels, and they are resolved in favour of both. BRAND's Playlist screens (DS v63+, `design-handoff/playlist/`) are applied afterwards as a brand sync, tagged `brandv1.<iteration>.0`. Until then DEV adds rows to `design-backlog.md`.

| Stage | Contents | Hours |
|---|---|---|
| S1 Storage and API | `004_playlists.sql`, the Memory and Postgres stores, the cookie, the 8 routes, the limits, forget, unit tests | 6 |
| S2 Planners read the Playlist | Form prefill, "Use my Playlist", edit for this busk only, save to Playlist, a basic `/playlist` page, Add to Playlist on Learn these, the week flow | 6 |
| S3 Songs to learn | `client.ts:tasteArtists`, `searchArtistTracks`, `fetchSimilarArtists`, `suggest.ts`, the Haiku ranker with the guardrail and mock, caching, the budget cap, `learnRefreshGate`, unit tests | 8 |
| S4 Brain and naming | `playlist-copy.ts`, label renames, `qloo-map.ts` and the drift test, `docs/qloo-data-map.md`, a note to BRAND | 3 |
| S5 Polish and tests | The e2e flow, the limit fault spec, empty and error states, the QA handoff, an expiry sweep | 4 |
| **Total** | | **27 h** (about 3.5 working days) |

**Risks:**

| Risk | Mitigation |
|---|---|
| The Qloo quota (10k a month) is shared with plans | A 25-request cap, 0 calls on an unchanged refresh, no refresh on page view, the per-Playlist and per-IP limits. `qlooCalls` is logged per refresh |
| Weak ranking signals live: `audience_growth` is 0, and trending is stale and flat (data map §5) | Rank by affinity and the taste∩pitch bonus, and say so in a note, as plans already do (`context.ts:PlanContext.rising`) |
| Spotify artist search picks a namesake | Filter by `nameKey`, prefer the Spotify id when the artist was picked in the form (`sounds_like[].spotifyId`), and fall back to Last.fm |
| The model drifts from the candidates | Enum ids, server-side validation, record-sourced fields, the template fallback (§2.4) |
| A cookie lost on a cleared browser means a lost Playlist | Say so on the page. Accounts (§1.6) are the cure. Optional later: export and import as a file |
| A migration on prod Neon | It is idempotent and only adds tables. `npm run db:migrate:dev` runs on the dev branch first |
| Design not ready | Screens are built plain behind design-backlog rows. The design contract fields are untouched |
| The checkout is shared with QA | Commits by path only, per stage. No edits to `tests/e2e/qa/` |
| The rename comes late | One copy module (§4.1). Code names are neutral |

**Decisions:** D1–D6 in §0. The ones that block are **D1 (storage)** before S1 and **D3 (limits)** before S3. D2 can come any time.
