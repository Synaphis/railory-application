import {
  authenticateRequest,
  getServiceClient,
  corsResponse,
  jsonResponse,
  errorResponse,
  checkRateLimit,
  rateLimitResponse,
} from "../_shared/auth.ts";
import { getLimits } from "../_shared/plans.ts";
import {
  getUserSubscription,
  getPeriodUsage,
  getSavedCount,
} from "../_shared/subscription.ts";

/**
 * GET /get-usage
 *
 * Returns the user's current plan, limits, and usage for the billing page.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);

  try {
    const { user, error: authError } = await authenticateRequest(req);
    if (!user) return errorResponse(authError ?? "Unauthorized", 401);

    if (!checkRateLimit(user.id, "get-usage")) {
      return rateLimitResponse(req);
    }

    const db = getServiceClient();

    const [sub, usage, savedCount] = await Promise.all([
      getUserSubscription(db, user.id),
      getPeriodUsage(db, user.id),
      getSavedCount(db, user.id),
    ]);

    const limits = getLimits(sub.plan);

    return jsonResponse({
      plan: sub.plan,
      status: sub.status,
      billing_interval: sub.billing_interval,
      current_period_end: sub.current_period_end,
      limits: {
        generations: limits.generations,
        try_ons: limits.try_ons,
        saved_looks: limits.saved_looks,
        try_on_angles: limits.try_on_angles,
        custom_avatar: limits.custom_avatar,
      },
      usage: {
        generations: usage.generations,
        try_ons: usage.try_ons,
        saved_looks: savedCount,
      },
    });
  } catch (err) {
    console.error("[get-usage]", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});
