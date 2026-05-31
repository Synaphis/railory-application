-- ============================================================
-- Async job queue for try-on and generate
--
-- Pattern: client calls *-async edge function which atomically
-- deducts a credit and inserts a 'pending' job row, then kicks
-- off the AI work via EdgeRuntime.waitUntil. The function returns
-- immediately. Client polls or subscribes via Realtime to know
-- when the job is done.
--
-- Both tables: status lifecycle is pending -> processing -> completed
-- (or pending|processing -> failed). RLS scopes reads to the owner.
-- Writes are via service-role (edge functions only).
-- ============================================================

-- ── try_on_jobs ─────────────────────────────────────────────
create table if not exists public.try_on_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  outfit_id      uuid references public.outfits(id) on delete set null,
  request        jsonb not null,             -- echo of the original request body for retry/audit
  status         text not null default 'pending'
                   check (status in ('pending', 'processing', 'completed', 'failed')),
  output_url     text,                       -- public bucket URL when completed
  error          text,                       -- error message if failed
  credit_charged boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists idx_try_on_jobs_user_status
  on public.try_on_jobs (user_id, status, created_at desc);

create index if not exists idx_try_on_jobs_processing_stuck
  on public.try_on_jobs (status, updated_at)
  where status in ('pending', 'processing');

-- ── generate_jobs ───────────────────────────────────────────
create table if not exists public.generate_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  session_id     uuid references public.outfit_sessions(id) on delete set null,
  request        jsonb not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'processing', 'completed', 'failed')),
  outfit_count   int not null default 0,     -- updated as outfits are saved
  error          text,
  credit_charged boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists idx_generate_jobs_user_status
  on public.generate_jobs (user_id, status, created_at desc);

create index if not exists idx_generate_jobs_processing_stuck
  on public.generate_jobs (status, updated_at)
  where status in ('pending', 'processing');

-- ── RLS ─────────────────────────────────────────────────────
alter table public.try_on_jobs   enable row level security;
alter table public.generate_jobs enable row level security;

create policy "Users read own try-on jobs"
  on public.try_on_jobs for select
  using (auth.uid() = user_id);

create policy "Users read own generate jobs"
  on public.generate_jobs for select
  using (auth.uid() = user_id);

-- ── Realtime subscription support ───────────────────────────
-- Allow client-side Realtime subscriptions to row changes.
alter publication supabase_realtime add table public.try_on_jobs;
alter publication supabase_realtime add table public.generate_jobs;

-- ── Stuck-job detector + auto-refund ─────────────────────────
-- Finds jobs stuck in pending/processing >5 minutes, marks them
-- failed, and rolls back the credit. Designed to run via pg_cron
-- every minute, or callable manually for triage.
--
-- Schedule with pg_cron:
--   select cron.schedule('reclaim-stuck-jobs', '* * * * *',
--     $$ select public.reclaim_stuck_jobs() $$);

create or replace function public.reclaim_stuck_jobs()
returns table(reclaimed_try_ons int, reclaimed_generates int)
language plpgsql
security definer
as $$
declare
  v_try_on_count int := 0;
  v_generate_count int := 0;
  v_row record;
  v_period text;
begin
  -- ── Reclaim stuck try-on jobs ─────────────────────────────
  for v_row in
    select id, user_id, credit_charged
    from public.try_on_jobs
    where status in ('pending', 'processing')
      and updated_at < now() - interval '5 minutes'
    for update skip locked
  loop
    -- Mark job failed
    update public.try_on_jobs
    set status = 'failed',
        error = coalesce(error, 'Job timed out — likely AI provider hang or function crash'),
        updated_at = now(),
        completed_at = now()
    where id = v_row.id;

    -- Roll back the credit if it was charged
    if v_row.credit_charged then
      -- Find the user's current period
      select coalesce(s.current_period_start::date::text,
                      to_char(now() at time zone 'UTC', 'YYYY-MM-DD'))
      into v_period
      from public.subscriptions s
      where s.user_id = v_row.user_id;

      -- Fall back to calendar-month if no sub or null period
      if v_period is null then
        v_period := to_char(now() at time zone 'UTC', 'YYYY-MM-01');
      end if;

      perform public.increment_usage(v_row.user_id, v_period, 'try_ons', -1);

      update public.try_on_jobs
      set credit_charged = false
      where id = v_row.id;
    end if;

    v_try_on_count := v_try_on_count + 1;
  end loop;

  -- ── Reclaim stuck generate jobs ───────────────────────────
  for v_row in
    select id, user_id, credit_charged
    from public.generate_jobs
    where status in ('pending', 'processing')
      and updated_at < now() - interval '5 minutes'
    for update skip locked
  loop
    update public.generate_jobs
    set status = 'failed',
        error = coalesce(error, 'Job timed out — likely AI provider hang or function crash'),
        updated_at = now(),
        completed_at = now()
    where id = v_row.id;

    if v_row.credit_charged then
      select coalesce(s.current_period_start::date::text,
                      to_char(now() at time zone 'UTC', 'YYYY-MM-DD'))
      into v_period
      from public.subscriptions s
      where s.user_id = v_row.user_id;

      if v_period is null then
        v_period := to_char(now() at time zone 'UTC', 'YYYY-MM-01');
      end if;

      perform public.increment_usage(v_row.user_id, v_period, 'generations', -1);

      update public.generate_jobs
      set credit_charged = false
      where id = v_row.id;
    end if;

    v_generate_count := v_generate_count + 1;
  end loop;

  return query select v_try_on_count, v_generate_count;
end;
$$;

grant execute on function public.reclaim_stuck_jobs()
  to service_role;
