-- Provider back-off (U34, 19 Oct 2026): when Spotify rate-limits the app with a long Retry-After (it was 73,292 s, about 20 h),
-- every instance must stop calling it until then, also after a restart. One row per adapter; the time is when calls may resume.
-- Idempotent: safe on an empty database and on a re-run.
CREATE TABLE IF NOT EXISTS adapter_backoff (
  adapter TEXT PRIMARY KEY,
  until_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
