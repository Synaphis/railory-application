/**
 * Plan limits for Railory.
 *
 * Each plan defines the monthly caps for generations, try-on renders,
 * saved looks, try-on angles, and whether custom avatar uploads are allowed.
 */

export interface PlanLimits {
  generations: number;
  try_ons: number;
  saved_looks: number;
  try_on_angles: number;
  custom_avatar: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    generations: 5,
    try_ons: 0,
    saved_looks: 10,
    try_on_angles: 0,
    custom_avatar: false,
  },
  starter: {
    generations: 50,
    try_ons: 30,
    saved_looks: 50,
    try_on_angles: 3,
    custom_avatar: false,
  },
  pro: {
    generations: 200,
    try_ons: 100,
    saved_looks: 500,
    try_on_angles: 7,
    custom_avatar: true,
  },
};

/** Get limits for a plan (defaults to free). */
export function getLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

/**
 * Stripe Price IDs — loaded from env at runtime.
 * Set these as Supabase secrets:
 *   STRIPE_PRICE_STARTER_MONTHLY, STRIPE_PRICE_STARTER_YEARLY,
 *   STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY
 */
export function getStripePriceId(
  plan: "starter" | "pro",
  interval: "monthly" | "yearly"
): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  const id = Deno.env.get(key);
  if (!id) throw new Error(`Missing env: ${key}`);
  return id;
}

/** Reverse-map a Stripe Price ID back to plan + interval. */
export function planFromPriceId(
  priceId: string
): { plan: string; interval: string } | null {
  const mapping: Record<string, { plan: string; interval: string }> = {};

  for (const plan of ["starter", "pro"] as const) {
    for (const interval of ["monthly", "yearly"] as const) {
      const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
      const id = Deno.env.get(key);
      if (id) mapping[id] = { plan, interval };
    }
  }

  return mapping[priceId] ?? null;
}
