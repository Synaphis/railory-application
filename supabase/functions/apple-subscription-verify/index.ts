/**
 * POST /apple-subscription-verify
 *
 * Called by the iOS app immediately after a successful StoreKit 2
 * purchase. The app passes the signed transaction JWS; we verify it
 * with Apple's public key, decode it, and upsert the subscriptions
 * row so the user's plan kicks in instantly.
 *
 * After this initial verify, ongoing renewal/cancel events arrive via
 * /apple-webhook (App Store Server Notifications V2) and update the
 * same row.
 *
 * Required: user must be authed with Supabase (Authorization: Bearer
 * <jwt>) so we know which Railory user_id to attach the subscription to.
 *
 * Recommended iOS pattern:
 *   1. User taps "Subscribe to Pro" in the app
 *   2. App calls StoreKit 2 Product.purchase()
 *   3. On verified transaction, app calls:
 *        POST /apple-subscription-verify
 *        Authorization: Bearer <user jwt>
 *        Body: { signed_transaction_info: transaction.jwsRepresentation }
 *   4. Backend verifies + upserts subscription
 *   5. App calls Transaction.finish() to acknowledge the transaction
 */

import {
  authenticateRequest,
  getServiceClient,
  corsResponse,
  jsonResponse,
  errorResponse,
  checkRateLimit,
  rateLimitResponse,
} from "../_shared/auth.ts";
import {
  appleProductToPlan,
  verifyAppleJws,
  type AppleTransactionPayload,
} from "../_shared/apple-iap.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req);
  }

  try {
    const { user, error: authError } = await authenticateRequest(req);
    if (!user) return errorResponse(authError ?? "Unauthorized", 401, req);

    if (!checkRateLimit(user.id, "apple-subscription-verify")) {
      return rateLimitResponse(req);
    }

    const body = (await req.json().catch(() => ({}))) as {
      signed_transaction_info?: string;
    };

    if (!body.signed_transaction_info) {
      return errorResponse(
        "signed_transaction_info is required (StoreKit 2 transaction.jwsRepresentation)",
        400,
        req
      );
    }

    // ── Verify the JWS with Apple's public key ──
    let payload: AppleTransactionPayload;
    try {
      payload = await verifyAppleJws<AppleTransactionPayload>(
        body.signed_transaction_info
      );
    } catch (err) {
      console.error("[apple-verify] JWS verification failed:", err);
      return errorResponse(
        "Invalid signed_transaction_info: " +
          (err instanceof Error ? err.message : "verification failed"),
        400,
        req
      );
    }

    // ── Validate the bundle ID matches our app ──
    const expectedBundle = Deno.env.get("APPLE_BUNDLE_ID");
    if (!expectedBundle) {
      console.error("[apple-verify] APPLE_BUNDLE_ID not set");
      return errorResponse("Server misconfigured: APPLE_BUNDLE_ID", 500, req);
    }
    if (payload.bundleId !== expectedBundle) {
      console.warn(
        "[apple-verify] Bundle ID mismatch:",
        payload.bundleId,
        "expected",
        expectedBundle
      );
      return errorResponse("Bundle ID mismatch", 400, req);
    }

    // ── Map Apple product ID to our plan/interval ──
    const planInfo = appleProductToPlan(payload.productId);
    if (!planInfo) {
      console.warn("[apple-verify] Unknown productId:", payload.productId);
      return errorResponse(
        `Unknown product ID: ${payload.productId}. Make sure it's mapped in _shared/apple-iap.ts APPLE_PRODUCT_TO_PLAN.`,
        400,
        req
      );
    }

    // ── Sanity check: must be auto-renewable subscription ──
    if (payload.type !== "Auto-Renewable Subscription") {
      return errorResponse(
        `Unsupported product type: ${payload.type}. Railory only supports auto-renewable subscriptions.`,
        400,
        req
      );
    }

    // ── Check revocation ──
    if (payload.revocationDate) {
      return errorResponse(
        "This subscription has been revoked by Apple.",
        400,
        req
      );
    }

    // ── (Optional) Cross-check appAccountToken against user_id ──
    // iOS app should set Transaction.appAccountToken = user.id when
    // initiating the purchase. If set, we verify it matches the
    // authenticated user — prevents a JWT from User A from claiming
    // User B's purchase.
    if (
      payload.appAccountToken &&
      payload.appAccountToken !== user.id
    ) {
      console.warn(
        "[apple-verify] appAccountToken mismatch:",
        payload.appAccountToken,
        "user.id:",
        user.id
      );
      return errorResponse(
        "Purchase token does not match authenticated user",
        403,
        req
      );
    }

    // ── Upsert the subscription row ──
    const db = getServiceClient();
    const periodStart = new Date(payload.purchaseDate).toISOString();
    const periodEnd = payload.expiresDate
      ? new Date(payload.expiresDate).toISOString()
      : null;

    const { error: upsertErr } = await db
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan: planInfo.plan,
          billing_interval: planInfo.interval,
          status: "active",
          source: "apple",
          apple_original_transaction_id: payload.originalTransactionId,
          apple_product_id: payload.productId,
          apple_environment: payload.environment,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          // Clear Stripe fields if user is migrating from web → iOS
          stripe_customer_id: null,
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      console.error("[apple-verify] DB upsert failed:", upsertErr);
      return errorResponse("Failed to record subscription", 500, req);
    }

    return jsonResponse(
      {
        ok: true,
        plan: planInfo.plan,
        billing_interval: planInfo.interval,
        current_period_end: periodEnd,
        environment: payload.environment,
      },
      200,
      req
    );
  } catch (err) {
    console.error("[apple-verify] Unexpected error:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
      req
    );
  }
});
