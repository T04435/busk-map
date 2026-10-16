-- Repertoire storage (src/server/playlist; docs/playlist-architecture.md §1.2). Idempotent.
--
-- One row per device Repertoire, found by the sha256 of an anonymous cookie
-- token (the token itself is never stored). Code names stay "playlist"; the
-- feature is called Repertoire in the UI. Songs hold only what the act can
-- sing (`can_sing`) or has learned (`learned`); the learn suggestions live in
-- 005_learn_runs.sql.
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  act_name TEXT CHECK (char_length(act_name) BETWEEN 1 AND 80),
  sounds_like JSONB NOT NULL DEFAULT '[]',
  usual_pitches JSONB NOT NULL DEFAULT '[]',
  city TEXT NOT NULL DEFAULT 'melbourne',
  -- Bumped on every write: a stale PATCH gets a 409 instead of losing an edit.
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Drives the 13-month expiry.
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS playlists_last_seen ON playlists (last_seen_at);

CREATE TABLE IF NOT EXISTS playlist_songs (
  id BIGSERIAL PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
  -- lib/text.ts:trackKey(artist, title): the dedupe key the setlist uses.
  song_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('can_sing', 'learned')),
  source TEXT NOT NULL CHECK (source IN ('spotify', 'lastfm', 'typed', 'suggested')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  artist TEXT NOT NULL CHECK (char_length(artist) BETWEEN 1 AND 80),
  own BOOLEAN NOT NULL DEFAULT false,
  spotify_track_id TEXT CHECK (spotify_track_id ~ '^[A-Za-z0-9]{22}$'),
  qloo_artist_id TEXT,
  year SMALLINT CHECK (year BETWEEN 1900 AND 2100),
  duration_ms INTEGER CHECK (duration_ms > 0 AND duration_ms <= 3600000),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No repeats in one Repertoire.
CREATE UNIQUE INDEX IF NOT EXISTS playlist_songs_key ON playlist_songs (playlist_id, song_key);
CREATE INDEX IF NOT EXISTS playlist_songs_state ON playlist_songs (playlist_id, state);
