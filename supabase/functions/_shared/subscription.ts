/**
 * Subscription & usage helpers for edge functions.
 *
 * All functions take a Supabase service-role client so they
 * can read/write without RLS restrictions.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { getLimits, type PlanLimits } from "./plans.ts";
import { CORS_HEADERS } from "./auth.ts";

// ── Types ──────────────────────────────────────────────────

export interface Subscription {
  plan: string;
  status: string;
  billing_interval: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

export interface UsageRow {
  generations: number;
  try_ons: number;
  saved_looks: number;
}

// ── Period helper ──────────────────────────────────────────

/**
 * Add one calendar month to `date`, anchored to `anchorDay`. If the
 * target month has fewer days than `anchorDay` (e.g. Feb after Jan 31),
 * clamps to the last day of the target month.
 */
function addOneMonth(date: Date, anchorDay: number): Date {
  const month = date.getUTCMonth();
  const targetYear =
    month === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
  const targetMonth = (month + 1) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();
  const day = Math.min(anchorDay, lastDay);
  return new Date(Date.UTC(targetYear, targetMonth, day, 0, 0, 0, 0));
}

/**
 * For a subscription starting on `start`, return the most recent
 * monthly anniversary at or before `now`. Walks forward one month
 * at a time from `start` (max ~12 iterations for a yearly sub).
 */
function monthlyAnchor(start: Date, now: Date): Date {
  const anchorDay = start.getUTCDate();
  let current = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      anchorDay,
      0,
      0,
      0,
      0
    )
  );
  // Safety bound — should never loop more than 12 times in practice.
  for (let i = 0; i < 24; i++) {
    const next = addOneMonth(current, anchorDay);
    if (next > now) return current;
    current = next;
  }
  return current;
}

/**
 * Current usage period key.
 *
 * Paid users get a billing-anniversary cycle: the period key is the
 * ISO date of the most recent monthly anniversary of their
 * `current_period_start`. For monthly subs, Stripe updates
 * current_period_start each cycle so the anchor coincides with it.
 * For yearly subs, the anchor walks forward monthly within the
 * yearly billing cycle — so "200 generations / month" really means
 * 200 each month for 12 months, not 2,400 spread across the year.
 *
 * Free users fall back to calendar-month boundaries (first-of-month
 * UTC) — there's no billing cycle to anchor to.
 */
export function currentPeriod(
  sub?: Pick<Subscription, "plan" | "current_period_start"> | null
): string {
  if (!sub || sub.plan === "free" || !sub.current_period_start) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  const anchor = monthlyAnchor(new Date(sub.current_period_start), new Date());
  return anchor.toISOString().slice(0, 10);
}

// ── Queries ────────────────────────────────────────────────

/** Get the user's subscription row. Returns free defaults if missing or expired. */
export async function getUserSubscription(
  db: SupabaseClient,
  userId: string
): Promise<Subscription> {
  const { data } = await db
    .from("subscriptions")
    .select(
      "plan, status, billing_interval, stripe_customer_id, current_period_start, current_period_end"
    )
    .eq("user_id", userId)
    .single();

  const FREE_SUB: Subscription = {
    plan: "free",
    status: "active",
    billing_interval: null,
    stripe_customer_id: null,
    current_period_start: null,
    current_period_end: null,
  };

  if (!data) return FREE_SUB;

  const sub = data as Subscription;

  // If subscription is not active (past_due, canceled, etc.), treat as free
  if (sub.status !== "active" && sub.status !== "trialing") {
    return { ...sub, plan: "free" };
  }

  // If subscription period has expired (webhook may be delayed), treat as free
  if (sub.current_period_end && sub.plan !== "free") {
    const endDate = new Date(sub.current_period_end);
    // Allow 3-day grace period for webhook delivery delays
    const grace = new Date(endDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    if (new Date() > grace) {
      return { ...sub, plan: "free" };
    }
  }

  return sub;
}

/** Get usage counters for the current period. Returns zeros if no row.
 *  Pass `sub` if you already have it (avoids an extra query). */
export async function getPeriodUsage(
  db: SupabaseClient,
  userId: string,
  sub?: Subscription
): Promise<UsageRow> {
  const subscription = sub ?? (await getUserSubscription(db, userId));
  const period = currentPeriod(subscription);

  const { data } = await db
    .from("usage")
    .select("generations, try_ons, saved_looks")
    .eq("user_id", userId)
    .eq("period", period)
    .single();

  return {
    generations: data?.generations ?? 0,
    try_ons: data?.try_ons ?? 0,
    saved_looks: data?.saved_looks ?? 0,
  };
}

/** Count total saved outfits for the user (not period-scoped). */
export async function getSavedCount(
  db: SupabaseClient,
  userId: string
): Promise<number> {
  const { count } = await db
    .from("saved_outfits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return count ?? 0;
}

// ── Usage increment ────────────────────────────────────────

type UsageField = "generations" | "try_ons" | "saved_looks";

/** Increment a usage counter for the current period. Upserts the row.
 *  Pass `sub` if available so the period key uses the billing cycle. */
export async function incrementUsage(
  db: SupabaseClient,
  userId: string,
  field: UsageField,
  amount = 1,
  sub?: Subscription
): Promise<void> {
  const subscription = sub ?? (await getUserSubscription(db, userId));
  const period = currentPeriod(subscription);

  // Try to upsert: insert or increment
  const { error } = await db.rpc("increment_usage", {
    p_user_id: userId,
    p_period: period,
    p_field: field,
    p_amount: amount,
  });

  if (error) {
    // Fallback: try raw upsert
    console.warn("[usage] RPC failed, using fallback upsert:", error.message);

    const { data: existing } = await db
      .from("usage")
      .select("id, generations, try_ons, saved_looks")
      .eq("user_id", userId)
      .eq("period", period)
      .single();

    if (existing) {
      await db
        .from("usage")
        .update({
          [field]: (existing[field] ?? 0) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await db.from("usage").insert({
        user_id: userId,
        period,
        [field]: amount,
      });
    }
  }
}

// ── Limit checks ───────────────────────────────────────────

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  plan: string;
}

/**
 * Atomic check-and-increment via the check_and_increment_usage SQL
 * function. Holds a row lock for the duration of the check + write,
 * so concurrent callers can never both pass the limit boundary.
 *
 * If over limit, the counter is NOT incremented and allowed=false.
 * If the expensive operation fails later, call rollbackUsage() to
 * decrement.
 */
export async function checkAndIncrementGeneration(
  db: SupabaseClient,
  userId: string
): Promise<LimitCheckResult> {
  const sub = await getUserSubscription(db, userId);
  const limits = getLimits(sub.plan);
  const period = currentPeriod(sub);

  const { data, error } = await db.rpc("check_and_increment_usage", {
    p_user_id: userId,
    p_period: period,
    p_field: "generations",
    p_limit: limits.generations,
  });

  if (error) {
    console.error("[check_and_increment_usage:generations]", error);
    // Fail closed — never allow generation if the limit RPC errors,
    // even on a transient failure. Billing integrity > availability.
    return {
      allowed: false,
      current: 0,
      limit: limits.generations,
      plan: sub.plan,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const allowed = !!row?.allowed;
  const current = row?.new_count ?? 0;

  return { allowed, current, limit: limits.generations, plan: sub.plan };
}

/** Legacy non-atomic check (for read-only limit display). */
export async function checkGenerationLimit(
  db: SupabaseClient,
  userId: string
): Promise<LimitCheckResult> {
  const sub = await getUserSubscription(db, userId);
  const usage = await getPeriodUsage(db, userId, sub);
  const limits = getLimits(sub.plan);

  return {
    allowed: usage.generations < limits.generations,
    current: usage.generations,
    limit: limits.generations,
    plan: sub.plan,
  };
}

/** Atomic check-and-increment try-on usage (same pattern as generations). */
export async function checkAndIncrementTryOn(
  db: SupabaseClient,
  userId: string
): Promise<LimitCheckResult> {
  const sub = await getUserSubscription(db, userId);
  const limits = getLimits(sub.plan);

  if (limits.try_ons === 0) {
    return { allowed: false, current: 0, limit: 0, plan: sub.plan };
  }

  const period = currentPeriod(sub);
  const { data, error } = await db.rpc("check_and_increment_usage", {
    p_user_id: userId,
    p_period: period,
    p_field: "try_ons",
    p_limit: limits.try_ons,
  });

  if (error) {
    console.error("[check_and_increment_usage:try_ons]", error);
    return {
      allowed: false,
      current: 0,
      limit: limits.try_ons,
      plan: sub.plan,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const allowed = !!row?.allowed;
  const current = row?.new_count ?? 0;

  return { allowed, current, limit: limits.try_ons, plan: sub.plan };
}

/** Legacy non-atomic check. */
export async function checkTryOnLimit(
  db: SupabaseClient,
  userId: string
): Promise<LimitCheckResult> {
  const sub = await getUserSubscription(db, userId);
  const usage = await getPeriodUsage(db, userId, sub);
  const limits = getLimits(sub.plan);

  return {
    allowed: limits.try_ons > 0 && usage.try_ons < limits.try_ons,
    current: usage.try_ons,
    limit: limits.try_ons,
    plan: sub.plan,
  };
}

/** Roll back a pre-incremented usage counter (call when the expensive op fails). */
export async function rollbackUsage(
  db: SupabaseClient,
  userId: string,
  field: UsageField
): Promise<void> {
  await incrementUsage(db, userId, field, -1);
}

/** Check if the user can save another outfit. */
export async function checkSavedLimit(
  db: SupabaseClient,
  userId: string
): Promise<LimitCheckResult> {
  const sub = await getUserSubscription(db, userId);
  const savedCount = await getSavedCount(db, userId);
  const limits = getLimits(sub.plan);

  return {
    allowed: savedCount < limits.saved_looks,
    current: savedCount,
    limit: limits.saved_looks,
    plan: sub.plan,
  };
}

/** Check if user's plan allows custom avatar upload. */
export async function checkCustomAvatarAllowed(
  db: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; plan: string }> {
  const sub = await getUserSubscription(db, userId);
  const limits = getLimits(sub.plan);

  return { allowed: limits.custom_avatar, plan: sub.plan };
}

/** Check the allowed try-on angles for the user's plan. */
export async function getAllowedAngles(
  db: SupabaseClient,
  userId: string
): Promise<{ angles: number; plan: string }> {
  const sub = await getUserSubscription(db, userId);
  const limits = getLimits(sub.plan);

  return { angles: limits.try_on_angles, plan: sub.plan };
}

// ── Limit error response ───────────────────────────────────

/** Build a 403 limit-exceeded response with upgrade hint. */
export function limitResponse(
  resource: string,
  check: LimitCheckResult
): Response {
  return new Response(
    JSON.stringify({
      error: `${resource} limit reached`,
      code: "LIMIT_EXCEEDED",
      resource,
      current: check.current,
      limit: check.limit,
      plan: check.plan,
      upgrade_url: "/billing",
    }),
    {
      status: 403,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
}

/** Build a 403 feature-gated response. */
export function featureGatedResponse(
  feature: string,
  plan: string
): Response {
  return new Response(
    JSON.stringify({
      error: `${feature} is not available on the ${plan} plan`,
      code: "FEATURE_GATED",
      feature,
      plan,
      upgrade_url: "/billing",
    }),
    {
      status: 403,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
}
