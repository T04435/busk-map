# Local Qloo mock

Busk Map talks to Qloo through one client (`src/server/adapters/qloo/client.ts`). With the hackathon key set it calls live Qloo, and the UI says **"Live Qloo data"**. Without a key (and in tests), the same client runs against a local mock of Qloo's HTTP contract (`src/server/qloo-mock/`), and every plan made this way is labelled **"Qloo test data (local mock)"**.

## When the mock is used

| Situation | Qloo backend |
|---|---|
| `QLOO_API_KEY` set | live: `https://hackathon.api.qloo.com` |
| `QLOO_API_KEY` missing, blank or `SET_ME` | mock |
| `QLOO_MOCK=1` (even with a key) | mock |
| `BUSKMAP_OFFLINE=1` (e2e, CI) | mock |

## How it works

- **In-process (what the app uses).** In mock mode the client's base URL becomes `https://qloo-mock.invalid` and its `fetch` is `qlooMockFetch`, which hands the `Request` to `handleQlooMock`. Nothing else changes: the same URL building, `X-Api-Key` header, status handling, Zod validation and caching run as they will in production. No server or port is needed, so it works in Vitest, in `next build` and on Vercel.
- **Over HTTP (for curl).** `GET /api/_mock/qloo/<path>` serves the same handler. It is on in development and preview, and off in production unless `QLOO_MOCK_ROUTE=1`. Example:

  ```bash
  curl -H 'X-Api-Key: anything' 'http://localhost:3000/api/_mock/qloo/search?query=Paul%20Kelly&types=urn:entity:artist'
  ```

  You can also point the client at it with `QLOO_API_BASE_URL=http://localhost:3000/api/_mock/qloo` and any `QLOO_API_KEY`.
- **Cache safety.** Every cached Qloo call takes the backend (`live` or `mock`) as an argument, so mock responses can never be served as live data after the key arrives.

## What it implements

Checked against docs.qloo.com on 2026-10-15, then **verified against live responses from the hackathon host on 2026-10-15** (shapes only; no Qloo data is stored here).

| Endpoint | Parameters |
|---|---|
| `GET /search` | `query`, `types`, `take`, `page` |
| `GET /entities` | `entity_ids`, `external.spotify.ids` |
| `GET /v2/insights` | `filter.type` = `urn:entity:artist`, `urn:entity:place`, `urn:heatmap`, `urn:demographics`, `urn:tag`; `signal.interests.entities`, `signal.interests.tags`; `signal.location` (+ `.radius`, `.query`); `filter.location` (`lat,lon`, WKT POINT/POLYGON/MULTIPOLYGON, locality id), `filter.location.query`, `filter.location.radius`; `filter.hours`, `filter.tags`, `filter.popularity.min/max`, `filter.results.entities`, `filter.exclude.entities`, `filter.tag.types`, `filter.parents.types`, `sort_by`; `feature.explainability`; `take`, `page`, `offset` |
| `GET /v2/trending` | `signal.interests.entities`, `filter.type`, `filter.start_date`, `filter.end_date` (required) |
| `GET /v2/analysis/compare` | `a.signal.interests.entities`, `b.signal.interests.entities` (required) |
| `GET /v2/tags` | `filter.query` (music genres) |

Behaviour taken from the docs:
- `X-Api-Key` is required: 401 `{"message":"No API key found in request"}` without it. Only GET exists; anything else is 404 "No path matching request parameters".
- Missing `filter.type` is 400; an unknown `urn:entity:*` is 403 "You do not have permission to access …"; a valid type the mock has no data for (movies, books…) is a 200 with empty `entities`.
- Parameters that are not valid for a `filter.type` are **silently ignored**, using the Entity Type Parameter Guide (for example `filter.hours` or `filter.location` on artists). A request whose only signal is an unknown tag gets 400 "at least one valid signal or filter is required".
- `take` defaults to 20 and is capped at 50 (400 above that).
- Locations outside the mock's coverage (inner Melbourne), or unreadable ones, give an empty 200.
- `/search` and `/entities` answer 404 "No results" when nothing matches, as their OpenAPI pages document. The client treats that as "no match", not an outage.

### Response shapes (VERIFIED against live, 2026-10-15)

- **Explainability.** Per result: `query.explainability = {"signal.interests.entities": [{entity_id, score}]}`. Top level: `query.explainability["signal.interests.entities"] = {effect_on_top3_recs: [{entity_id, avg_score}], effect_on_top5_recs, effect_on_top10_recs, effect_on_all_recs}`. Busk Map's "who drives your crowd" uses the top-10 effect. (The mock used to send `average_impact.top_3…`; that was wrong.)
- **Place hours.** `properties.hours` has **lowercase** weekday keys, each a list of `{opens: "T12:00:00", closes: "T02:00:00", closed: false}`; a closed day is `[{opens: null, closes: null, closed: true}]`. A closing time at or before the opening time runs **past midnight** into the next day. Places carry `location: {lat, lon, geohash}` and `query.distance` in metres. `tags` can be `null`.
- **Heatmap.** Cells `{location: {latitude, longitude, geohash}, query: {affinity, affinity_rank, popularity, entity_artist_affinity, entity_artist_affinity_rank}}`. Over the central-Melbourne polygon the cells are **geohash precision 7** (about 150 m), roughly 70 to 420 cells depending on the artists. `affinity` is a rank within the response (1 for the best cell down to 0). Never use `filter.location.query=Melbourne`: live resolves it to "Melbourne, City of Knox", 1,170 cells across the metro. Busk Map always sends a WKT polygon (longitude first) for the city, and a point plus radius for a pitch.
- **Entities by lookup.** `/search` and `/entities` send `types: [...]` (a list, no `type`/`subtype`), tags keyed **`tag_id`** (plus `value`), and `properties.external.lastfm = {id, listeners, scrobbles}`. Insights results send `type`/`subtype`, tags keyed `id`, and a top-level `external.lastfm = [{id, listeners, scrobbles}]`. Busk Map reads Last.fm listeners from either.
- **Taste tags (`urn:tag` insights).** Rows `{tag_id, name, types, subtype, tag_value, popularity, query: {affinity}}`. Names can arrive padded (" indie"): the client trims them, and the mock pads one name to keep that tested.
- **Trending.** Rows `{date, population_percentile, population_rank, population_rank_velocity, velocity_fold_change, population_percent_delta}`, newest first, no entity id (so one request per artist). `population_rank` is a **string**; `population_percentile` is a **0–1 fraction**. **Recent weeks are empty**: nothing from about mid-May 2026 on when checked, and the values found were flat. The client probes back a quarter at a time, up to a year, for the latest window with data, and caches it. The mock's series ends on 2026-05-13 to match.
- **Compare (`/v2/analysis/compare`).** `results = {tags: [...], a: [...], b: [...], matchEntities: []}`. `a` and `b` list each group's tags as `{tag_id, name, type, subtype, entity_id, popularity, query: {count}}`, where `count` is a string: how many of the group's entities carry the tag. `tags` lists shared tags with a similarity `query.score` and the two groups' entities. There is **no per-group affinity**, and `filter.subtype` and `take` are ignored. Busk Map turns each music genre's count into a share of its group (0–1) and compares the shares.
- **Tag search (`/v2/tags`).** `results.tags` rows are `{id, name, type, popularity, parents: [{type}], properties: {description, …}, tags}`: keyed **`id`**, unlike the insights tags.
- **Rate limits** (response headers): 5 requests a second and 10,000 a month per key. Bursts of 4 still drew 429s, so the client starts at most 3 live requests a second and retries a 429 twice after about a second.

## The data

All deterministic: the same request always gets the same answer.
- **Artists** (`catalog.ts`): about 130 real artist names with invented genre weights, popularity and ids. Ids are UUID-shaped and start with `4D4F434B` ("MOCK" in hex), so they can't be mistaken for Qloo ids. Like real Qloo, a name the catalogue doesn't hold is **no match**: `/search` answers 404 "No results" (partial matches need at least four characters), and `/entities` does the same for an unknown id. The plan then shows "Qloo couldn't match X" and uses the artists that did match; when none match, taste is left out, the plan says so, and the live agent isn't run (no tokens spent).
- **Taste field** (`taste-field.ts`): Gaussian "anchors" per genre over central Melbourne, for example jazz and neo-soul around Bennetts Lane and the Southbank arts precinct, folk at the market and the Carlton fringe, singer-songwriters along Flinders Lane, pop in the Bourke Street Mall. A heatmap cell's affinity is the taste concentration for the signal's genre mix minus a share of plain busyness, so quiet pockets with the right crowd can outrank the busiest corner.
- **Places** (`data/osm-places.ts`, `places.ts`): 527 real venues (bars, pubs, theatres, record shops, markets, stations, cafes and more) from OpenStreetMap, © OpenStreetMap contributors, ODbL 1.0. Names, coordinates, addresses and tagged opening hours are OSM's; popularity, audience taste and missing hours are invented.
- **Trending**: weekly series per artist with its own trend and wobble; local neo-soul and indie-folk acts lean upward.
- **Demographics**: per-genre age and gender leanings, mixed per artist.

Nothing here is Qloo data, and no Qloo response is stored in the repository.
