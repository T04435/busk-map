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

After the first deploy, check one live agent run from `/plan?example=acoustic` ("Plan with the agent (live)") and one song search on the landing page. A 403 or 503 there means the client and server lists are out of step; the function logs say "bot check failed" with the reason.

## 3. WAF rate-limit rule

The app has a per-instance limiter (6 agent runs and 12 comparisons per IP per 10 minutes, 120 searches per IP per minute), but instances don't share it. Add this rule so the limit holds across the whole deployment. Hobby allows one rate-limit rule per project.

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
- The app already explains a 429 ("Too many plans in a short time…").
- Counters are per region, so the real ceiling is a little higher than 20 for traffic spread across regions.

On Pro you can add a second, stricter rule for the agent alone: path `^/api/plan$`, Fixed Window **600s**, limit **10**, key IP; and a third for search: path `^/api/repertoire$`, Fixed Window **60s**, limit **120**, key IP.

## 4. Warm-up

- The landing page calls `POST /api/warm` 300 ms after it loads. That builds the three example plans (no model calls) and stores them in the shared remote cache (`"use cache: remote"` in `src/server/agent/preload.ts`), so the first click on an example is fast on whichever instance serves it.
- Healthy example plans are cached for 10 minutes (stale after 5, gone after an hour); a plan built while a source was down is kept for one minute, then rebuilt.
- After a deploy, open the landing page once (or `curl -X POST https://<domain>/api/warm`, which is not BotID-protected and costs nothing) to warm the new deployment.
- No cron is configured. If cold starts are a problem, a Vercel cron calling `/api/warm` every 10 minutes would fix it, but Hobby crons run at most once a day, so it needs Pro. Ask before adding one.

## 5. Before pointing the domain

- [ ] `pnpm check` and `pnpm test:e2e` green on the commit being deployed.
- [ ] Run the e2e tests against the preview: `PLAYWRIGHT_BASE_URL=https://<preview> VERCEL_AUTOMATION_BYPASS_SECRET=… pnpm test:e2e` (fault and mock tests skip themselves).
- [ ] The Qloo badge says "Live Qloo data" once the key is set (response shapes were verified against live Qloo on 2026-10-15; see `docs/qloo-mock.md`).
- [ ] One live agent run and one comparison work in production (BotID passes).
- [ ] The WAF rule shows matches in Firewall → Overview.
- [ ] AI Gateway budget set.
- [ ] OpenFreeMap tile terms confirmed (open issue in `architecture.md`).

## Privacy notes for the tip log

The tip log is stored in the performer's browser (localStorage). Plans read only a summary of it (takings per hour per pitch, at most 15 pitches for the 6 most recent performers) from a first-party cookie, `buskmap_tips`, so it is sent to Busk Map's own server with page requests but never stored there and never put in a URL. Example plans' remote cache entries hold only the built-in example data.
