-- Song covers persist (user's call, 18 Oct 2026; U03): the track's own image or album art, and the artist's photo, kept on
-- the Repertoire's songs so a reload shows them without a new research run. Both optional: typed songs have neither, and
-- older rows fill in on their next save or research (no backfill). https only, at most 500 characters (Spotify i.scdn.co,
-- Qloo and Last.fm image hosts). Idempotent: safe on an empty database and on a re-run. 007 stays reserved (Week).
ALTER TABLE playlist_songs ADD COLUMN IF NOT EXISTS image TEXT CHECK (image ~ '^https://' AND char_length(image) <= 500);
ALTER TABLE playlist_songs ADD COLUMN IF NOT EXISTS artist_image TEXT CHECK (artist_image ~ '^https://' AND char_length(artist_image) <= 500);
