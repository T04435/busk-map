-- Cities busks are planned in (V2 2.1, "Any city", 25 Oct 2026): one row per city slug (src/lib/city.ts), upserted each time
-- a plan runs there (src/server/cities-store.ts). Melbourne is the built-in city; any other comes from the Open-Meteo geocoder.
-- Idempotent: safe on an empty database and on a re-run.
CREATE TABLE IF NOT EXISTS cities (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
  timezone TEXT NOT NULL,
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  plans_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS cities_last_used ON cities (last_used_at DESC);
