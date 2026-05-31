-- ============================================================
-- Multi-source subscriptions: Apple IAP + Google Play
--
-- The subscriptions table currently has only Stripe fields. iOS
-- and Android apps must use Apple IAP / Google Play (App Store
-- guidelines), so we need to track where each subscription was
-- purchased and how to verify/renew it.
--
-- This migration is purely additive — all existing Stripe rows
-- get source='stripe' by default and continue to work unchanged.
-- ============================================================

alter table public.subscriptions
  add column if not exists source text not null default 'stripe'
    check (source in ('free', 'stripe', 'apple', 'google')),

  -- Apple IAP fields
  add column if not exists apple_original_transaction_id text unique,
  add column if not exists apple_product_id text,
  add column if not exists apple_environment text
    check (apple_environment is null
           or apple_environment in ('Sandbox', 'Production')),

  -- Google Play Billing fields
  add column if not exists google_purchase_token text unique,
  add column if not exists google_product_id text;

-- Backfill: rows representing actual free-plan users get source='free'.
-- Anyone with a stripe_subscription_id stays source='stripe' (default).
update public.subscriptions
   set source = 'free'
 where stripe_subscription_id is null
   and apple_original_transaction_id is null
   and google_purchase_token is null
   and plan = 'free';

-- Indexes for fast lookup by external identifier (webhook handlers
-- match incoming events against these)
create index if not exists idx_subscriptions_apple_txn
  on public.subscriptions (apple_original_transaction_id)
  where apple_original_transaction_id is not null;

create index if not exists idx_subscriptions_google_token
  on public.subscriptions (google_purchase_token)
  where google_purchase_token is not null;

-- Composite index to find a user's subscriptions across sources
create index if not exists idx_subscriptions_user_source
  on public.subscriptions (user_id, source);
