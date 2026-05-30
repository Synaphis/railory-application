-- ============================================================
-- Morphié — Subscriptions & Usage Tracking
-- Run against your Supabase SQL editor.
-- ============================================================

-- ── subscriptions ──────────────────────────────────────────
-- One row per user. Created at signup (plan = 'free'), upgraded
-- via Stripe webhook. stripe_* columns NULL for free users.
create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  plan          text not null default 'free'
                  check (plan in ('free', 'starter', 'pro')),
  billing_interval text default null
                  check (billing_interval in ('monthly', 'yearly', null)),
  status        text not null default 'active'
                  check (status in ('active', 'past_due', 'canceled', 'trialing')),
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint subscriptions_user_unique unique (user_id)
);

-- ── usage ──────────────────────────────────────────────────
-- Rolling monthly counters. period = first-of-month date string
-- e.g. '2026-05-01'. Upserted by edge functions after each action.
create table if not exists public.usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  period        text not null,  -- 'YYYY-MM-01'
  generations   int not null default 0,
  try_ons       int not null default 0,
  saved_looks   int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint usage_user_period_unique unique (user_id, period)
);

-- ── Indexes ────────────────────────────────────────────────
create index if not exists idx_subscriptions_stripe_customer
  on public.subscriptions (stripe_customer_id);

create index if not exists idx_subscriptions_stripe_sub
  on public.subscriptions (stripe_subscription_id);

create index if not exists idx_usage_user_period
  on public.usage (user_id, period);

-- ── RLS ────────────────────────────────────────────────────
alter table public.subscriptions enable row level security;
alter table public.usage enable row level security;

-- Users can read their own subscription
create policy "Users read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Users can read their own usage
create policy "Users read own usage"
  on public.usage for select
  using (auth.uid() = user_id);

-- Service role (edge functions) can do everything — no policy needed,
-- service role bypasses RLS by default.

-- ── Auto-create subscription row on signup ─────────────────
-- Trigger: after a new user is inserted into auth.users,
-- insert a free-tier subscription row.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Drop existing trigger if any, then create
drop trigger if exists on_auth_user_created_subscription on auth.users;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row
  execute function public.handle_new_user_subscription();

-- ── Atomic usage increment RPC ─────────────────────────────
-- Called from edge functions to safely increment a counter.
-- Uses INSERT ... ON CONFLICT to upsert in one statement.
create or replace function public.increment_usage(
  p_user_id uuid,
  p_period  text,
  p_field   text,
  p_amount  int default 1
)
returns void
language plpgsql
security definer
as $$
begin
  -- Insert a new row or update the matching counter
  if p_field = 'generations' then
    insert into public.usage (user_id, period, generations)
    values (p_user_id, p_period, p_amount)
    on conflict (user_id, period)
    do update set
      generations = usage.generations + p_amount,
      updated_at = now();
  elsif p_field = 'try_ons' then
    insert into public.usage (user_id, period, try_ons)
    values (p_user_id, p_period, p_amount)
    on conflict (user_id, period)
    do update set
      try_ons = usage.try_ons + p_amount,
      updated_at = now();
  elsif p_field = 'saved_looks' then
    insert into public.usage (user_id, period, saved_looks)
    values (p_user_id, p_period, p_amount)
    on conflict (user_id, period)
    do update set
      saved_looks = usage.saved_looks + p_amount,
      updated_at = now();
  else
    raise exception 'Unknown usage field: %', p_field;
  end if;
end;
$$;

-- ── Backfill existing users ────────────────────────────────
-- Run once: give every existing user a free subscription row.
insert into public.subscriptions (user_id, plan, status)
select id, 'free', 'active'
from auth.users
on conflict (user_id) do nothing;
