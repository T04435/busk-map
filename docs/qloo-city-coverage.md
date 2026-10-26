# Qloo city coverage probe

Run on 2026-10-17 against the live Qloo hackathon API (`https://hackathon.api.qloo.com`). Qloo only, no model calls.
Script: `scripts/probe-qloo-cities.mjs` (re-run with `node --env-file=.env.local scripts/probe-qloo-cities.mjs`).
It prints aggregates only. Qloo responses are cached privately server-side. No Qloo response data is kept in this repo: no locality ids, counts or artist names from live responses.

## Method

The script calls the Qloo HTTP API directly, because the adapter is `server-only` and uses Next's cache. It uses the same base URL, `X-Api-Key` header, parameters and pacing as `src/server/adapters/qloo/client.ts`: 3 requests a second, 429 retried after 1.1 s.

- **Signal:** the same 3 well-known artists for every city (Coldplay, Ed Sheeran, Beyoncé), resolved once with `/search`.
- **Area:** a 2 km x 2 km WKT polygon around fixed city-centre coordinates (the app's polygon approach). Places use the app's call shape: WKT point, radius 2000 m, `take=50`, no `filter.hours`.
- **Locality:** `/search?query=<city>&types=urn:entity:locality&take=5`. Right = the top hit's centre is within 25 km of the city-centre coordinates. "Any <=25 km" says whether one of the 5 hits was.
- **Heatmap:** `urn:heatmap` over the polygon. "Meaningful" = `affinity >= 0.5`. Affinity is a rank within the response (1 down to 0), so about half the cells pass by construction. Total cells is the more telling number.
- **Places:** `urn:entity:place`, 50 requested. "With hours" = at least one day with an open range.
- **Artists:** `urn:entity:artist` with `signal.location` = the polygon, the 3 signal artists and `feature.explainability`, `take=20`.

## Results

All 12 probed cities (Melbourne, Sydney, Brisbane, London, New York, Los Angeles, Toronto, Paris, Berlin, Tokyo, Mexico City, Austin) came out **good** under the rules below: the heatmap, places and artists calls all returned enough results everywhere. The per-city counts, locality ids and artist names are not recorded here; re-run the script to see them.

**Locality names are not safe to resolve by.** The top `/search` hit for a city name was often the wrong place: a suburb or council area for Melbourne, a state-level hit for New York, the prefecture for Tokyo. Every city had a correct hit within the top 5, but the app never resolves by name, and its WKT polygon is right.

**Artists are not local anywhere.** With a shared global-pop signal, the top artists were the same global pop acts in all 12 cities. That signal probably dominates the location signal, so this probe cannot tell whether a city has local-scene artists. It only shows that the call works everywhere. A local-scene check needs a signal from a local act in each city.

## Verdict rules

- **good:** heatmap >= 100 cells with >= 50 meaningful (affinity >= 0.5), and places >= 30 with >= 20 having opening hours, and artists >= 10 returned.
- **thin:** the call works but is under a good threshold (for example 20 to 99 cells, 5 to 29 places, fewer than 20 with hours, or 1 to 9 artists).
- **none:** any of the three returns 0 results or an error.
- Locality is reported but not part of the verdict: the app never resolves by name. Local-looking artists are reported but not scored (see the caveat above).

All 12 cities are **good** by these rules. The lowest figures are Brisbane and Mexico City (163 cells) and London and New York (26 places with hours).

## What "thin" looks like in the app

Fewer candidate pitches, a flat taste map (few cells to rank, so the taste factor barely separates spots), crowd and "usual crowd" panels full of generic mainstream artists, and plan notes about falling back to the wider box or radius.

## Quota

51 Qloo requests: 3 artist lookups, then per city 1 locality search, 1 heatmap, 1 places and 1 artists call (12 x 4 = 48). No 429 retries occurred. That is about 0.5% of the 10,000 a month limit per key.
