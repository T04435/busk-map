# Busk Map

Know where to play, and what to play there.

Busk Map is an agent for street performers. Pick a city and a time slot, and it finds the pitches whose crowd matches your music, near busy places that are open at that hour. It then builds a setlist for each pitch from the songs you can play. Taste data from the Qloo API. Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/). Live at https://buskmap.app.

Busk Map is not affiliated with or endorsed by Qloo.

## Hive, the agent

The Hive is Busk Map's research agent. It picks which Qloo questions to ask and writes the reasons, but it never makes up a number, a song or a place, and it never says a pitch is legal. The app calls it "the Hive" wherever it speaks.

Status: in development.

## Run locally

Needs Node.js 24 and pnpm.

```bash
pnpm install
vercel env pull .env.local --yes --scope cubanos-dev   # or: cp .env.example .env.local and fill in keys
pnpm dev
```

Open http://localhost:3000. Try an example performer or plan your own act.

Without `QLOO_API_KEY` (or with `QLOO_MOCK=1`), Qloo is served by a local mock of its documented HTTP contract, and every Qloo number is labelled "Qloo test data (local mock)". The other sources stay live. See [docs/qloo-mock.md](docs/qloo-mock.md).

No keys at all? Run fully offline with synthetic data and a mock model:

```bash
BUSKMAP_OFFLINE=1 BUSKMAP_ALLOW_FAULTS=1 pnpm dev
```

## Deploy

See [docs/deploy.md](docs/deploy.md): environment variables, BotID, the WAF rate-limit rule and the warm-up.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm check:fixtures && pnpm build
pnpm test:e2e          # builds and starts an offline server, then runs the judge paths
```

## Spotify purge

`pnpm purge:spotify` deletes or nulls the Spotify data stored in Postgres (cover images, Spotify years and durations, artist profile snapshots, research snapshots, learn-run steps, cached runs, Spotify pacer rows). It keeps the Spotify IDs and our own data, and it is safe to run twice. Run it once on 10 Nov 2026 against production (Spotify Developer Terms IV.3). Before that date it refuses unless you pass `--force`. It uses the same main-database guard as the other scripts.

## Data
- Taste data from the Qloo API, used under Qloo's Terms of Use (18 kinds of call, see the /brain page; a local mock without a key)
- OpenStreetMap public spaces and venue names (© OpenStreetMap contributors, ODbL)
- City of Melbourne busking locations (CC BY)
- Ticketmaster Discovery API, Last.fm, Open-Meteo

Plans keep their full step data: a stored plan or run holds every step the agent took, with the data each tool returned. That Qloo-derived data is stored privately server-side (Postgres) and is never committed to this repository.

## Licence
MIT. See [LICENSE](LICENSE).
