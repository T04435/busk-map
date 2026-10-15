-- Agent v2 (src/server/comparisons, src/server/agent/plan-store.ts). Idempotent.
--
-- 1. baseline_comparisons gets one row per plan (run_key: a hash of the plan
--    request and day), filled by the baseline and by the agent run in either
--    order. The agent part: the engine's top 3 and Claude's top 3 (pitch ids
--    and engine scores only, no personal data).
ALTER TABLE baseline_comparisons ADD COLUMN IF NOT EXISTS run_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS baseline_comparisons_run_key ON baseline_comparisons (run_key);
ALTER TABLE baseline_comparisons ADD COLUMN IF NOT EXISTS agent JSONB;
ALTER TABLE baseline_comparisons ADD COLUMN IF NOT EXISTS agent_avg REAL;
ALTER TABLE baseline_comparisons ADD COLUMN IF NOT EXISTS agent_engine_avg REAL;
ALTER TABLE baseline_comparisons ADD COLUMN IF NOT EXISTS agent_differs BOOLEAN;
ALTER TABLE baseline_comparisons ALTER COLUMN overlap DROP NOT NULL;
ALTER TABLE baseline_comparisons ALTER COLUMN ours DROP NOT NULL;
ALTER TABLE baseline_comparisons ALTER COLUMN plain DROP NOT NULL;
ALTER TABLE baseline_comparisons ALTER COLUMN our_avg DROP NOT NULL;

-- 2. Finished agent runs (their stream events, step data included) and
--    plain-AI baselines, keyed by the plan, so every server instance can
--    replay them. Rows expire (examples 6 h, others 15 min) and are deleted
--    when read after expiry. Holds tool results at runtime only.
CREATE TABLE IF NOT EXISTS plan_store (
  kind TEXT NOT NULL,
  plan_key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (kind, plan_key)
);

CREATE INDEX IF NOT EXISTS plan_store_expires_at ON plan_store (expires_at);
