# Qloo city coverage probe

Run on 2026-10-17 against the live Qloo hackathon API (`https://hackathon.api.qloo.com`). Qloo only, no model calls.
Script: `scripts/probe-qloo-cities.mjs` (re-run with `node --env-file=.env.local scripts/probe-qloo-cities.mjs`).
It prints aggregates only. No Qloo response data is stored in the repo (Qloo terms); the names below are a 5-name sample per run.

## Method

The script calls the Qloo HTTP API directly, because the adapter is `server-only` and uses Next's cache. It uses the same base URL, `X-Api-Key` header, parameters and pacing as `src/server/adapters/qloo/client.ts`: 3 requests a second, 429 retried after 1.1 s.

- **Signal:** the same 3 well-known artists for every city (Coldplay, Ed Sheeran, Beyoncé), resolved once with `/search`.
- **Area:** a 2 km x 2 km WKT polygon around fixed city-centre coordinates (the app's polygon approach). Places use the app's call shape: WKT point, radius 2000 m, `take=50`, no `filter.hours`.
- **Locality:** `/search?query=<city>&types=urn:entity:locality&take=5`. Right = the top hit's centre is within 25 km of the city-centre coordinates. "Any <=25 km" says whether one of the 5 hits was.
- **Heatmap:** `urn:heatmap` over the polygon. "Meaningful" = `affinity >= 0.5`. Affinity is a rank within the response (1 down to 0), so about half the cells pass by construction. Total cells is the more telling number.
- **Places:** `urn:entity:place`, 50 requested. "With hours" = at least one day with an open range.
- **Artists:** `urn:entity:artist` with `signal.location` = the polygon, the 3 signal artists and `feature.explainability`, `take=20`.

## Results

| City | Locality resolved (top hit, id, distance) | Heatmap cells (total / meaningful) | Places (total / with hours) | Artists (count, local?) | Verdict |
|---|---|---|---|---|---|
| Melbourne | No: "Melbourne" `926C7106-54C9-4282-BE9B-59740E424698`, 27 km off (the Knox one; a 2nd hit is within 25 km) | 216 / 108 | 50 / 39 | 20, no: Katy Perry, Adele, Taylor Swift | good |
| Sydney | No: "Sydney" `0F9C5FE4-0CF0-4892-848D-97E8374FBB88`, 29 km off (a 2nd hit is within 25 km) | 190 / 95 | 50 / 29 | 20, no: same names | good |
| Brisbane | Yes: "Brisbane" `5119DE3E-2BE5-4228-88D5-63B509E4CB76`, 4 km | 163 / 82 | 50 / 35 | 20, no: same names | good |
| London | Yes: "London" `4F18635D-75D6-43EC-B8B9-8DFAEB8C5A29`, 1 km | 266 / 133 | 50 / 26 | 20, no: same names | good |
| New York | No: "New York" `BDFC9271-4583-412E-84D8-F285BB8220FE`, 275 km off (state-level; a 2nd hit is within 25 km) | 221 / 111 | 50 / 26 | 20, no: Katy Perry, Adele, Maroon 5 | good |
| Los Angeles | Yes: "Los Angeles" `10F17338-97FE-40A3-9434-F6D59F000A9E`, 16 km | 176 / 88 | 50 / 36 | 20, no: same names | good |
| Toronto | Yes: "Toronto" `21B069AF-1377-44DB-937F-87AC8B45A072`, 8 km | 224 / 112 | 50 / 39 | 20, no: same names | good |
| Paris | Yes: "Paris" `E60F73CC-47E3-4B80-AB16-BA3D2341BBDE`, 1 km | 260 / 130 | 50 / 33 | 20, no: same names | good |
| Berlin | Yes: "Berlin" `302C82B3-3EB5-43A8-9A74-6AE11368E716`, 2 km | 247 / 124 | 50 / 28 | 20, no: same names | good |
| Tokyo | No: "東京都" (the prefecture) `1576B6BC-C790-4C9A-878C-EF722DB7814A`, 640 km off (a 2nd hit is within 25 km) | 181 / 91 | 50 / 37 | 20, no: same names | good |
| Mexico City | Yes: "Ciudad de México" `6A479AAF-1D8D-4EA2-AC1E-29B0906063AC`, 6 km | 163 / 82 | 50 / 35 | 20, no: same names | good |
| Austin | Yes: "Austin" `C93C0541-F43D-484E-AC86-E27A54E5B1D0`, 3 km | 172 / 86 | 50 / 37 | 20, no: same names | good |

Melbourne's top-hit coordinates are 27 km off the CBD, which fits the known City of Knox mis-resolution. Sydney, New York and Tokyo also have a wrong top hit. Names alone are not safe: the app's WKT polygon is right.

**Artists are not local anywhere.** The top 5 are the same global pop acts (Katy Perry, Adele, Taylor Swift, Bruno Mars, plus one of One Direction, Maroon 5, Sam Smith or Justin Bieber) in all 12 cities. The shared global-pop signal probably dominates the location signal, so this probe cannot tell whether a city has local-scene artists. It only shows that the call works everywhere. A local-scene check needs a signal from a local act in each city.

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
