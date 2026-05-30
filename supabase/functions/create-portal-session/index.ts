import {
  authenticateRequest,
  getServiceClient,
  corsResponse,
  jsonResponse,
  errorResponse,
  checkRateLimit,
  rateLimitResponse,
} from "../_shared/auth.ts";
import { getUserSubscription } from "../_shared/subscription.ts";
import Stripe from "npm:stripe@17.7.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-04-30.basil",
});

/**
 * POST /create-portal-session
 *
 * No body required. Returns a URL to the Stripe Customer Portal
 * where users can manage billing, change plans, and cancel.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);

  try {
    const { user, error: authError } = await authenticateRequest(req);
    if (!user) return errorResponse(authError ?? "Unauthorized", 401);

    if (!checkRateLimit(user.id, "create-portal-session")) {
      return rateLimitResponse(req);
    }

    const db = getServiceClient();
    const sub = await getUserSubscription(db, user.id);

    if (!sub.stripe_customer_id) {
      return errorResponse(
        "No billing account found. Subscribe to a plan first.",
        400
      );
    }

    const origin =
      req.headers.get("origin") ?? Deno.env.get("APP_URL") ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/billing`,
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("[create-portal-session]", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});
