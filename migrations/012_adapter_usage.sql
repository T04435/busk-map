-- Provider daily cap (Spotify volume, 19 Oct 2026): one row per adapter per UTC day with the calls made that day, across
-- all instances. At the daily cap the Spotify breaker (adapter_backoff, 011) opens until the next UTC midnight.
-- Idempotent: safe on an empty database and on a re-run.
CREATE TABLE IF NOT EXISTS adapter_usage (
  adapter TEXT NOT NULL,
  day DATE NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (adapter, day)
);
