-- Repertoire research (hackathons/qloo-2026/repertoire-research-spec.md): the snapshot of the last research run, saved on
-- the Repertoire so /repertoire shows the results without a new run and the busk form reads the act's genre tags.
-- JSON of lib/repertoire-research.ts:ResearchSnapshot ({version, spotifyArtistId, fullRunId, runId, runNumber, mode, at,
-- steps}); songs and suggestions stay in their own tables. A research run is a learn_runs row (inputs.kind), so no new
-- table. Idempotent: safe on an empty database and on a re-run. 008 is the act profile.
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS research JSONB;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS research_at TIMESTAMPTZ;
