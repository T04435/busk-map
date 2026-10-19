-- Short plan links (/p/<id>, src/server/plans). Idempotent.
--
-- One row per plan request per Melbourne day. `request` is the validated plan
-- request as the act typed it (act name, artists, songs, slot, permit,
-- weights); the tip-log history is never stored. Once the agent finishes,
-- the plan and its steps are kept so the link opens at once.
CREATE TABLE IF NOT EXISTS plans (
  id CHAR(9) PRIMARY KEY CHECK (id ~ '^[0-9A-Za-z]{9}$'),
  request JSONB NOT NULL,
  -- sha256 of the canonical request (keys sorted) and the example id, if any.
  request_hash TEXT NOT NULL,
  example_id TEXT,
  -- Melbourne date the id was made: the same request on the same day reuses it.
  day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The finished run: the plan, the agent's steps (stream events), who wrote the reasons, and the run's plan-store key and day.
  plan JSONB,
  steps JSONB,
  explanations TEXT CHECK (explanations IN ('ai', 'template')),
  run_key TEXT,
  run_day DATE,
  run_started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS plans_request_day ON plans (request_hash, day);
