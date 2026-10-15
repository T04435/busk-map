# Busk Map

Know where to play, and what to play there.

Busk Map is an agent for street performers. Pick a city and a time slot, and it finds the pitches whose crowd matches your music, near busy places that are open at that hour. It then builds a setlist for each pitch from the songs you can play. It is built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

Status: in development.

## Run locally

Needs Node.js 24 and pnpm.

```bash
pnpm install
vercel env pull .env.local --yes --scope cubanos-dev   # or: cp .env.example .env.local and fill in keys
pnpm dev
```

Open http://localhost:3000. Try an example performer, plan your own act, or plan a week.

Without `QLOO_API_KEY` (or with `QLOO_MOCK=1`), Qloo is served by a local mock of its documented HTTP contract, and every Qloo number is labelled "Qloo test data (local mock)". The other sources stay live. See [docs/qloo-mock.md](docs/qloo-mock.md).

No keys at all? Run fully offline with synthetic data and a mock model:

```bash
BUSKMAP_OFFLINE=1 BUSKMAP_ALLOW_FAULTS=1 pnpm dev
```

## Deploy

See [docs/deploy.md](docs/deploy.md): environment variables, BotID, the WAF rate-limit rule and the warm-up.

## Tip log

After a session, log what you earned at a pitch ("Log your takings" on a plan, history at `/tips`). The log stays in the browser; pitches where you earn more than your own average get a small bonus (at most +5 out of 100) in your next plans and week. The example performers come with labelled example sessions.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm check:fixtures && pnpm build
pnpm test:e2e          # builds and starts an offline server, then runs the judge paths
```

## Data
- [Qloo](https://qloo.com) taste API (hackathon key; a local mock until it arrives)
- OpenStreetMap public spaces and venue names (© OpenStreetMap contributors, ODbL)
- City of Melbourne pedestrian counting system and busking locations (CC BY)
- Ticketmaster Discovery API, Last.fm, Open-Meteo

No Qloo response data is stored in this repository. At runtime, raw Qloo-derived step data is kept 7 days; plans and links persist (a daily job strips each run's raw tool output after 7 days, keeping the plan, the step labels, inputs, summaries and notes; see [docs/deploy.md](docs/deploy.md#retention-raw-step-data-7-days)).

## Licence
MIT. See [LICENSE](LICENSE).
