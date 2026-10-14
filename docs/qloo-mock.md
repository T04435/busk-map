# Local Qloo mock

Busk Map talks to Qloo through one client (`src/server/adapters/qloo/client.ts`). Until the hackathon key arrives, that same client runs against a local mock of Qloo's HTTP contract (`src/server/qloo-mock/`). Every plan made this way is labelled **"Qloo test data (key pending)"** in the UI.

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

Checked against docs.qloo.com on 2026-10-15 (Insights deep dive, Entity Type Parameter Guide, Heatmaps, Demographics, Taste Analysis, Trending, Search, Entities, Analysis Compare, hackathon developer guide).

| Endpoint | Parameters |
|---|---|
| `GET /search` | `query`, `types`, `take`, `page` |
| `GET /entities` | `entity_ids`, `external.spotify.ids` |
| `GET /v2/insights` | `filter.type` = `urn:entity:artist`, `urn:entity:place`, `urn:heatmap`, `urn:demographics`, `urn:tag`; `signal.interests.entities`, `signal.interests.tags`; `signal.location` (+ `.radius`, `.query`); `filter.location` (`lat,lon`, WKT POINT/POLYGON/MULTIPOLYGON, locality id), `filter.location.query`, `filter.location.radius`; `filter.hours`, `filter.tags`, `filter.popularity.min/max`, `filter.results.entities`, `filter.exclude.entities`, `filter.tag.types`, `filter.parents.types`, `sort_by`; `feature.explainability`; `take`, `page`, `offset` |
| `GET /v2/trending` | `signal.interests.entities`, `filter.type`, `filter.start_date`, `filter.end_date` (required) |
| `GET /v2/analysis/compare` | `a.signal.interests.entities`, `b.signal.interests.entities` (required), `filter.subtype` |
| `GET /v2/tags` | `filter.query` (music genres) |

Behaviour taken from the docs:
- `X-Api-Key` is required: 401 `{"message":"No API key found in request"}` without it. Only GET exists; anything else is 404 "No path matching request parameters".
- Missing `filter.type` is 400; an unknown `urn:entity:*` is 403 "You do not have permission to access …"; a valid type the mock has no data for (movies, books…) is a 200 with empty `entities`.
- Parameters that are not valid for a `filter.type` are **silently ignored**, using the Entity Type Parameter Guide (for example `filter.hours` or `filter.location` on artists). A request whose only signal is an unknown tag gets 400 "at least one valid signal or filter is required".
- `take` defaults to 20 and is capped at 50 (400 above that).
- Locations outside the mock's coverage (inner Melbourne), or unreadable ones, give an empty 200.
- `/search` and `/entities` answer 404 "No results" when nothing matches, as their OpenAPI pages document. The client treats that as "no match", not an outage.

Shapes the docs do not show in full, so they are the mock's reading of the parameter descriptions and **must be checked against live responses** (UNVERIFIED):
- `query.explainability` per result: `{"signal.interests.entities": [{"entity_id", "score"}]}`, scores 0–1, only ≥ 0.1; and the top-level aggregate `{"signal.interests.entities": [{"entity_id", "average_impact": {"top_3", "top_5", "top_10", "all"}}]}`.
- Place `properties.hours`: `{"Monday": [{"opens": "T11:00", "closes": "T23:00"}]}`, plus `location: {lat, lon, geohash}` and `query.distance` in metres.
- `/v2/analysis/compare` rows: `{tag_id, name, subtype, query: {a: {affinity}, b: {affinity}, delta}}`.
- `/v2/trending` with several entities: the docs describe one entity's series and rows carry no entity id, so the client asks once per artist.
- Heatmap resolution: geohash precision 6, as in the docs' NYC example. The real resolution for a small polygon may differ.

## The data

All deterministic: the same request always gets the same answer.
- **Artists** (`catalog.ts`): about 130 real artist names with invented genre weights, popularity and ids. Ids are UUID-shaped and start with `4D4F434B` ("MOCK" in hex), so they can't be mistaken for Qloo ids. Unknown names get a generated profile (marked in `disambiguation`) instead of no match, because Qloo's real graph knows far more artists.
- **Taste field** (`taste-field.ts`): Gaussian "anchors" per genre over central Melbourne, for example jazz and neo-soul around Bennetts Lane and the Southbank arts precinct, folk at the market and the Carlton fringe, singer-songwriters along Flinders Lane, pop in the Bourke Street Mall. A heatmap cell's affinity is the taste concentration for the signal's genre mix minus a share of plain busyness, so quiet pockets with the right crowd can outrank the busiest corner.
- **Places** (`data/osm-places.ts`, `places.ts`): 527 real venues (bars, pubs, theatres, record shops, markets, stations, cafes and more) from OpenStreetMap, © OpenStreetMap contributors, ODbL 1.0. Names, coordinates, addresses and tagged opening hours are OSM's; popularity, audience taste and missing hours are invented.
- **Trending**: weekly series per artist with its own trend and wobble; local neo-soul and indie-folk acts lean upward.
- **Demographics**: per-genre age and gender leanings, mixed per artist.

Nothing here is Qloo data, and no Qloo response is stored in the repository.
