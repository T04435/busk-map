# Qloo data map (as implemented on `dev/core`, 16 Oct 2026)

Qloo is Busk Map's taste layer. It decides who the crowd is, where in the city the act's taste concentrates, which venues nearby suit it, and which songs to play. Every number on screen comes from a tool or an adapter call, never from the model: the agent only picks among pitches the engine scored, and `finish_plan` rejects any number no tool returned. Other sources (City of Melbourne sensors, the council's busking layers, Ticketmaster, Last.fm, Spotify, Open-Meteo, OSM spots) adjust or check what Qloo says.

All Qloo traffic goes through one client, `src/server/adapters/qloo/client.ts`, wrapped by `src/server/adapters/qloo/index.ts`. Without a key, or in tests, the same client talks to the local mock (`src/server/qloo-mock`), and the UI labels the data "Qloo test data (local mock)".

## 1. Every distinct Qloo call

The client makes 14 kinds of call, which come in 19 shapes (`localArtists` is called three ways: #5, #5b and #5c; `affinityFor` two ways: #7 and #7b; `compareGenres` two ways: #11 and #11b; `demographics` two ways: #9 and #9b). "Row" means one request unless stated.

| # | Call (endpoint, type, key params) · `file:function` | Fields we use | Where it lands | How it's used |
|---|---|---|---|---|
| 1 | **`GET /search`** `query=<artist name>`, `types=urn:entity:artist`, `take=3`. The best match is kept, and a 404 means "no match". · `client.ts:searchArtist`, via `index.ts:resolveArtists` | `entity_id`, `name`. Also mapped: `properties.external.lastfm.listeners` | Resolving the act's artists (`context.ts:artists`), event headliners (`context.ts:eventTaste`, up to 6) and song artists not in "sounds like" (`context.ts:repertoire`). The week planner too (`week.ts`). "Qloo couldn't match X" alert (`plan-view.tsx`), crowd panel | Direct input. It is the entry point: every later call signals with these ids. Fallback after #2 |
| 2 | **`GET /entities`** `external.spotify.ids=<id>`, one id per request. · `client.ts:entitiesBySpotifyIds`, via `index.ts:resolveArtists` | `entity_id`, `name` | Same as #1, for artists picked from Spotify search | Combined with **Spotify** (the artist picker supplies the id, so the right namesake is picked). Tried first, then #1 |
| 3 | **`GET /v2/insights` `filter.type=urn:heatmap`** `signal.interests.entities=<act ids>`, `filter.location=<WKT POLYGON>` (the city planning box, longitude first). Retried once over a box twice as wide if empty. · `client.ts:heatmap`, via `index.ts:tasteMap` | `location.latitude/longitude/geohash`, `query.affinity`, `query.popularity` | **Taste map** (`plan-map.tsx`, cells drawn as geohash rectangles). **Pitch ranking**: candidate generation (`candidates.ts:topCells`, the top 30% of cells, snapped to OSM spots and sensors), `pitch-score.ts:tasteFactor`. Footfall proxy (`footfallFactor`, `"qloo-popularity"`). "How this plan was found" funnel line. Agent tool **`taste_map`** (can zoom to a smaller box or signal fewer artists, which makes a new call). **Week planner** (`week.ts`). `researchTotals.taste` | Direct input to the taste factor. Combined with **OSM spots**, **City of Melbourne sensors** and the **council's busking layers** to make candidates. Cell popularity is the last-resort footfall when there's no sensor nearby |
| 4 | **`GET /v2/insights` `filter.type=urn:entity:place`** `filter.location=<WKT POINT>` (city centre), `filter.location.radius=2000` (4000 on retry), `filter.hours=<weekday>` (omitted by the week planner), `signal.interests.entities`, `take=50`. · `client.ts:places`, via `index.ts:busyPlaces` | `entity_id`, `name`, `location.lat/lon`, `popularity`, `query.affinity`, `properties.hours`, `properties.live_music`, `properties.good_for[].name/weight`, `properties.keywords[].name/count` | **Pitch ranking**: `pitch-score.ts:placesFactor` (open places in the slot, weighted by popularity and distance). **Venue detail** on the pitch card ("Qloo: live music, pub, known for 'bands'", `lib/venue.ts`). Template "why" lines. Agent tool **`busy_places`** (any point, radius 200–1500 m). **Week planner** (hours checked per slot). `researchTotals.places` | Direct input to the places factor. Hours are checked against the slot (`scoring/hours.ts`). live_music, good_for and keywords are shown, not scored |
| 5 | **`GET /v2/insights` `filter.type=urn:entity:artist`** `signal.location=<WKT POLYGON>`, `signal.interests.entities=<act ids>`, `feature.explainability=true`, `take=20` (city box). The agent asks with `take=10` over a box around a point. · `client.ts:localArtists`, via `context.ts:localCrowd` | `entity_id`, `name`, `query.affinity`, per-result `query.explainability` (entity_id, score), top-level `query.explainability.effect_on_top10/top5/all/top3_recs`, `query.measurements.audience_growth`, `external.lastfm[].listeners` | **Crowd panel**: "Who this crowd likes" with the "because" artists and their scores, "What Qloo matched on" (drivers, from the top-10 effect, `assemble.ts:drivers`). **Songs to learn** (on the plan): the top 5 artists. Agent tool **`crowd_at`**. `researchTotals.crowds` | Direct input. Songs to learn is combined with **Last.fm** top tracks and listeners, and with #8 |
| 5b | Same call with **no interest signal** (the "usual crowd"): `signal.location=<WKT POLYGON>` about ±0.004° around the first usual hotspot, `take=20`, no explainability. · `context.ts:hotspotCrowd` → `client.ts:localArtists` | `entity_id`, `name`, `query.affinity` | **Crowd panel**: "Your fans vs the usual crowd", the group B input to #11 (its first 10 artists), and group A of the city over-index #11b (all 20) | Diff: the usual crowd vs the act's fans. Also the first step of the local scene |
| 5c | Same call as #5, over a **usual pitch** and signalled with the **Repertoire's artists**: `signal.location=<WKT POLYGON, 400 m around a usual pitch>`, `signal.interests.entities=<Repertoire ids>`, `feature.explainability=true`, `take=10`. · `learn/tools.ts:crowd_at` → `client.ts:localArtists` | `entity_id`, `name`, `query.affinity`, per-result `query.explainability`, `query.measurements.audience_growth` | **Songs to learn** (the learn run): the artists the crowd at one of your usual pitches likes, from fans of your songs. Learn tool **`crowd_at`**. `learnTotals.crowds` | Direct input to the learn agent, combined with #12. Usual pitches come from the top pitch of your last 3 plans |
| 6 | **`GET /v2/insights` `filter.type=urn:entity:artist`** `filter.results.entities=<song artists' ids>`, `signal.location=<WKT POINT>`, `signal.location.radius=400`, `take=<count>`. · `client.ts:affinityAt`, via `index.ts:artistAffinityAt` | `entity_id`, `query.affinity` | **Suggested set** per pitch (`context.ts:setlistFor` → `setlist.ts:buildSetlist`: 48% affinity). Agent tools **`build_setlist`** and **`compare_crowds`** ("your artists" at each pitch). Suggested set panel | Combined with **Last.fm** play counts, **Spotify** release years and #9's age lean. An artist Qloo leaves out at a point is "no local score", scored with a proxy |
| 7 | **`GET /v2/insights` `filter.type=urn:entity:artist`** `filter.results.entities=<event headliner ids>`, `signal.interests.entities=<act ids>`, no location, `take=<count>`. · `client.ts:affinityFor`, via `index.ts:tasteMatch` | `entity_id`, `query.affinity` | **Events**: `context.ts:eventTaste` → `pitch-score.ts` events factor (crowd weighted by match). Pitch card ("Qloo: X's fans match your taste 94/100"). Agent tool **`events_near`** (`headlinerMatch`) | Combined with **Ticketmaster** (headliners come from #1 on its artist names) |
| 7b | Same call as #7, for the **local scene**: `filter.results.entities=<the local scene list from #14>`, `signal.interests.entities=<act ids>`, no location, `take=<count>`. Re-scores the city's local acts for the act's fans. · `context.ts:localScene` → `client.ts:affinityFor` | `entity_id`, `query.affinity` | **Crowd panel**: "Local scene: X, Y: acts your fans would like" (`plan.crowd.localScene`). **Suggested set**: a song by a local act gets up to +0.10 on its 0–1 score (`setlist.ts:buildSetlist`, `LOCAL_SCENE_BONUS`) and the act's songs say so in their reason. **Suggested fill**: local acts are candidates (`fill.ts`). Agent tools **`crowd_at`** (`localScene`, additive) and **`build_setlist`** (`localScene: true` on a song) | Diff-style input, combined with #14. Cached per act and city |
| 8 | **`GET /v2/trending`** `signal.interests.entities=<one id>`, `filter.type=urn:entity:artist`, `filter.start_date`, `filter.end_date` (a 42-day window). One request per artist, up to 5. Window probing (`trendingWindow`): the same call for the top local artist, ending yesterday, then 91 days earlier each time, up to 5 probes. · `client.ts:trendingFor`, `trendingWindow`, `trending`, via `context.ts:rising` | `date`, `population_percent_delta`, `population_percentile` (→ `windowChange`) | **Songs to learn** ranking (2nd key, after audience growth). The **crowd panel** "Rising +N pts" badge (`windowChange` ≥ 1). Agent tool **`learn_these`**. A plan note when the data is stale | Direct input. If every row is flat, it is dropped and Songs to learn falls back (see §6) |
| 9 | **`GET /v2/insights` `filter.type=urn:demographics`** `signal.interests.entities=<act ids>`. · `client.ts:demographics`, via `index.ts:crowdProfile` | `query.age`, `query.gender` (signed lean per band, averaged over the act's artists) | **Crowd panel** "Who your fans are" (lean bars). **Suggested set** era fit (`ageLean`). Agent tool **`crowd_at`** (`fansAge`, `fansGender`) | Combined with **Spotify** release years for the Suggested set's era fit |
| 9b | Same call as #9, signalled with **your own artist alone** (`signal.interests.entities=<own Qloo id>`), so the answer is that artist's fans, not the blend of the artists you sound like. Only when the request carries `performer.ownArtist`. **One request per busk**, shared by every pitch, cached per own artist (the key holds the id). · `context.ts:ownFans` → `client.ts:demographics` | `query.age`, `query.gender` | **Crowd panel** "Who your fans are": "Your fans lean 25–29; this crowd leans 30–34" and a lean bar per age band for your own fans beside the crowd's (`plan.ownArtist.fans`). Optional (`OPTIONAL_QLOO`, key `ownFans`): if Qloo has no audience data for the artist the plan says so in a note and the block shows the crowd's lean only | Diff: your own fans vs the crowd (#9 over the blend of your artists) |
| 10 | **`GET /v2/insights` `filter.type=urn:tag`** `filter.tag.types=urn:tag:genre:music`, `filter.parents.types=urn:entity:artist`, `signal.interests.entities`, `signal.location=<WKT POINT>`, `signal.location.radius=400`, `take=6`. · `client.ts:crowdTags`, via `context.ts:crowdGenres` | `tag_id` (or `id`), `name` (trimmed), `query.affinity` | **Crowd panel** "Genres around <top pitch>". Agent tools **`crowd_at`** and **`compare_crowds`** (genres at each pitch) | Direct input (shown, not scored). Diff between two pitches in `compare_crowds` |
| 11 | **`GET /v2/analysis/compare`** `a.signal.interests.entities=<act ids>`, `b.signal.interests.entities=<usual crowd ids from 5b>`. · `client.ts:compareGenres`, via `context.ts:contrast` | `results.a[]` and `results.b[]`: `tag_id`, `name`, `subtype` (music genres only), `query.count` → share of the group | **Crowd panel**: "your fans lean more towards X, less towards Y" (differences of 0.15 or more) | Diff: the act's fans vs the usual crowd |
| 11b | Same call as #11, for the **city over-index** (local scene step 1): `a.signal.interests.entities=<the usual crowd's top 20 from #5b>`, `b.signal.interests.entities=<the global-pop artists from #13>`. Genres whose share in a beats b by 0.15 or more, biggest gap first, at most 7 (the single biggest gap if none reaches 0.15). · `context.ts:localScene` → `client.ts:compareGenres` | `results.a[]` and `results.b[]`: `tag_id`, `name`, `subtype` (music genres only), `query.count` → share of the group | The genre handles that #14 searches with. **Crowd panel**: the genres named in the "Local scene" line. Agent tool **`crowd_at`** (`localScene.genres`) | Diff: the city's crowd vs global pop. Cached per city (the key is the two id lists) |
| 12 | **`GET /v2/insights` `filter.type=urn:entity:artist`** `signal.interests.entities=<Repertoire ids>`, `feature.explainability=true`, `take=20`, **no location**. · `learn/tools.ts:related_artists` → `client.ts:tasteArtists` | `entity_id`, `name`, `query.affinity`, per-result `query.explainability` (which of your artists explain each), `query.measurements.audience_growth`, `external.lastfm[].listeners` | **Songs to learn**: the artists whose fans overlap your Repertoire's fans, anywhere. Learn tool **`related_artists`**. `learnTotals.liked` | Direct input to the learn agent. Never signalled with an artist Qloo could not match (#1, #2) |
| 13 | **`GET /v2/insights` `filter.type=urn:entity:artist`** with **no signal and no location**, `take=20`. Qloo's globally popular artists: the "global-pop set" #11b measures the city against. · `client.ts:globalArtists`, via `index.ts:globalArtists` | `entity_id`, `name` | Group b of #11b. Not shown | Direct input to #11b. The same for every city, so one request serves every busk until the cache expires |
| 14 | **`GET /v2/insights` `filter.type=urn:entity:artist`** `signal.location=<WKT POLYGON, the city planning box>`, `signal.interests.tags=<the genre ids from #11b>`, `take=20`, **no artist signal** (the act would swamp the location). The local scene list. · `client.ts:sceneArtists`, via `index.ts:sceneArtists` | `entity_id`, `name` | Re-scored for the act's fans by #7b. Not shown on its own | Direct input to #7b. Shared by every act in the city (the key is the tags and the box) |

**Your own artist in the taste signal** (`performer.ownArtist`, resolved from the saved Spotify link by #2). When a request carries it, the entity id goes FIRST in `signal.interests.entities` for every read that is signalled with your artists (#3 heatmap, #4 places, #5 local artists, #6 and #7 affinities, #9 demographics, #10 tags, #11 compare and the local scene). Qloo's `signal.interests.entities` takes no weights, so the weight is position and inclusion: the own entity leads and Qloo's explainability reports how much it drove each pick (`plan.ownArtist.share`, shown as "from your music"). It adds no new kind of call, and every cache key carries the id list, so an act with a different own artist never reuses another act's answer. If the heatmap finds nothing with the own entity but something without it, the own entity is dropped for the whole plan, which falls back to the artists you sound like (one extra heatmap request, key `taste:soft`, plus a plan note). A mock id (4D4F434B-…) is never sent to live Qloo.

**The local scene** (`context.ts:localScene`; `scoring/local-scene.ts` holds the pure parts). In English-speaking cities the crowd at a pitch comes back as global pop (research/cities/cities.md, "WHAT: options tested"). The two steps that work:
1. **City over-index**: #13 gives the global-pop artists; #11b compares the usual crowd's top 20 (#5b) against them. The genres the crowd over-indexes on by 0.15 or more are the city's handles, 1–7 of them.
2. **Local scene**: #14 (location plus the handles as `signal.interests.tags`) lists the local acts; #7b re-scores them for the act's fans ("local acts your fans would like").
It costs up to 4 requests on a cold busk (#13, #11b, #14, #7b). #13, #11b and #14 are shared by every act in the city and #13 by every city, so a second busk in the same city sends only #7b. All four are optional (`OPTIONAL_QLOO`, prefix `scene:`): if one fails or finds nothing, the plan keeps today's behaviour and says why in a plan note. Skipped on purpose, because the research showed they do not work: radius changes, `signal.location.weight`, `filter.popularity.max` (it surfaces celebrities) and `bias.trends`. Request-shape deviations from the research: the usual crowd is the existing hotspot read (a box of about ±0.004° around the first usual hotspot, not a 2 km box; the research found area size makes no difference), and the global-pop set is Qloo's own unsignalled artist list, not the research's "artists in 10+ of 30 city lists".

**The plain-AI comparison** (`agent/compare.ts`, `scoring/baseline.ts`, `compare-panel.tsx`) makes **no Qloo call** of its own. The plain model gets no data. Its spots are then located and scored with the engine's own `scoreInputs` (#3, #4, #7 and the other sources). The panel is a diff, plain AI vs Busk Map, and shows Qloo's taste factor and cell rank for each side.

**Pitch ranking** (`scoring/pitch-score.ts:scorePitch`) combines taste (#3), places (#4) and events (#7 on Ticketmaster) with sensor footfall, Open-Meteo weather and the council's rules. The weights are fixed per plan and shown in the UI.

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
| Taste signals from **genres** (`signal.interests.tags`), not just artists, for `taste_map` | Hackathon `spec.md`, agent design table ("signals = the performer's artists or genres"). The mock supports `signal.interests.tags` (`docs/qloo-mock.md`); the client sends it only in the local scene list (#14), not for `taste_map` | planned, not built |
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
| Cold run, each of the 3 presets (mock model + Qloo mock, data cache emulated as in `tests/unit/agent/qloo-usage.test.ts`) | 33 | 1 | re-measured 16 Oct on `dev/core` before the local scene |
| Identical rerun, same setup | 0 | 29 | same |
| Cold run, each of the 3 presets, with the local scene (+4: #13, #11b, #14, #7b) | 37 | 1 | `feat/local-scene`, 17 Oct, same setup |
| Identical rerun, same setup | 0 | 33 | same |
| A second busk in the same city, another act | #7b, #11 and the act's own reads | – | `tests/unit/agent/local-scene.test.ts`: the usual crowd, #13, #11b and #14 are cache hits |

What the 33 cold calls (37 with the local scene) are made of:
- 7 `/search`: act artists, event headliners and song artists.
- 1 heatmap and 1 places call.
- 9 artist insights: the city crowd, the usual crowd, event match, suggested-set affinity per top pitch, and the agent's `crowd_at` and `compare_crowds`.
- 3 `urn:tag`, 1 demographics and 1 compare.
- The local scene adds 4: the global-pop artists (#13), a second compare (#11b), the scene list (#14) and its re-score (#7b).
- 7 trending: window probes plus up to 5 artists. The 1 cold hit is the probe artist's row being reused.

The count depends on which tools Claude chooses, so live runs vary. The mock planner calls more tools than the 16 Oct runs did.

**The week planner** (`week.ts`) makes about N+2 calls: N `/search` or `/entities`, one heatmap and one places call (no `filter.hours`). It isn't counted in `researchTotals`. The no-prefetch comment on the week link in `plan-view.tsx` gives the same count ("about N+2 Qloo calls": one artist lookup per act artist, one heatmap, one places). The one heatmap and one places answer are reused for every slot of the week, which is why /brain lists the week planner under taste cells and open places.

**Per learn run** (`Songs to learn`, docs/playlist-architecture.md §2.9; budget `LEARN_QLOO_BUDGET = 25` in `playlist/config.ts`, shown on /brain as "≤ 25"). Spotify and Last.fm calls are not Qloo quota.

| Part | Calls | Cold cap | Typical |
|---|---|---|---|
| `match_playlist` | #1 `/search` or #2 `/entities` | ≤ 10 | 0 (ids stored) |
| `related_artists` | #12 | ≤ 2 | 1 |
| `crowd_at` | #5c | ≤ 3 | 2 |
| `rising` | #8 window probes, then trending per artist | ≤ 15 | 5 |
| `crowd_profile` | #9 | ≤ 1 | 0–1 |
| Measured with the mock model and Qloo mock (`tests/unit/learn/qloo-budget.test.ts`) | | 14 requests | 0 warm (10 cache hits) |

Before each Qloo tool the run checks that its worst case fits the 25; over it the tool returns "budget used up" instead of calling. `trendDelta` on a suggestion comes from #8 and is in percentile points over the window (`windowChange`), never the weekly `population_percent_delta`.

**Quota.** 10,000 requests a month per key, at 5 a second. At 28–37 calls per cold busk (live 24–28 measured before the local scene, plus its 4; mock 37 measured; one more, #9b, when the act has an own artist; the Brain range leaves it out), that is roughly 270–360 cold busks a month. Cached reruns cost nothing.

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
- **`audience_growth` returns 0** for every artist checked. So the plan's Songs to learn rank by audience growth, then trending delta, then Qloo affinity, then Last.fm listeners. A plan note says so when it falls back (`context.ts:rising`, `setlist.ts:learnThese`).
- **Shortlists at a point drop some artists.** `filter.results.entities` with a location signal silently leaves some out (Stevie Wonder, for example). That means "no local score here", not "no match": the setlist uses a proxy affinity.
- **Shapes differ by endpoint.**
  - Last.fm listeners: an object under `properties.external` on lookups, a list under `external` on insights.
  - Places can send `tags: null`.
  - Place hours use lowercase weekdays and run past midnight.
- **Qloo silently ignores bad parameters.** An empty result is logged with the parameter names sent (`logIfEmpty`).
- **The slowest calls take up to 7.8 s** (`urn:tag`, large place lists), hence the 15 s timeout. Optional calls that fail add a plan note instead of failing the plan (`context.ts:OPTIONAL_QLOO`). Only resolving and the taste map are required.

## 6. Other sources behind the same features (Spotify, Last.fm)

Not Qloo, but drawn on /brain (dashed) and drift-tested against the code (`tests/unit/lib/qloo-map.test.ts`).

| Source | Call · `file:function` | Where it lands |
|---|---|---|
| Spotify | `/v1/search?q=artist:"…"&type=track` · `repertoire/client.ts:searchArtistTracks`, via `repertoire/index.ts:findArtistTracks` and the learn tool `top_tracks` | **Songs to learn**: the songs of the artists a learn run chooses (the top-tracks endpoint answers 403, so tracks are searched by artist and matched by name). Cached for days |
| Last.fm | `artist.gettoptracks` · `songs/client.ts:fetchTopTracks`, via `songs/index.ts:getSongs` | Play counts (**Suggested set** popularity, about a third of a song's score; the plan's **Songs to learn** ranking) and the **songs backup**: `top_tracks` takes an artist's songs from Last.fm when Spotify has none (its songs carry no year, length or cover). Cached for weeks |
| Last.fm | `artist.getinfo` · `songs/client.ts:fetchArtistListeners`, via `songs/index.ts:getListeners` | Listener counts beside the artists in the picker. Not part of the Brain graph |

On /brain, Last.fm is the third secondary source. It feeds two data points: "Song plays" (Suggested set, the agent's `build_setlist` and `learn_these` tools) and "Songs by those artists" (Songs to learn, as the backup). A new or removed Last.fm request fails the drift test until the map changes.

User-facing names: **Suggested set** (was Setlist; the wire field `setlist` and the tool `build_setlist` keep their names), **Songs you should learn** (was Learn these; wire field `learnThese`, tool `learn_these`), Repertoire (never "Playlist"). All of it reads from `src/lib/playlist-copy.ts`.
