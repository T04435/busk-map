# Plan inputs: architecture note (any time, suggested fill, one search)

Status: **proposal, no code yet**. 17 Oct 2026, `dev/core`. It goes to MANAGER and the user before building.
Input: `hackathon/hackathons/qloo-2026/dev-brief-plan-inputs.md` and BRAND's handoff `design-handoff/playlist/` (restyle-notes, components.md `RepertoireSource` and `TimeSlotPicker anyTime`, inventory P02, P03, P05, P06, W01).
"Exists" means it is in the code today, cited as `file:function`. "Proposed" means new.

## 0. Decisions needed from you

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | The shape of "any time" in the request | **`slot` becomes a union: `{date, startHour, endHour}` or `{date, any: true}`** | Old requests parse unchanged, so stored plans keep their hash and their saved run (§1.3). One field, so no "slotMode says any but the hours are set" state |
| D2 | Which windows "any time" considers | **3-hour windows starting on every hour from 10 am to 7 pm (10 windows, the last one 7–10 pm)**. On today's date, only windows that start after the current hour | Same 10 am–10 pm day as the week planner (`scoring/week.ts:WEEK_SLOTS`), and the same 3-hour length as the default 6–9 pm slot. Hourly starts catch an event letting out at 9:30 pm, which the week's 4 fixed blocks miss |
| D3 | One window per busk or per pitch | **Each pitch gets its own best window** (BRAND's P06 copy: "Each pitch gets its own time"). The pitch is ranked by its best window's score | The three pitches are alternatives, not a route. The best hour differs by place (an office forecourt at lunch, a venue strip at 9 pm) |
| D4 | The fill flag | **A count, `performer.fillSuggested: 1–8`** (absent means off). The form sends the number of songs removed for this busk, at least 3; after Remove all or with an empty Repertoire it sends 6 | A count says how many suggested songs to add. A bare boolean leaves the server to guess. Absent rather than `false` keeps old hashes (§1.3) |
| D5 | Where suggested songs come from | **Deterministic, no agent run:** the plan's own crowd artists plus Qloo related artists, ranked per pitch by the per-pitch affinity call the set already makes, then songs from Spotify (Last.fm as backup). **+1 Qloo call per cold busk** | §3.1. The learn run's reads per pitch would cost +4 calls and a second agent. The plan already holds most of the data |
| D6 | Can a song you removed come back as a suggestion? | **No.** The form sends the removed songs in `performer.skipSongs`, and the fill leaves them out, as it leaves out songs already in the set | Without it, Remove all could hand back your own songs as "suggested" |
| D7 | Do suggested songs enter your Repertoire history? | **No, not unless you tap "Add to Repertoire"** on one. That uses the existing route and lands it under "Added from plans" in To learn | A plan is a snapshot to share. Writing to a Repertoire from a plan would need the cookie and would change what the next learn run skips |
| D8 | Examples | **Keep their fixed slots and songs**, with no fill | The presets are input-only (`playlist-architecture.md` §3.5). Preload and warm are keyed on their fixed slots (`agent/preload.ts`) |
| D9 | "Any time" on the week planner | **Not offered.** The week planner already picks the slots | `agent/week.ts:buildWeekPlan` scores every day × slot. The fill flag does apply to the week (it lives in `performer`) |
| D10 | Can Claude change the hours? | **No.** The engine picks each pitch's window; Claude explains it, and may rank pitches as today | The same rule as scores: numbers come from the engine. The `finish_plan` check stays as it is |

**Effort: about 21 hours over 6 stages** (§6). No migration. No new Qloo endpoint.

## 1. The request shape

### 1.1 The proposed schema (`lib/plan-schema.ts:planRequestSchema`, `lib/slot.ts`)

| Field | Today | Proposed | Notes |
|---|---|---|---|
| `slot` | `slotSchema` `{date, startHour, endHour}`, required | `z.union([slotSchema, anyTimeSlotSchema])`, fixed first. `anyTimeSlotSchema = {date, any: z.literal(true)}` | Helpers in `slot.ts`: `isAnyTime(slot)`, `ANY_TIME_WINDOWS`, `nextAnyTimeDate` (§2.3) |
| `performer.songs` | `.max(60).default([])` | **unchanged** | An empty list is already valid today: `PlanContext.setlistFor` returns `[]` and `build_setlist` says "No songs given". With `fillSuggested` the set is suggested songs only |
| `performer.fillSuggested` | none | `z.number().int().min(1).max(8).optional()` | In `performer`, so the week request inherits it through `week-schema.ts:weekRequestSchema` (`performer: planRequestSchema.shape.performer`), and the week's "Plan this busk" links carry it |
| `performer.skipSongs` | none | `z.array({title, artist}).max(60).optional()`, sent only with `fillSuggested` | The songs removed for this busk (D6) |
| `performer.artists` | `.min(1)` | **unchanged** | Qloo needs a seed. An empty Repertoire still plans when the act has "sounds like" artists (P05). With neither, the form says so |

`slotSchema` keeps its two refinements. A body with `any: true` and hours parses as fixed (the first branch wins, and `z.object` strips `any`). That is deliberate: hours given are hours meant.

### 1.2 URL parameters (`lib/plan-url.ts`, `lib/week-url.ts`, `lib/performer-url.ts`)

| Param | Meaning | Old links |
|---|---|---|
| `time=any` | Any time on `date`; `from` and `to` are ignored | Absent: `from`/`to` as today, default 18–21 (`plan-url.ts:parsePlanParams`) |
| `fill=<1-8>` | `performer.fillSuggested` | Absent: off |
| `skip=Title~Artist\|…` | `performer.skipSongs`, in `songsParam`'s format | Absent: none |

`planSearchParams` writes `time=any` instead of `from`/`to` for an any-time request. `weekSearchParams` writes `fill` and `skip` (the week has no slot). Every link made before the change keeps meaning what it meant.

### 1.3 Stored plans, the request hash and saved runs

Three keys hash the request. A change to a parsed old request would orphan its row or its saved run.

| Key | Where | Built from |
|---|---|---|
| `requestHash` (dedupe, one row a day) | `plans/store.ts:requestHash` | `canonicalJson([storedRequestOf(request), exampleId])` |
| The saved run's key on `/p/<id>` | `agent/plan-store.ts:planKey`, checked in `plans/index.ts:snapshotFor` | `JSON.stringify([request, offline, day])` |
| The snapshot write check | `plans/index.ts:saveRunSnapshot` | `canonicalJson(stored.request) === canonicalJson(storedRequestOf(request))` |

The rule: **new fields are `.optional()` with no `.default()`**, and the form leaves them out when they are off. Then an old row parses to exactly the same object, all three keys are byte-identical, and `/p/<id>` keeps replaying its saved run. A `.default(false)` would add a key on parse: every old link would miss its snapshot and start a new agent run, and `saveRunSnapshot` would refuse to save. A golden test pins this (§5).

A new any-time or fill request simply hashes differently, which is right: it is a different request.

### 1.4 How `/p/<id>`, replays and the other readers handle both

| Reader | Fixed slot (old and new) | Any time |
|---|---|---|
| `/p/<id>` header (`app/p/[id]/page.tsx`) | `describeSlot(request.slot)` as today | "Saturday 2026-10-17 · any time, Busk Map picked the hours" |
| Slot passed (`plans/index.ts:slotPassed`) | Slot end ≤ now | The date's last window has ended (10 pm), or the date is today and no window is left (§2.5) |
| Replay (`snapshotEvents`) | Unchanged | Unchanged: the snapshot holds the plan, whose pitches carry their windows |
| "Plan again" (`app/page.tsx`, `?again=`) | `nextSlotDate(weekday, start, end)` as today | Prefills "Any time" on `nextAnyTimeDate` |
| `plan.slot` (plan-view, ics, week link) | The request's slot | **The top pitch's window**, so every existing reader still gets a real slot (§2.4) |
| Week link from a plan (`plan-view.tsx`) | `startDate: request.slot.date` | The same: both slot shapes have `date` |

About 29 call sites in 14 files read `request.slot.startHour/endHour` or `describeSlot`: 7 in `agent/context.ts`, 4 in `tools.ts`, 3 each in `assemble.ts` and `plan-url.ts`, and one or two in `agent.ts`, `baseline.ts`, `compare.ts`, `plans/index.ts`, `api/plan/route.ts`, `p/[id]/page.tsx`, `app/page.tsx`, `plan-view.tsx`, `plan-screen.tsx` and `week-view.tsx`. With the union, TypeScript flags every one, so none is missed. Most read `ctx.slotFor(pitch)` (§2.2) instead.

### 1.5 The week planner and the examples

- **Week (D9):** `/week` has no time control (W02 is Week starting · Busks this week · Per day). The busk form's "Plan my week" turns `slot.date` into `startDate` (`performer-form.tsx:submit`); with any time it does the same. `fillSuggested` and `skipSongs` ride in `performer`. `buildWeekPlan` scores no songs, so it ignores them; its "Plan this busk" links carry them to each session's plan.
- **Examples (D8):** `lib/examples.ts:EXAMPLES` keep their weekday and hours, opened by `nextSlotDate` (`plan-url.ts`, `agent/preload.ts`). `?example=` ignores `time`, `fill` and `skip`.

## 2. "Any time · Busk Map picks"

### 2.1 Which data picks the hours

| Signal | Varies by hour? | Source today | Any-time use | Extra calls |
|---|---|---|---|---|
| Foot traffic | **Yes, the main signal** | `getFootfall(city, slot)` averages the slot's hours over 8 weeks | `getTypicalFootfall(city, 0, 24)`: typical by weekday and hour, already loaded by the agent's `footfall_at` (`tools.ts`, memo key `footfallTypical`). Averaged per window as `scoring/week.ts:typicalForSlot` does | 0 (one sensor request instead of two) |
| Events arriving or leaving | **Yes** | `getEvents(city, slot)`: the slot, with 4 h of lookback | `getEventsBetween` over the whole day. `pitch-score.ts:eventsFactor` already takes the window's start and end in ms | 0 Ticketmaster. Qloo: see §2.6 |
| Weather | **Yes** | `getWeather(city, slot)`: the slot's hours | The day's hours from 10 am to 10 pm. `fetchHourlyForecast` already fetches the whole day, then filters | 0 |
| Qloo places, open in the window | **Yes** (opening hours) | `busyPlaces(…, weekday)` once; `scoring/hours.ts:openDuring` per slot | The same call. `placesFactor(…, weekday, start, end)` runs per window | **0 Qloo** |
| Qloo taste, crowd, set affinity | No | Per plan, per pitch | Unchanged | 0 |

### 2.2 The algorithm (proposed `scoring/windows.ts`, pure, beside `scoring/week.ts`)

1. **Windows.** `ANY_TIME_WINDOWS`: starts at 10, 11, … 19, each 3 hours long. If the date is the city's today, keep only the windows that start after the current hour (`serverLocalNow`).
2. **One reference.** Footfall is scaled against the busiest typical window of that day, across all sensors: the `footfallReference` that `scoreWeek` already passes. Without it every window would score against its own busiest sensor, and a quiet 10 am would look as good as a busy 6 pm.
3. **Score each candidate × window** with the existing `pitch-score.ts:scorePitch`, same weights, with that window's inputs: sensors at their typical average for the window, events, weather hours, open places, and `slotStartMs/EndMs`.
4. **Best window per pitch.** Keep the highest score; break ties by the earlier window. The `ScoredPitch` gains `window: {startHour, endHour}` and its two runners-up.
5. **Rank** the pitches by their best-window score. Then `pickTopPitches` (250 m spacing), `skippedForSpacing` and the agent's pool work unchanged.

`PlanContext` (`agent/context.ts`) gets one branch: `scoreInputs(window)` instead of `scoreInputs()`. `ranked()` calls `rankPitchesAnyTime` when `isAnyTime(request.slot)`. `slotFor(pitch)` returns the pitch's window, or the fixed slot. The fixed-slot path stays byte-for-byte what it is today.

**Engine work:** about 40–80 legal candidates × 10 windows = 400–800 `scorePitch` calls, each over a few hundred sensors, places and events. That is the same pure code the week planner runs 28 times per candidate (7 days × 4 slots). It is still milliseconds, with no I/O.

### 2.3 The date

- The form keeps its date picker. "Any time" only drops From and To.
- **The default date is proposed `slot.ts:nextAnyTimeDate(today, nowHour)`: today if a window can still start after the current hour (`nowHour ≤ 18`), otherwise tomorrow.**
- It is not `nextSlotDate`. That one keeps a slot that is still running ("not ended"), which is right for a fixed slot, but an any-time window must still be ahead of you. `nextSlotDate` stays for the examples and for fixed slots.
- The server re-checks the date when it runs (§2.5).

### 2.4 How the plan explains the pick (additions only to the Design contract)

**Plan output (`lib/plan-schema.ts:planSchema`).** Every new field is `.nullable().default(null)` or `.default(…)`, so old snapshots still parse.

| Field | Shape | Shown as |
|---|---|---|
| `plan.anyTime` | `boolean`, default `false` | The header: "any time · Busk Map picked the hours" |
| `plan.slot` / `slotLabel` | Unchanged shape. For any time: the **top pitch's** window | Existing readers: .ics, the week link, `slotPassed` |
| `pitch.window` | `{startHour, endHour, label, score, why, runnersUp: [{startHour, endHour, score}]} \| null` | The pitch card: "Best 6 pm–9 pm: typically 1,840 people an hour at Bourke St Mall (estimate), the Forum crowd leaving at 9:45 pm, dry". `why` is a template built from the window's evidence, like `assemble.ts:templateWhy` |
| `plan.weather.hours` | Unchanged shape, now 10 am–10 pm | The weather strip, with the top window marked |
| `researchTotals.windows` | `number`, optional | ResearchFunnel: "10 time windows scored" |

**A new agent tool, `best_hours`** (`agent/tools.ts`):
- Offered only for an any-time request, and only after `score_pitches`.
- Input: up to 3 `pitchIds`. Output per pitch: its top 3 windows with scores, typical people per hour at the nearest sensor for each hour, the events arriving or leaving nearby, rain by hour, and the places open then.
- Engine only: no Qloo, no model. Source label: "Busk Map scoring engine, City of Melbourne sensors, Ticketmaster, Open-Meteo".
- Its numbers go into `NumberBag`, so Claude can quote them, and `finish_plan`'s numbers check is unchanged.
- `TOOL_LABELS`: "Finding the best hours". The plain-words card (`lib/agent-steps.ts`): "Best 6–9 pm at Bourke St Mall: foot traffic peaks at 7 pm and the Forum crowd lets out at 9:45 pm".

**The other changes to the agent:**
- `score_pitches` rows gain `window` in any-time mode.
- The defaults of `busy_places.openAt`, `events_near` and `footfall_at.hour` become the pitch's best window when one is known, and otherwise the day's 10 am to 10 pm.
- `buildPrompt` says: "No fixed time: the engine scores each pitch at its best 3-hour window that day, 10 am to 10 pm. Call best_hours and say each pitch's hours in its why."
- `mock-model.ts` calls `best_hours` in any-time mode, so the e2e stream shows it.

### 2.5 Edge: a late-evening "any time" busk with the pinned clock

| Pinned clock (`BUSKMAP_FAKE_NOW`) | City time | Default date (`nextAnyTimeDate`) | Windows scored |
|---|---|---|---|
| `2026-10-14T12:00:00+11:00` (DEV default) | Wed 12:00 | **Wed 14 Oct** (today) | 7: starts 13 to 19 |
| `2026-10-16T21:30:00+11:00` (QA late evening) | Fri 21:30 | **Sat 17 Oct**: no window starts after 21:00 today | All 10: starts 10 to 19 |
| `2026-10-17T00:15:00+11:00` (QA after midnight) | Sat 00:15 | **Sat 17 Oct** (today) | All 10 |
| A stored request for Fri 16 Oct, opened at Fri 21:30 | Fri 21:30 | Not applicable: the date is fixed in the request | 0: shown as "No busking hours left that day" (`SlotPassedNote`), with "Plan again", which opens Sat 17 on Any time |

The server never moves a request's date: the date is in the hash. Only the form's default and "Plan again" pick the next date.

### 2.6 Qloo call count and cost

Baseline: a cold busk makes 24–33 Qloo calls (`docs/qloo-data-map.md` §4, measured 16 Oct). The quota is 10,000 a month.

| Change | Qloo calls (cold) | Why |
|---|---|---|
| Places, open in each window | **+0** | One `busyPlaces` call per weekday (`filter.hours=<weekday>`); the hours are checked locally |
| Taste map, crowd, demographics, compare, trending, per-pitch set affinity | **+0** | They don't depend on the hour |
| Event headliners (`context.ts:eventTaste`) over the whole day instead of the slot | **+0 typical, ≤ +6 worst** | More events in the day can bring more headliners to resolve (#1 `/search`). It is capped at `EVENT_ARTISTS_MAX = 6` and cached for days. To be measured in S2 |
| `best_hours` | **+0** | Engine only |
| **Any time, total** | **+0 typical, ≤ +6 worst** | A cold busk stays at 24–33 (≤ 39 worst), so the quota stays at roughly 300–400 cold busks a month |
| Model | +1 tool call, about 1.5–2k more input tokens | A small share of a Sonnet busk run. To be measured in S3 |
| Sensors | −1 request | The typical table replaces the slot averages |

## 3. Suggested fill

### 3.1 Where the songs come from (D5): deterministic, from the plan's own data

| Step | Data | Call | Cost per busk |
|---|---|---|---|
| 1. Candidate artists | The city crowd's artists, already fetched (`context.ts:localArtists`, #5, take 20) **plus** related artists (#12 `qloo.tasteArtists`, take 20, the learn run's `related_artists` call) | 1 new Qloo call | **+1 Qloo (cold), 0 warm** |
| 2. Leave out | Artists of songs already in the set. The act's own "sounds like" artists stay in | none | 0 |
| 3. Rank per pitch | **The per-pitch affinity call the set already makes** (`context.ts:setlistFor` → #6 `artistAffinityAt`, 400 m around the pitch), with the candidate ids added to `filter.results.entities` (≤ 50 per call, `client.ts:MAX_TAKE`). Then audience growth, then Last.fm listeners: the `setlist.ts:learnThese` order | Same calls, more ids | **+0** (3 calls, one per top pitch, as today). After Remove all the call still runs, whereas a no-songs plan skips it today, so the count matches a plan that has songs |
| 4. Songs | The top artists' songs from Spotify, with Last.fm as backup: the learn run's `learn/tools.ts:catalogueOf`, moved to a shared `server/songs/catalogue.ts`. At most 2 songs per artist (`LEARN_MAX_PER_ARTIST`), and none in the set or in `skipSongs` | Spotify search, Last.fm | Not Qloo quota. ≤ 12 searches cold, typically 4–6 (artists overlap between pitches), cached for days |
| 5. Order | The suggested songs join the act's songs in `setlist.ts:buildSetlist`, with the same 48/32/20 weights: affinity from step 3, Last.fm plays (`context.ts:songs`, names list extended), and the Spotify year for era fit | none | 0 |

**Why not the learn tools with a run:** it would mean a second agent, about US$0.08–0.14 of model time (`playlist-architecture.md` §2.9), and +4 Qloo calls for crowd reads per pitch. The set needs the crowd at each pitch, and call #6 already measures that. A per-pitch crowd read (#5c) could replace step 1 later if the songs feel too city-wide: +3 calls.

**Budget (proposed in `playlist/config.ts`):** `SUGGEST_MAX_PER_PITCH = 8`, `SUGGEST_ARTISTS_PER_PITCH = 4`, `SUGGEST_CATALOGUE_LOOKUPS = 12`, and at most 1 extra Qloo call. A failed related-artists call falls back to the city crowd alone, with a plan note ("Qloo didn't answer in time for related artists"), through `OPTIONAL_QLOO`.

### 3.2 Limits and history

| Question | Answer |
|---|---|
| Does it count against the learn-run limit (3 an hour per Repertoire, 6 per IP)? | **No.** It isn't a learn run: no model, no `learn_runs` row. It is part of a busk, under the busk's own limits (`planLinkLimiter`, `freshRunGate`), and its Qloo calls are counted in the busk's `researchTotals.qlooCalls` (`withQlooUsage`) |
| Does it write `learn_suggestions`? | **No.** Only "Add to Repertoire" on a suggested song does. It reuses `POST /api/playlist/learn/suggestions` (`song_source='plan'`, the existing `add-to-repertoire.tsx`), so the song shows under "Added from plans" and no learn run suggests it again |
| Does it read the Repertoire's history (dismissed songs)? | **No.** The plan stays a snapshot, the same for whoever opens the link. The form can put "Not for me" songs into `skipSongs` if it has them loaded (optional, inside the 60 cap) |

### 3.3 How the set marks a suggested song (additions to `planPitchSchema.setlist[]`)

| Field | Shape | Default for old plans |
|---|---|---|
| `origin` | `"repertoire" \| "suggested"` | `"repertoire"` |
| `suggestion` | `{ because: string, source: "spotify" \| "lastfm", sourceUrl: string \| null, spotifyTrackId: string \| null } \| null` | `null` |

- `because` reads like `learnThese`'s reason, for example "Liked by the crowd here (affinity 82/100), fans also like Paul Kelly". Every number in it comes from the tool data.
- `own`, `songId` and the other fields don't change.
- `PitchSetPanel`'s "N of M songs you can sing" counts `origin === "repertoire"`. Suggested rows carry the "Suggested" tag and the source link (BRAND's rule: "no invented songs").
- `build_setlist`'s output gains `suggested: true` on those rows, so Claude can tell them apart.
- `researchTotals.songs` counts both kinds.

### 3.4 "Remove all", the empty Repertoire and the baseline prompt

- **Remove all (P03)** and **an empty Repertoire (P05):** `songs: []` with `fillSuggested: 6`. Each pitch's set is 6 suggested songs for its own crowd, ranked by that pitch's call #6. "Remove them from my Repertoire too" is the existing `PATCH /api/playlist` and is not part of the plan request.
- **No songs and no fill** (an old link, or the API): exactly today's behaviour, an empty set and "No songs given".
- **The plain-AI baseline (`agent/compare.ts:comparePrompt`)** already handles no songs ("They haven't listed songs."). Two lines change, for new requests only (the prompt is the cache key, so old cached baselines stay valid):
  - With fill: "Suggest up to six songs that would suit the people passing."
  - With any time: "When: Saturday 17 Oct, at whatever time of day is best."
- In `scoring/baseline.ts:compareWithBaseline`, the plain AI's spots are scored at their own best window, through the same `bestWindow` function. Its record slot string becomes `"2026-10-17 any"`.

## 4. Adding songs (UI only)

| Part | Change | Data |
|---|---|---|
| Step 1, the Spotify artist profile (optional) | Move the link loader (`performer-form.tsx:loadOwnSongs`, `GET /api/repertoire?type=artist`) to the top of `RepertoireAdd` on `/repertoire` | Unchanged route |
| Step 2, one search | `song-search.tsx:SongSearch` as today | Unchanged `GET /api/repertoire?type=tracks` |
| No match | Replace the "Type it in the song list below" line with the typed fallback right under it: Title and Artist prefilled by splitting the query on " - ". It saves as Typed | Unchanged `POST /api/playlist/songs` with `source: "typed"` (`repertoire-view.tsx` already sends that) |
| The planner form | The "Songs you can play" fieldset (search, link, textarea) gives way to `RepertoireSource`; "Add a song just for this busk" uses the same search and fallback | The request's `performer.songs`, as today |

**Confirmed: no change to data, routes or schemas for adding songs.** The planner's textarea goes. `?again` prefill already fills `performer.songs` directly (`performer-form.tsx`), so it doesn't need the textarea.

## 5. Test impact

| Area | File | Change |
|---|---|---|
| Schema and compatibility | `tests/unit/lib/slot.test.ts`, `plan-url.test.ts`, `week.test.ts`, `form-errors.test.ts` | The union, `nextAnyTimeDate`, `time=any` / `fill` / `skip` round trips, old URLs parsing to the same request, and errors on a union path |
| **Golden hash test (new)** | `tests/unit/server/plans.test.ts`, `stored-plans.test.ts` | A stored 16 Oct request: the same `requestHash`, `planKey` and `snapshotFor` hit after the change |
| Engine | New `tests/unit/scoring/windows.test.ts`; `pitch-score.test.ts`, `setlist.test.ts` and `week.test.ts` stay green untouched | The best window per pitch, the day reference, an event leaving in a late window, rain at noon, a place closed in the morning, today's past windows dropped, ties to the earlier window |
| Fill | New `tests/unit/scoring/fill.test.ts`; `learn/tools.test.ts` after `catalogueOf` moves | Per-pitch ranking, `skipSongs`, 2 per artist, `origin` and `suggestion`, Remove all giving suggested songs only |
| Agent | `agent-v2.test.ts`, `agent.test.ts`, `compare.test.ts`, `qloo-usage.test.ts` | `best_hours` gating and outputs, tool defaults, prompt lines, and the Qloo count: any time +0, fill +1 (mock) |
| Words and Brain | `user-facing-words.test.ts`, `qloo-map.test.ts` (drift) | New copy. The Brain lists `related_artists` under the Suggested set too |
| Mock-model e2e | `own-act.spec.ts`, `short-links.spec.ts`, `repertoire-planners.spec.ts`, `week.spec.ts`, `examples.spec.ts` | Any time by default with hours on each pitch and the `best_hours` step; an old fixed link replays; Edit for this busk, Remove all and the suggested tags; fill reaching the week's session links; examples unchanged |
| **Pinned clock** | `tests/e2e/clock.ts`, `qa/clock.spec.ts` | At Wed noon: Any time defaults to today, 7 windows. **A second run at `2026-10-16T21:30+11:00`: defaults to Sat 17, and a stored Fri 16 any-time link shows "No busking hours left that day"**. The e2e server has one clock per process, so propose `pnpm e2e:late`, which sets `BUSKMAP_FAKE_NOW` and runs the `@clock`-tagged specs |
| Layout and axe | `layout.spec.ts`, `a11y.spec.ts`, `ssr.spec.ts`; QA's `qa/layout`, `qa/a11y`, `qa/repertoire`, `qa/repertoire-planners`, `qa/baseline`, `qa/week-a11y` | `RepertoireSource`, `TimeSlotPicker anyTime` (the choice cards use arrow keys), the pitch window line, the Suggested tags, and the typed fallback, at 390, 768 and 1440 in both themes. Axe AA clean |

## 6. Stages, effort and risks

| Stage | Contents | Hours |
|---|---|---|
| S1 | Request schema, URL params, form errors, the golden hash tests | 2.5 |
| S2 | Any time in the engine: `scoring/windows.ts`, the `PlanContext` branch, plan fields, `slotPassed`, the `/p` header, the "Plan again" prefill | 4 |
| S3 | Agent: `best_hours`, tool defaults, the prompt, the mock model, step cards, research totals, compare and baseline | 3 |
| S4 | Suggested fill: shared catalogue, candidate artists, per-pitch ranking, `origin`/`suggestion`, budget constants, the Qloo usage test | 4 |
| S5 | UI in plain shadcn: `RepertoireSource` (busk and week), `TimeSlotPicker anyTime`, set tags and "N of M", `RepertoireAdd` with one search and the fallback | 5 |
| S6 | e2e, the late-clock run, layout and axe, the 3200 rebuild | 2.5 |
| **Total** | Commit by stage on `dev/core`, local only | **≈ 21** |

| Risk | Mitigation |
|---|---|
| A default on a new field breaks every old link's saved run | Optional, never defaulted. The golden test in S1 |
| Three pitches at three different times could read as a route | Each card says "Best <hours> here", and the summary leads with the top pitch's time |
| On today's date, results depend on the hour of the run, while the 15-minute replay and the saved snapshot keep the first run | The snapshot is "as planned at <time>". A window that has passed shows as passed. Acceptable |
| Suggested songs feel city-wide rather than per-pitch | Ranking by the pitch's own call #6 makes the sets differ. The fallback upgrade is a per-pitch crowd read (+3 calls) |
| Spotify matches the wrong namesake's songs | The same name match as `top_tracks`, with Last.fm as backup. The source link shows on every suggested song |
| Shared files with the learn-feed DEV agent (`playlist-copy.ts`, `learn-plain.ts`, `learn/tools.ts`) | S4's `catalogueOf` move waits until the learn-feed commit lands. Commits are by path, never `git add -A` |
| `plan.weather.hours` now spans the whole day | The strip highlights the top window. The shape doesn't change |
