-- The act profile kept in the Repertoire: act name, "Artists you sound like" and the Spotify artist profile
-- (the busk form and /repertoire prefill from them, so they are not asked for every time). Idempotent, no backfill.
-- act_name and sounds_like already exist from 004; the guards make this safe on any database state. 007 is reserved
-- for the Week branch: the runner applies unrecorded files in name order, so a later 007 still applies.
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS act_name TEXT CHECK (char_length(act_name) BETWEEN 1 AND 80);
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS sounds_like JSONB NOT NULL DEFAULT '[]';
-- The Spotify artist id (22 characters) of the act's own profile; the link is derived for display.
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS spotify_artist_id TEXT CHECK (spotify_artist_id ~ '^[A-Za-z0-9]{22}$');
-- For the profile features built on top: a snapshot of the Spotify artist profile ({name, images[{url,width,height}], genres[],
-- followers?, fetchedAt}) and the act's own artist resolved in Qloo.
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS spotify_profile JSONB;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS qloo_artist_id TEXT;
