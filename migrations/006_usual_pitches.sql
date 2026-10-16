-- The last few busks planned with the Repertoire, newest first: [{key, at, name, lat, lon}]
-- (docs/playlist-architecture.md D4). usual_pitches is derived from this list; recording a busk
-- is bookkeeping, so it does not bump the Repertoire's revision. Idempotent.
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS recent_busks JSONB NOT NULL DEFAULT '[]';
