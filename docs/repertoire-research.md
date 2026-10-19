# Repertoire research: data contract

The approved spec is `hackathons/qloo-2026/repertoire-research-spec.md` (17 Oct, recommended defaults). This doc is the
contract between DEV (data, server, stream, page wiring) and BRAND (the components of the three page states).

Code: `src/lib/repertoire-research.ts` (step keys, step outputs, the snapshot, the request), `src/lib/repertoire-research-view.ts`
(the view model), `src/server/research/run.ts` (the run), `src/server/research/summary.ts` (step 9),
`src/app/api/playlist/research/route.ts` (the API), `src/components/playlist/research-view.tsx` (the plain page).

## 1. The flow

`/repertoire` is one input: the Spotify artist link. Submitting it starts a streamed run of nine steps. While it runs the
research is on top and the results fill in below; once done the results lead and the research folds under "How we built
your Repertoire".

| # | key | tool (stream) | Source | What it gives |
|---|---|---|---|---|
| 1 | `profile` | `research_profile` | Spotify | name, photo, genres, followers. Saves the link and the profile; the act name is prefilled when empty (editable) |
| 2 | `songs` | `research_songs` | Spotify (Last.fm backup) | your songs straight into Songs you can sing, `own: true` (Your song), removable; at most 20 |
| 3 | `qloo` | `research_qloo` | Qloo #2/#1 then #15 | the Qloo entity: genre tags, audience character tags, description, popularity |
| 4 | `soundsLike` | `research_sounds_like` | Qloo #12b | sound-alikes by affinity; saved as "Artists you sound like" only when that list is empty (6); editable |
| 5 | `fans` | `research_fans` | Qloo #9b | age and gender lean |
| 6 | `fansLove` | `research_fans_love` | Qloo #12c | artists your fans love, signalled by you + up to 4 sound-alikes, all of them excluded (10 kept) |
| 7 | `learn` | `research_learn` | Spotify top tracks (Last.fm backup) | songs from step 6's top 4 artists, 2 each; your songs, earlier suggestions and dismissed songs left out (the learn run's `runTopTracks`) |
| 8 | `genres` | `research_genres` | Qloo #16 | genre tags; they feed the busk local scene (`performer.genreTags`) |
| 9 | `summary` | `research_summary` | Claude, one call | ranks step 7's songs (3–6, 2 per artist) with a reason each, and one paragraph. Never adds a song; checked by the learn guardrails (`checkPicks`); templates from the data if the model fails |

"Find more songs to learn" (`mode: "more"`) reruns 6, 7 and 9 with the current sound-alikes and the whole history.
"Refresh my research" reruns everything; a full run for the same link is refused (`up_to_date`) unless `refresh: true`.

## 2. API

`POST /api/playlist/research` (BotID, Origin check). Body:

```ts
{ link?: string /* open.spotify.com/artist/<id>, spotify:artist:<id> or the id */, mode?: "full" | "more", refresh?: boolean }
```

- 200: `application/x-ndjson`, the learn stream (below). The cookie is set (a first visit creates the Repertoire).
- Refusals, plain JSON `{ error: { code, message, ...extra } }`, nothing spent: 400 `bad_link`; 404 `no_playlist` (more without a
  Repertoire); 409 `up_to_date`, `no_research`, `already_running` (`runId`), `list_full` (`pending`, `max`); 429 `limit`
  (`limit.scope` "repertoire" | "ip", `Retry-After`); 503 `unavailable`.
- Limits: the learn-run limiter (3 an hour per Repertoire, 6 per IP). A run that ends `qloo_unavailable`, `no_match`,
  `spotify_unavailable` or `spotify_not_found` doesn't count and gives its IP hit back.
- Join a run in flight or replay a finished one: `GET /api/playlist/learn/runs/<runId>/events` (no model, no Qloo).
- The Repertoire (`GET /api/playlist`) carries `research` (the snapshot). The Learn list (`GET /api/playlist/learn`) has the
  running run, the limit and every suggestion; a research run is a learn run with `inputs.kind` "research" or "more".

## 3. Stream events (one JSON object per line; `lib/learn-schema.ts`)

```ts
{ type: "run", runId, number, startedAt, model: "claude" | "mock", inputs: { songs, soundsLike: string[], pitches: [], kind: "research" | "more" }, replay, stepsKept }
{ type: "status", message }                        // "Researching your act" | "Finding more songs to learn"
{ type: "tool-start", id, tool, label, source, input }   // tool: research_*; label: the step's plain-words title
{ type: "tool-end", id, tool, ok, summary, output }       // output: the step output below (or { error })
{ type: "totals", totals: LearnTotals }            // after every step and once at the end
{ type: "suggestion", ...LearnSuggestionEvent }    // each saved song to learn, after step 9
{ type: "usage", inputTokens, outputTokens, reasoningTokens, steps, ms, stoppedBy }   // step 9's call
{ type: "end", ok, runId, mode: "agent" | "mock" | "fallback" | "none", newCount, skippedCount, code, message }
```

`end.code`: null, `nothing_new`, `model_unavailable` (songs from the data), `qloo_unavailable`, `no_match` (Qloo doesn't know
the artist: profile and songs are saved, 4–9 skipped), `spotify_unavailable`, `spotify_not_found`.

Step outputs (`StepOutputs` in `lib/repertoire-research.ts`), each with a one-line `summary`:

```ts
profile:    { spotifyId, name, image, genres[], followers, href }
songs:      { source: "spotify" | "lastfm" | "none", songs: { id, title, artist, year, durationMs, album, image, href }[], added, already, full }
qloo:       { matched, qlooId, name, description, genres[], audience[], popularity }
soundsLike: { artists: { name, qlooId, spotifyId?, image?, tags?, affinity }[], saved }
fans:       { age: { key, label, lean }[], gender: { key, label, lean }[], ageLean }
fansLove:   { artists: { name, qlooId, spotifyId?, image?, tags?, affinity, because[] }[], signalledBy[], excluded }
learn:      { songs: { songId, title, artist, artistId, year, durationMs, source, popularity }[], checked, skipped: { alreadySuggested, dismissed, canSing }, overRepresented[], noSongs[], lookedUp[] }
genres:     { tags: { id, name, affinity }[] }
summary:    { text, by: "claude" | "mock" | "template", picks }
```

## 4. The snapshot (`playlists.research`, migration 009)

```ts
type ResearchSnapshot = {
  version: 1; spotifyArtistId: string;
  fullRunId: string; runId: string; runNumber: number; mode: "full" | "more"; at: string;
  steps: { [key]?: { status: "done" | "failed" | "skipped"; output: StepOutputs[key] | null } };
  totals?: LearnTotals;
};
```

Saved at the end of every run that read the profile (a "more" run keeps steps 1–5 and 8 and replaces 6, 7 and 9). Songs you
can sing and songs to learn are not copied: they live in `playlist_songs` and `learn_suggestions`.

## 5. The view model (`toRepertoireView`)

```ts
toRepertoireView({ snapshot?, events?, playlist?, suggestions? }) → { phase: "empty" | "running" | "done", mode, steps, totals, results, end }

RepertoireStep    = { key, status: "pending" | "running" | "done" | "failed" | "skipped", found?: string, cells?: { name, image? }[] /* ≤ 6 */, note?: string }
RepertoireTotals  = { qlooCalls, songs, soundsLike, fanArtists, songsChecked, toLearn: number | null }
RepertoireResults = {
  profile:    { name, image?, genres[], audience[] /* Qloo character tags */, followers?, href? } | null,
  summary:    string | null,
  fans:       { age: { label, lean }[], gender: { label, lean }[] } | null,
  soundsLike: ResearchArtist[] | null,   // the Repertoire's current, editable list when `playlist` is given
  fansLove:   ResearchArtist[] | null,
  canSing:    ResearchSong[] | null,
  toLearn:    LearnSong[] | null,        // the Learn list when `suggestions` is given, else this run's suggestion events
  learned:    ResearchSong[] | null,
}
ResearchArtist = { name, image?, source?: "spotify" | "qloo" | "typed", tags?: string[] }
ResearchSong   = { id, title, artist, year?, album?, image?, durationMs?, href?, own? }
LearnSong      = ResearchSong & { reason, because?: ResearchArtist[], status: "pending" | "learned" | "dismissed", fresh? }
```

Every result is null until its step has landed (the skeletons). A step a finished run never started is `skipped`.

## 6. Component contract for BRAND (props each state needs)

- **Empty**: `{ value, onChange, onSubmit, error?: string, hint: PLAYLIST_COPY.research.linkHint, example: research.example, testArtist?: { name, link } (offline only) }`.
- **Running**: `{ steps: RepertoireStep[] (9, in order), totals: RepertoireTotals, status: string (the status event), live: true }`, and below it
  the results with nulls as skeletons. Today's plain page uses `AgentStepStream` + the learn `ResearchFunnel`.
- **Done**, results first, in this order: profile header (`results.profile` + the act name field), Songs you can sing
  (`results.canSing`, Your song tag, Remove), Artists you sound like (`results.soundsLike`, editable), Who your fans are
  (`results.fans`, LeanBar rows), What your fans also love (`results.fansLove`), Songs you should learn (`results.toLearn`,
  Learned / Not for me / Undo, Find more), the summary (`results.summary`), Learned; then Refresh my research, Use a
  different link, and the research folded (`steps` + the replayed feed, `totals`).

A new piece BRAND may want (not built by DEV): a **ResearchStepCard** `{ step: RepertoireStep }` (title from
`RESEARCH_LABELS[key]`, `found`, up to 6 `cells` as HexCells, `note` on failed/skipped) and a **ResearchTotalsFunnel**
`{ totals: RepertoireTotals, live }`.

## 7. Offline (the 3210 server, e2e)

The empty state offers "Try the test artist (Julia Jacklin)" (`OFFLINE_TEST_ARTIST`, the Qloo mock catalogue's
Spotify-shaped id). The whole run uses synthetic data: the Spotify profile and four "Synthetic original" songs, the mock's
entity with invented audience tags (`urn:tag:audience:qloo`, an assumed type) and description, sound-alikes, fan lean,
fans-also-love, "Synthetic track" songs, genres, and the mock writer's "Mock summary (offline test mode)" paragraph. No
real API data is committed.
