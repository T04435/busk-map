-- Plain-AI baseline comparisons (src/server/comparisons). No personal data:
-- an example id or "custom", the slot, Busk Map's pitch ids and scores, the
-- plain AI's pick statuses and scores, and the overlap. Idempotent.
CREATE TABLE IF NOT EXISTS baseline_comparisons (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  performer_key TEXT NOT NULL,
  city TEXT NOT NULL,
  slot TEXT NOT NULL,
  overlap SMALLINT NOT NULL,
  ours JSONB NOT NULL,
  plain JSONB NOT NULL,
  our_avg REAL NOT NULL,
  plain_avg REAL
);

CREATE INDEX IF NOT EXISTS baseline_comparisons_created_at ON baseline_comparisons (created_at);
