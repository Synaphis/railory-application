-- ============================================================
-- Cost protection: idempotency + concurrent-job cap
--
-- Two new failure modes the async pattern introduced:
--
--   1. Double-tap: user taps "Try on" twice in 200ms → two jobs
--      created → two AI bills for one intended action.
--      Fix: optional client-supplied idempotency_key. Same key
--      from same user within 5 min → returns existing job_id
--      instead of creating a new one.
--
--   2. Spam queueing: buggy client / retry loop fires N requests
--      instantly, all pass the rate limit, all start parallel
--      AI work, N bills for what should be queueing.
--      Fix: count pending/processing jobs for the user before
--      inserting. Reject with 429 above a cap.
-- ============================================================

-- ── try_on_jobs ─────────────────────────────────────────────
alter table public.try_on_jobs
  add column if not exists client_request_id text;

create index if not exists idx_try_on_jobs_idempotency
  on public.try_on_jobs (user_id, client_request_id, created_at desc)
  where client_request_id is not null;

-- ── generate_jobs (proactive — same protection when async generate ships) ──
alter table public.generate_jobs
  add column if not exists client_request_id text;

create index if not exists idx_generate_jobs_idempotency
  on public.generate_jobs (user_id, client_request_id, created_at desc)
  where client_request_id is not null;

-- Note: existing idx_try_on_jobs_user_status and
-- idx_generate_jobs_user_status already cover the concurrent-job
-- count query. No new index needed for that.
