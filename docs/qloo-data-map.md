# Qloo data map (as implemented on `dev/core`, 16 Oct 2026)

Qloo is Busk Map's taste layer. It decides who the crowd is, where in the city the act's taste concentrates, which venues nearby suit it, and which songs to play. Every number on screen comes from a tool or an adapter call, never from the model: the agent only picks among pitches the engine scored, and `finish_plan` rejects any number no tool returned. Other sources (City of Melbourne sensors, the council's busking layers, Ticketmaster, Last.fm, Spotify, Open-Meteo, OSM spots) adjust or check what Qloo says.

All Qloo traffic goes through one client, `src/server/adapters/qloo/client.ts`, wrapped by `src/server/adapters/qloo/index.ts`. Without a key, or in tests, the same client talks to the local mock (`src/server/qloo-mock`), and the UI labels the data "Qloo test data (local mock)".

## 1. Every distinct Qloo call

The client makes 11 kinds of call, which come in 12 shapes (`localArtists` is called two ways). "Row" means one request unless stated.

| # | Call (endpoint, type, key params) · `file:function` | Fields we use | Where it lands | How it's used |
|---|---|---|---|---|
| 1 | **`GET /search`** `query=<artist name>`, `types=urn:entity:artist`, `take=3`. The best match is kept, and a 404 means "no match". · `client.ts:searchArtist`, via `index.ts:resolveArtists` | `entity_id`, `name`. Also mapped: `properties.external.lastfm.listeners` | Resolving the act's artists (`context.ts:artists`), event headliners (`context.ts:eventTaste`, up to 6) and song artists not in "sounds like" (`context.ts:repertoire`). The week planner too (`week.ts`). "Qloo couldn't match X" alert (`plan-view.tsx`), crowd panel | Direct input. It is the entry point: every later call signals with these ids. Fallback after #2 |
| 2 | **`GET /entities`** `external.spotify.ids=<id>`, one id per request. · `client.ts:entitiesBySpotifyIds`, via `index.ts:resolveArtists` | `entity_id`, `name` | Same as #1, for artists picked from Spotify search | Combined with **Spotify** (the artist picker supplies the id, so the right namesake is picked). Tried first, then #1 |
| 3 | **`GET /v2/insights` `filter.type=urn:heatmap`** `signal.interests.entities=<act ids>`, `filter.location=<WKT POLYGON>` (the city planning box, longitude first). Retried once over a box twice as wide if empty. · `client.ts:heatmap`, via `index.ts:tasteMap` | `location.latitude/longitude/geohash`, `query.affinity`, `query.popularity` | **Taste map** (`plan-map.tsx`, cells drawn as geohash rectangles). **Pitch ranking**: candidate generation (`candidates.ts:topCells`, the top 30% of cells, snapped to OSM spots and sensors), `pitch-score.ts:tasteFactor`. Footfall proxy (`footfallFactor`, `"qloo-popularity"`). "How this plan was found" funnel line. Agent tool **`taste_map`** (can zoom to a smaller box or signal fewer artists, which makes a new call). **Week planner** (`week.ts`). `researchTotals.taste` | Direct input to the taste factor. Combined with **OSM spots**, **City of Melbourne sensors** and the **council's busking layers** to make candidates. Cell popularity is the last-resort footfall when there's no sensor nearby |
| 4 | **`GET /v2/insights` `filter.type=urn:entity:place`** `filter.location=<WKT POINT>` (city centre), `filter.location.radius=2000` (4000 on retry), `filter.hours=<weekday>` (omitted by the week planner), `signal.interests.entities`, `take=50`. · `client.ts:places`, via `index.ts:busyPlaces` | `entity_id`, `name`, `location.lat/lon`, `popularity`, `query.affinity`, `properties.hours`, `properties.live_music`, `properties.good_for[].name/weight`, `properties.keywords[].name/count` | **Pitch ranking**: `pitch-score.ts:placesFactor` (open places in the slot, weighted by popularity and distance). **Venue detail** on the pitch card ("Qloo: live music, pub, known for 'bands'", `lib/venue.ts`). Template "why" lines. Agent tool **`busy_places`** (any point, radius 200–1500 m). **Week planner** (hours checked per slot). `researchTotals.places` | Direct input to the places factor. Hours are checked against the slot (`scoring/hours.ts`). live_music, good_for and keywords are shown, not scored |
| 5 | **`GET /v2/insights` `filter.type=urn:entity:artist`** `signal.location=<WKT POLYGON>`, `signal.interests.entities=<act ids>`, `feature.explainability=true`, `take=20` (city box). The agent asks with `take=10` over a box around a point. · `client.ts:localArtists`, via `context.ts:localCrowd` | `entity_id`, `name`, `query.affinity`, per-result `query.explainability` (entity_id, score), top-level `query.explainability.effect_on_top10/top5/all/top3_recs`, `query.measurements.audience_growth`, `external.lastfm[].listeners` | **Crowd panel**: "Who this crowd likes" with the "because" artists and their scores, "What Qloo matched on" (drivers, from the top-10 effect, `assemble.ts:drivers`). **Learn these**: the top 5 artists. Agent tool **`crowd_at`**. `researchTotals.crowds` | Direct input. Learn these is combined with **Last.fm** top tracks and listeners, and with #8 |
| 5b | Same call with **no interest signal** (the "usual crowd"): `signal.location=<WKT POLYGON>` about ±0.004° around the first usual hotspot, `take=10`, no explainability. · `context.ts:hotspotCrowd` → `client.ts:localArtists` | `entity_id`, `name`, `query.affinity` | **Crowd panel**: "Your fans vs the usual crowd", and the group B input to #11 | Diff: the usual crowd vs the act's fans |
| 6 | **`GET /v2/insights` `filter.type=urn:entity:artist`** `filter.results.entities=<song artists' ids>`, `signal.location=<WKT POINT>`, `signal.location.radius=400`, `take=<count>`. · `client.ts:affinityAt`, via `index.ts:artistAffinityAt` | `entity_id`, `query.affinity` | **Setlist** per pitch (`context.ts:setlistFor` → `setlist.ts:buildSetlist`: 48% affinity). Agent tools **`build_setlist`** and **`compare_crowds`** ("your artists" at each pitch). Setlist panel | Combined with **Last.fm** play counts, **Spotify** release years and #9's age lean. An artist Qloo leaves out at a point is "no local score", scored with a proxy |
| 7 | **`GET /v2/insights` `filter.type=urn:entity:artist`** `filter.results.entities=<event headliner ids>`, `signal.interests.entities=<act ids>`, no location, `take=<count>`. · `client.ts:affinityFor`, via `index.ts:tasteMatch` | `entity_id`, `query.affinity` | **Events**: `context.ts:eventTaste` → `pitch-score.ts` events factor (crowd weighted by match). Pitch card ("Qloo: X's fans match your taste 94/100"). Agent tool **`events_near`** (`headlinerMatch`) | Combined with **Ticketmaster** (headliners come from #1 on its artist names) |
| 8 | **`GET /v2/trending`** `signal.interests.entities=<one id>`, `filter.type=urn:entity:artist`, `filter.start_date`, `filter.end_date` (a 42-day window). One request per artist, up to 5. Window probing (`trendingWindow`): the same call for the top local artist, ending yesterday, then 91 days earlier each time, up to 5 probes. · `client.ts:trendingFor`, `trendingWindow`, `trending`, via `context.ts:rising` | `date`, `population_percent_delta`, `population_percentile` (→ `windowChange`) | **Learn these** ranking (2nd key, after audience growth). The **crowd panel** "Rising +N pts" badge (`windowChange` ≥ 1). Agent tool **`learn_these`**. A plan note when the data is stale | Direct input. If every row is flat, it is dropped and learn these falls back (see §6) |
| 9 | **`GET /v2/insights` `filter.type=urn:demographics`** `signal.interests.entities=<act ids>`. · `client.ts:demographics`, via `index.ts:crowdProfile` | `query.age`, `query.gender` (signed lean per band, averaged over the act's artists) | **Crowd panel** "Who your fans are" (lean bars). **Setlist** era fit (`ageLean`). Agent tool **`crowd_at`** (`fansAge`, `fansGender`) | Combined with **Spotify** release years for the setlist's era fit |
| 10 | **`GET /v2/insights` `filter.type=urn:tag`** `filter.tag.types=urn:tag:genre:music`, `filter.parents.types=urn:entity:artist`, `signal.interests.entities`, `signal.location=<WKT POINT>`, `signal.location.radius=400`, `take=6`. · `client.ts:crowdTags`, via `context.ts:crowdGenres` | `tag_id` (or `id`), `name` (trimmed), `query.affinity` | **Crowd panel** "Genres around <top pitch>". Agent tools **`crowd_at`** and **`compare_crowds`** (genres at each pitch) | Direct input (shown, not scored). Diff between two pitches in `compare_crowds` |
| 11 | **`GET /v2/analysis/compare`** `a.signal.interests.entities=<act ids>`, `b.signal.interests.entities=<usual crowd ids from 5b>`. · `client.ts:compareGenres`, via `context.ts:contrast` | `results.a[]` and `results.b[]`: `tag_id`, `name`, `subtype` (music genres only), `query.count` → share of the group | **Crowd panel**: "your fans lean more towards X, less towards Y" (differences of 0.15 or more) | Diff: the act's fans vs the usual crowd |

**The plain-AI comparison** (`agent/compare.ts`, `scoring/baseline.ts`, `compare-panel.tsx`) makes **no Qloo call** of its own. The plain model gets no data. Its spots are then located and scored with the engine's own `scoreInputs` (#3, #4, #7 and the other sources). The panel is a diff, plain AI vs Busk Map, and shows Qloo's taste factor and cell rank for each side.

**Pitch ranking** (`scoring/pitch-score.ts:scorePitch`) combines taste (#3), places (#4) and events (#7 on Ticketmaster) with sensor footfall, Open-Meteo weather, the council's rules and the performer's tip history. The weights are fixed per plan and shown in the UI.

## 2. Fetched but unused

These fields arrive (the live shapes come from `qloo-live-findings.md` and `docs/qloo-mock.md`) and are dropped or ignored. Only the trimmed client output is cached.

| Field | Call | Status |
|---|---|---|
| `query.affinity_rank` (mapped to `HeatCell.affinityRank`) | #3 heatmap | fetched, unused |
| `query.entity_artist_affinity`, `entity_artist_affinity_rank` | #3 heatmap | fetched, unused (not in the schema) |
| `query.geospatial.panel_size` (top level) | #5 artists | fetched, unused |
| `query.distance` (metres) | #4 places | fetched, unused (we compute distance ourselves) |
| `properties.address` (mapped to `QlooPlace.address`) | #4 places | fetched, unused |
| `properties.description`, place `tags`, and any other place property (the schema is loose, so extras pass validation and are then dropped by `toPlace`). Price level was not recorded in the live check, so it isn't claimed here | #4 places | fetched, unused |
| Artist `popularity`, `tags`, `type`/`types`/`subtype` (mapped to `QlooEntity.popularity/tags`) | #1, #2, #5, #6, #7 | fetched, unused |
| Last.fm `scrobbles` | #1, #2, #5 | fetched, unused |
| `population_rank`, `population_rank_velocity` / `velocity_fold_change` (→ `velocity`), the latest `population_percentile` (→ `percentile`) and the weekly `series` | #8 trending | fetched, unused (only `percentDelta` and `windowChange` are read) |
| Top-level explainability `effect_on_top3/top5/all_recs` | #5 | used only as fallbacks when `effect_on_top10_recs` is missing |
| `tag_value`, `types`, `popularity` on tag rows | #10 urn:tag | fetched, unused |
| `results.tags` (shared tags with similarity `query.score`), `matchEntities`, and every non-genre tag in `a`/`b` | #11 compare | fetched, unused |
| Explainability on the usual-crowd call | 5b | not requested (no interest signal) |

## 3. Planned, not built

| Idea | Where it's referenced | Status |
|---|---|---|
| A **ResearchFunnel** UI showing `researchTotals` (taste cells, crowds, places, …, `qlooCalls`, `qlooCacheHits`). The totals are computed and streamed (`api/plan/route.ts` "totals" events) and stored on the plan, but no component renders them yet | `src/lib/research-totals.ts` header, `src/lib/plan-schema.ts` (researchTotals) | planned, not built (UI) |
| Taste signals from **genres** (`signal.interests.tags`), not just artists, for `taste_map` | Hackathon `spec.md`, agent design table ("signals = the performer's artists or genres"). The mock supports `signal.interests.tags` (`docs/qloo-mock.md`); the client never sends it | planned, not built |
| **`/v2/tags`** genre search | Implemented in the mock only (`docs/qloo-mock.md`, "What it implements"); no client function | planned, not built |
| Retrying with "the nearest locality" when Qloo returns nothing | Hackathon `spec.md` ("retries with wider filters or the nearest locality"). Built: a 2× wider box for #3 and a 2× radius for #4. Not built: a locality fallback, deliberately, because names misresolve (§6) | partly built |
| `resolveSpotifyArtists` (a bulk Spotify-id lookup) | `src/server/adapters/qloo/index.ts`: exported, but no caller (resolving goes per artist through `resolveArtists`) | built, unused |

No `TODO` or `FIXME` in `src/` mentions Qloo.

## 4. Per busk: call count and cache

**Cache.** Every client function is `"use cache: remote"` with `cacheLife("days")` (Next 16 default profile: stale 5 min, revalidate 24 h, expire 7 days), tagged `qloo` plus one tag per call (`qloo:heatmap`, `qloo:places`, …). The backend (`live`/`mock`) is part of every cache key. On top of that:
- `PlanContext.once` memoises each call within one busk, so a tool asking again makes no lookup.
- The engine's context is shared by busks of the same request (`agent/preload.ts`).
- `/api/warm` prefetches the three example presets' data when the landing page loads.
- Plans are replayed from `plan_store` for 15 min, and baselines are memoised for 10 min.

**Pacing** (`client.ts:pace`, `qlooGet`). Live calls start at most **3 a second** (Qloo allows 5, but bursts of 4 drew 429s). A 429 is retried twice after 1.1 s, and each request times out after **15 s**. The mock is not paced.

**Counted per busk.** `researchTotals.qlooCalls` counts HTTP requests sent, retries included. `researchTotals.qlooCacheHits` counts lookups served from the data cache. Both are scoped to one agent run with AsyncLocalStorage (`adapters/qloo/usage.ts`, `agent/agent.ts:withQlooUsage`) and cover the agent's tools and the engine's loads. Engine-only plans (run=0) leave both out.

**Measured.**

| Run | qlooCalls | qlooCacheHits | Source |
|---|---|---|---|
| Cold preset run | 24–28 | – | `qlooCalls` counter, commit `0e50a0a`, 16 Oct |
| Identical rerun | 0 | 23 | same |
| Cold run, each of the 3 presets (mock model + Qloo mock, data cache emulated as in `tests/unit/agent/qloo-usage.test.ts`) | 33 | 1 | re-measured 16 Oct on today's `dev/core` |
| Identical rerun, same setup | 0 | 29 | same |

What the 33 cold calls are made of:
- 7 `/search`: act artists, event headliners and song artists.
- 1 heatmap and 1 places call.
- 9 artist insights: the city crowd, the usual crowd, event match, setlist affinity per top pitch, and the agent's `crowd_at` and `compare_crowds`.
- 3 `urn:tag`, 1 demographics and 1 compare.
- 7 trending: window probes plus up to 5 artists. The 1 cold hit is the probe artist's row being reused.

The count depends on which tools Claude chooses, so live runs vary. The mock planner calls more tools than the 16 Oct runs did.

**The week planner** (`week.ts`) makes about N+2 calls: N `/search` or `/entities`, one heatmap and one places call (no `filter.hours`). It isn't counted in `researchTotals`. The no-prefetch comment on the week link in `plan-view.tsx` gives the same count ("about N+2 Qloo calls": one artist lookup per act artist, one heatmap, one places). The one heatmap and one places answer are reused for every slot of the week, which is why /brain lists the week planner under taste cells and open places.

**Quota.** 10,000 requests a month per key, at 5 a second. At 24–33 calls per cold busk, that is roughly 300–400 cold busks a month. Cached reruns cost nothing.

## 5. Live quirks that shape the calls

- **WKT polygon, never a place name.** `filter.location.query=Melbourne` resolves to "Melbourne, City of Knox", with 1,170 cells across the metro. So the city is always a WKT polygon (longitude first, `lib/geo.ts:wktPolygon`), and a pitch is a WKT point plus a radius.
- **Heatmap resolution.** Over the CBD the cells come back at geohash precision 7 (about 150 m). `isFineHeatmap` switches scoring to tighter radii. `affinity` is a rank within the response (1 down to 0), so the taste factor rescales it between the median cell and the best cell.
- **`tag_id` vs `id`.**
  - `/search`, `/entities` and `urn:tag` rows key tags as `tag_id`.
  - Insights entity tags and `/v2/tags` use `id`.
  - The schema accepts either. Requiring `id` once rejected every live search result.
  - Tag names can arrive padded (" indie"), so they are trimmed.
- **Trending lags.** There is no data for recent weeks (nothing after about mid-May 2026 when checked), so the client probes back a quarter at a time, up to a year. Rows checked were flat. A window ending more than 14 days ago adds a plan note.
- **`population_percentile` is a 0–1 fraction**, and `population_rank` is a string. The client converts percentiles to 0–100 points.
- **`audience_growth` returns 0** for every artist checked. So "learn these" ranks by audience growth, then trending delta, then Qloo affinity, then Last.fm listeners. A plan note says so when it falls back (`context.ts:rising`, `setlist.ts:learnThese`).
- **Shortlists at a point drop some artists.** `filter.results.entities` with a location signal silently leaves some out (Stevie Wonder, for example). That means "no local score here", not "no match": the setlist uses a proxy affinity.
- **Shapes differ by endpoint.**
  - Last.fm listeners: an object under `properties.external` on lookups, a list under `external` on insights.
  - Places can send `tags: null`.
  - Place hours use lowercase weekdays and run past midnight.
- **Qloo silently ignores bad parameters.** An empty result is logged with the parameter names sent (`logIfEmpty`).
- **The slowest calls take up to 7.8 s** (`urn:tag`, large place lists), hence the 15 s timeout. Optional calls that fail add a plan note instead of failing the plan (`context.ts:OPTIONAL_QLOO`). Only resolving and the taste map are required.
