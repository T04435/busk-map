-- "Plan my week" (V2 plan phase 4, release 1.3.0): one record per week run, /w/<id>. Idempotent and safe on an empty
-- database (no other table needed). 007 was reserved for the Week (see 008): the runner applies unrecorded files in name
-- order, so it still applies after 013. Never edit it once applied.
--
-- A week is its day plans: each planned day is a normal row in `plans` (/p/<id>). This row lists the seven days (date,
-- status, the day plan's id or the Hive's reason), the request as the act sent it, and the run's steps, so a reload
-- replays the run without a new model or Qloo call, and the calendar export is built from the stored day plans.
CREATE TABLE IF NOT EXISTS weeks (
  id CHAR(9) PRIMARY KEY CHECK (id ~ '^[0-9A-Za-z]{9}$'),
  request JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'done', 'failed')),
  -- [{date, status: pending|ready|not-worth|cant-play|failed, planId, reason}] x 7
  days JSONB NOT NULL,
  summary TEXT,
  notes JSONB NOT NULL DEFAULT '[]',
  -- The run's step events (status, notes, tool starts and ends, totals), for the replay.
  events JSONB NOT NULL DEFAULT '[]',
  usage JSONB,
  totals JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS weeks_created ON weeks (created_at);
