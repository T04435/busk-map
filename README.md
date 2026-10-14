# Busk Map

Know where to play, and what to play there.

Busk Map is an agent for street performers. Pick a city and a time slot, and it finds the pitches whose crowd matches your music, near busy places that are open at that hour. It then builds a setlist for each pitch from the songs you can play. It is built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

Status: in development.

## Run locally

Needs Node.js 22+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then fill in the keys
pnpm dev
```

Open http://localhost:3000.

## Data
- [Qloo](https://qloo.com) taste API (hackathon key)
- City of Melbourne pedestrian counting system and busking locations (CC BY)
- Ticketmaster Discovery API, Last.fm, Open-Meteo

No Qloo response data is stored in this repository.

## Licence
MIT. See [LICENSE](LICENSE).
