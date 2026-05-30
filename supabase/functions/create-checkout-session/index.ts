import {
  authenticateRequest,
  getServiceClient,
  corsResponse,
  jsonResponse,
  errorResponse,
  checkRateLimit,
  rateLimitResponse,
} from "../_shared/auth.ts";
import { getStripePriceId } from "../_shared/plans.ts";
import { getUserSubscription } from "../_shared/subscription.ts";
import Stripe from "npm:stripe@17.7.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-04-30.basil",
});

/**
 * POST /create-checkout-session
 *
 * Body: { plan: "starter" | "pro", interval: "monthly" | "yearly" }
 *
 * Creates a Stripe Checkout Session and returns the URL.
 * If the user already has a Stripe customer ID, reuses it.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);

  try {
    const { user, error: authError } = await authenticateRequest(req);
    if (!user) return errorResponse(authError ?? "Unauthorized", 401);

    if (!checkRateLimit(user.id, "create-checkout-session")) {
      return rateLimitResponse(req);
    }

    const { plan, interval } = (await req.json()) as {
      plan: "starter" | "pro";
      interval: "monthly" | "yearly";
    };

    if (!["starter", "pro"].includes(plan)) {
      return errorResponse("Invalid plan");
    }
    if (!["monthly", "yearly"].includes(interval)) {
      return errorResponse("Invalid interval");
    }

    const priceId = getStripePriceId(plan, interval);
    const db = getServiceClient();
    const sub = await getUserSubscription(db, user.id);

    // Reuse existing Stripe customer or create one
    let customerId = sub.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Persist the customer ID immediately
      await db
        .from("subscriptions")
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }

    // Build success/cancel URLs
    const origin =
      req.headers.get("origin") ?? Deno.env.get("APP_URL") ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan },
      },
      allow_promotion_codes: true,
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("[create-checkout-session]", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});
