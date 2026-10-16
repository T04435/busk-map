-- Learn runs and their suggestions (docs/playlist-architecture.md §1.2). Idempotent.
-- Tables and indexes only: the learn agent that writes them comes later.
CREATE TABLE IF NOT EXISTS learn_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
  -- "Run 3": per Repertoire, max(number)+1 in the insert.
  number INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'done', 'failed', 'fallback')),
  end_code TEXT,
  model TEXT NOT NULL,
  inputs JSONB NOT NULL,
  -- NULL once pruned (last 5 runs, 30 days).
  steps JSONB,
  totals JSONB NOT NULL DEFAULT '{}',
  usage JSONB,
  new_count SMALLINT NOT NULL DEFAULT 0,
  skipped_count SMALLINT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS learn_runs_number ON learn_runs (playlist_id, number);
CREATE INDEX IF NOT EXISTS learn_runs_started ON learn_runs (playlist_id, started_at DESC);
-- One running run per Repertoire, enforced atomically.
CREATE UNIQUE INDEX IF NOT EXISTS learn_runs_one_running ON learn_runs (playlist_id) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS learn_suggestions (
  id BIGSERIAL PRIMARY KEY,
  -- NULL for a song added from a plan's Learn these, or after its run row was capped.
  run_id UUID REFERENCES learn_runs (id) ON DELETE SET NULL,
  playlist_id UUID NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
  song_key TEXT NOT NULL,
  spotify_track_id TEXT CHECK (spotify_track_id ~ '^[A-Za-z0-9]{22}$'),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  artist TEXT NOT NULL CHECK (char_length(artist) BETWEEN 1 AND 80),
  qloo_artist_id TEXT,
  year SMALLINT CHECK (year BETWEEN 1900 AND 2100),
  duration_ms INTEGER CHECK (duration_ms > 0 AND duration_ms <= 3600000),
  image_url TEXT CHECK (image_url ~ '^https://i\.scdn\.co/'),
  source_url TEXT,
  song_source TEXT NOT NULL CHECK (song_source IN ('spotify', 'lastfm', 'plan')),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 240),
  evidence JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'learned', 'dismissed')),
  rank SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  learned_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

-- A song is suggested once per Repertoire, whatever its status (no repeats).
CREATE UNIQUE INDEX IF NOT EXISTS learn_suggestions_key ON learn_suggestions (playlist_id, song_key);
CREATE INDEX IF NOT EXISTS learn_suggestions_status ON learn_suggestions (playlist_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS learn_suggestions_run ON learn_suggestions (run_id, rank);

-- Columns on the 004 tables that point at, or follow from, the learn tables.
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS dismissed_keys TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE playlist_songs ADD COLUMN IF NOT EXISTS suggestion_id BIGINT REFERENCES learn_suggestions (id) ON DELETE SET NULL;
