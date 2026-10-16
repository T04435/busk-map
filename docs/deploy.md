# Going live on Vercel

Everything needed to put Busk Map in production, in order. Nothing here is automated: each step is done once by a person with access to the Vercel team (`cubanos-dev`).

## 1. Environment variables

Set these for **Production** (and Preview, if previews should use live data) under Project → Settings → Environment Variables. Values are never committed; `.env.example` lists the names.

| Variable | Needed for | Without it |
|---|---|---|
| `QLOO_API_KEY` | live Qloo data | the local Qloo mock runs and every Qloo number is labelled "Qloo test data (local mock)" |
| `AI_GATEWAY_API_KEY` | the live agent, the plain-LLM comparison, week explanations | on Vercel the gateway authenticates with OIDC, so this is optional; without either, explanations come from the data |
| `TICKETMASTER_API_KEY` | events | the events source shows "Unavailable" |
| `LASTFM_API_KEY` | song popularity and "learn these" | setlists keep the performer's songs, without popularity |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | song search and own-catalogue import on the landing page | the performer types songs instead |
| `DATABASE_URL` | comparison stats, stored runs, short plan links (see below) | nothing is recorded; runs and links are kept in memory |

Must **not** be set in Production: `BUSKMAP_OFFLINE`, `BUSKMAP_ALLOW_FAULTS`, `QLOO_MOCK`, `QLOO_MOCK_ROUTE` (the test switches are ignored when `VERCEL_ENV=production`, but leave them unset anyway).

Also set an **AI Gateway budget** (Team → AI Gateway → Budgets): US$50 a month, the figure in `architecture.md`.

## 2. BotID (already in the code)

The four routes that spend money or a third-party quota are protected:

| Route | Method | What it spends |
|---|---|---|
| `/api/plan` | POST | the live agent (Claude Sonnet) |
| `/api/compare` | POST | the plain-LLM comparison (Claude Haiku) |
| `/api/week` | POST | week explanations (Claude) |
| `/api/repertoire` | GET | Spotify search (songs, artists with release counts) and Last.fm listener counts |

- The browser side is `src/instrumentation-client.ts` (`initBotId`), the list of routes is `src/lib/botid-routes.ts`, and the server check is `src/server/bot.ts` (`checkBotId`). `next.config.ts` wraps the config in `withBotId` for the challenge proxy rewrites.
- BotID runs only on Vercel builds (`VERCEL=1`). Locally, in `pnpm start` and in the e2e tests the browser sends no challenge and the server skips the check, so nothing changes there.
- A bot gets a 403 `bot_detected`. If BotID itself fails, these routes fail closed with a 503, because they spend the AI budget.
- `curl` against a protected route is rejected in production by design; test from the app's pages.
- **Optional (Pro):** Project → Firewall → Rules → enable **Vercel BotID Deep Analysis**. Deep Analysis is billed per check, and live search makes a check per debounced keystroke, so check the pricing against expected search volume first.

After the first deploy, check one live agent run from `/plan?example=acoustic` (it redirects to a new short link, `/p/<id>`, and a fresh agent run starts on load: example presets are inputs only), one plan from the landing form (`POST /api/plans`) and one song search on the landing page. A 403 or 503 there means the client and server lists are out of step; the function logs say "bot check failed" with the reason.

## 3. WAF rate-limit rule

The app has a per-instance limiter (5 fresh agent runs per IP per hour, where replays and joined runs don't count; 6 week plans and 12 comparisons per IP per 10 minutes; 120 searches per IP per minute), but instances don't share it. Add this rule so the limit holds across the whole deployment. Hobby allows one rate-limit rule per project.

Song and artist search now runs as you type (debounced 300 ms, from 3 characters, plus one Last.fm lookup per artist result list), so one performer filling the form can make 30 or more `/api/repertoire` calls in a minute. Keep `/api/repertoire` out of the 20-a-minute rule: it stays behind BotID and the app's own limiter, and the Spotify and Last.fm calls are cached.

Project → **Firewall** → **Configure** → **+ New Rule**:

| Field | Value |
|---|---|
| Name | `Busk Map: limit paid API routes` |
| If | **Request Path** · **Matches expression** · `^/api/(plan\|compare\|week)$` |
| Then | **Rate Limit** |
| Strategy | **Fixed Window** |
| Time Window | **60s** |
| Request Limit | **20** |
| Keys | **IP Address** (add **JA4 Digest** too on Pro, so one IP behind a NAT isn't punished for another device) |
| Then (when over the limit) | **Default (429)** |

Then **Save Rule** → **Review Changes** → **Publish**.

- 20 a minute is far above a real performer's use (one agent run and one comparison) and well below a script.
- Start with the **Log** action for a day if you want to see real traffic first, then switch to 429.
- The app already explains its own 429 for fresh runs ("You've started 5 plans this hour. Try again in about N minutes, or open one of your earlier plans."), with `Retry-After` and `error.retryAt` / `error.retryAfterS` in the body. A WAF 429 shows the generic planner error. Outside production, `?faults=fresh-limit` (with `BUSKMAP_ALLOW_FAULTS=1`) forces the app's 429 to test the limit page.
- Counters are per region, so the real ceiling is a little higher than 20 for traffic spread across regions.

Matching rule for fresh agent runs (Pro, or instead of the rule above on Hobby): path `^/api/plan$`, Fixed Window **3600s**, limit **15**, key IP. The WAF can't tell a fresh run from a replay or a reopened short link (all are `POST /api/plan`), so it sits above the app's 5 fresh runs an hour; the app's limiter is the precise one, per instance, and the AI Gateway budget cap stays the hard ceiling. On Pro you can also add and a third for search: path `^/api/repertoire$`, Fixed Window **60s**, limit **120**, key IP.

## 4. Warm-up

- The landing page calls `POST /api/warm` 300 ms after it loads. That fetches the three example presets' data (Qloo, sensors, rules, events, weather; no model calls) into the data-level caches (`"use cache: remote"` in the adapters), so the agent's first run on a preset doesn't wait on cold sources.
- No example plan is pre-built or cached: the presets are inputs only, and every click on one starts a fresh agent run on a new short link. Only the data each tool fetches is cached, per call.
- After a deploy, open the landing page once (or `curl -X POST https://<domain>/api/warm`, which is not BotID-protected and costs nothing) to warm the new deployment.
- No cron is configured. If cold starts are a problem, a Vercel cron calling `/api/warm` every 10 minutes would fix it, but Hobby crons run at most once a day, so it needs Pro. Ask before adding one.

## 5. Before pointing the domain

- [ ] `pnpm check` and `pnpm test:e2e` green on the commit being deployed.
- [ ] Run the e2e tests against the preview: `PLAYWRIGHT_BASE_URL=https://<preview> E2E_ALLOW_LIVE=1 VERCEL_AUTOMATION_BYPASS_SECRET=… pnpm test:e2e` (fault and mock tests skip themselves). `E2E_ALLOW_LIVE=1` is required: the e2e cost guard calls `GET /api/health` on every target, whatever the host, and aborts unless it reports `offline: true`. A deploy is live, so the run would abort without it; with it, the run prints a cost warning, because uncached example plans call Claude, Qloo and Ticketmaster.
- [ ] The Qloo badge says "Live Qloo data" once the key is set (response shapes were verified against live Qloo on 2026-10-15; see `docs/qloo-mock.md`).
- [ ] One live agent run and one comparison work in production (BotID passes).
- [ ] The WAF rule shows matches in Firewall → Overview.
- [ ] AI Gateway budget set.
- [ ] OpenFreeMap tile terms confirmed (open issue in `architecture.md`).

## Database migrations (run by the Vercel production build)

`vercel-build` (package.json) runs `node scripts/migrate.mjs --if-production && pnpm build`. Vercel uses it in place of `build`; there is no `vercel.json` build command to conflict.

- **Production only.** The migrate step runs when `VERCEL_ENV=production` and `VERCEL=1` (the Vercel production build). In preview and development builds it logs "skipping migrations" and exits 0, so the build continues. A manual run with `VERCEL_ENV=production` but without `VERCEL=1` is refused. Production needs `DATABASE_URL_UNPOOLED` (Neon's direct connection) set in the Production environment.
- **Tracking.** `schema_migrations (filename PK, checksum sha256, applied_at)`. Only files not yet recorded run, in name order; each file and its tracking row commit in one transaction, so a failed file leaves nothing behind. Logs: `applied X`, `skipped X (already applied)`. The connection string is never printed.
- **Failure fails the deploy.** Any error (bad SQL, a missing URL, a checksum mismatch) exits non-zero before `next build`, so the old deployment keeps serving.
- **The first production build.** The production Neon database (`busk-map-db`, branch `main`) is empty. The build creates `schema_migrations` first, then applies 001-006 in order and records each. Every statement is safe on an empty database (each file only touches tables created in the same or an earlier file) and re-runnable (`IF NOT EXISTS`, idempotent `DROP NOT NULL`; nothing updates, deletes or drops data). The second build skips all six.
- **Adding a migration.** Add `migrations/NNN_name.sql` (next number), written to be re-runnable. Test it with `pnpm db:migrate:dev` (Neon dev branch, reads `.env.development.local`) before merging. It applies on the next production build.
- **Immutable.** Never edit an applied file; the build fails with "applied migrations are immutable; add a new file". Fix mistakes with a new migration.
- **Rollback.** There are no down migrations. Roll the code back by promoting the previous deployment in Vercel (migrations here only add things, so older code keeps working). To undo a schema change, add a new migration that reverses it, and check the data first. Never delete `schema_migrations` rows by hand except to re-run a file that you know did not apply.
- **Verification without production:** the same code path runs against the Neon dev branch with `VERCEL_ENV=production VERCEL=1 node --env-file=.env.development.local scripts/migrate.mjs`. `--dir <path>` points at another migrations directory.

## Plain-AI baseline stats (optional database)

Every plan runs a plain-AI baseline (Claude Haiku, no tools, no data) in parallel and sets it beside Busk Map's picks. Comparisons are recorded for the uniqueness stats at `GET /api/baseline-stats` only when `DATABASE_URL` points to Postgres (for example Neon from the Vercel Marketplace). Without it, recording is a no-op (one log line) and plans work as usual.

- The app reads the pooled `DATABASE_URL` at runtime and never runs DDL. The tables come from `migrations/*.sql` (idempotent: 001 baseline comparisons, 002 the agent's run store, 003 `plans` for the short links, 004 `playlists` and `playlist_songs` for the Repertoire, 005 `learn_runs` and `learn_suggestions`), applied over the direct `DATABASE_URL_UNPOOLED`: `pnpm db:migrate:dev` runs them against the Neon dev branch (from `.env.development.local`). Production gets the same migrations from the `vercel-build` step (see Database migrations above); before that merge, recording fails softly with a log line, and without the `plans` table the long `/plan?…` URLs keep working (no short link is made).
- Short links (`/p/<id>`): without `DATABASE_URL` they are kept in memory (one log line). That works on a single long-lived server; on Vercel the long `/plan?…` URL is kept instead.
- Locally, `next dev` uses the dev branch (`.env.development.local` wins over `.env.local`). `next start` reads `.env.local`, which may point at main: run it with `DATABASE_URL=` in the shell to keep local runs out of the production database.
- Rows hold no personal data: an example id or "custom", the city and slot, pitch ids, scores, the plain AI's pick statuses and the overlap.

## Stored step data

Plans keep their full step data. A finished run stores its steps, and each step holds the data the tool returned (much of it derived from Qloo), in the `plans` rows and the `plan_store` runs. It is stored privately server-side and never committed to the repository. The `plan_store` replay cache keeps its own expiry (15 min; example presets are never stored there, every click is a fresh run); the `plans` rows behind short links persist.

## Repertoire storage

The saved Repertoire (code name `playlist`; docs/playlist-architecture.md) lives in Neon behind an anonymous device cookie.

- **Migrations:** `004_playlists.sql` (`playlists`, `playlist_songs`) and `005_learn_runs.sql` (`learn_runs`, `learn_suggestions`, plus two columns on the 004 tables). Both are idempotent. **Production gets both at deploy** from the `vercel-build` migrate step; without 004 every `/api/playlist/*` write fails with a 503 "Saving isn't available" and the rest of the app is unaffected. Locally: `pnpm db:migrate:dev` (Neon dev branch).
- **The cookie:** `buskmap_playlist`, set by the server on the first save only (browsing creates nothing). HttpOnly, SameSite=Lax, 400 days, Secure in production. The value is a random 128-bit token; the database keeps only its sha256. It never appears in a URL, a plan request or a short link.
- **Store:** the pooled `DATABASE_URL`. Without it, a long-lived local server keeps Repertoires in memory (lost on restart); on Vercel without a database the routes answer 503.
- **Limits:** 60 songs (can sing + learned) per Repertoire; 10 new Repertoires an hour per IP (per instance, like the other limiters; offline test mode is not limited); mutating routes check `Origin` and BotID. A WAF rate rule on `/api/playlist/*` is the cross-instance limit. Constants: `src/server/playlist/config.ts`.
- **Forget and expiry:** `DELETE /api/playlist` deletes the Repertoire and clears the cookie; a Repertoire unseen for 13 months is deleted when a new one is created.
