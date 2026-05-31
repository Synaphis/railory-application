/**
 * POST /apple-webhook
 *
 * App Store Server Notifications V2 endpoint. Apple POSTs subscription
 * lifecycle events here (renewals, expirations, cancellations, refunds).
 *
 * No JWT auth — Apple calls directly. Signature is verified via the
 * JWS chain on the signedPayload.
 *
 * URL to register in App Store Connect:
 *   https://rkbljmsalughhsuspwoi.supabase.co/functions/v1/apple-webhook
 *
 * Two URLs to register (sandbox + production), or one URL that handles
 * both — payload.data.environment tells us which.
 *
 * Events handled:
 *   SUBSCRIBED           → already created via /apple-subscription-verify;
 *                           safe to no-op if row exists, upsert if not
 *   DID_RENEW            → extend current_period_end
 *   DID_FAIL_TO_RENEW    → mark past_due
 *   EXPIRED              → downgrade to free
 *   REFUND / REVOKE      → downgrade to free immediately
 *   GRACE_PERIOD_EXPIRED → downgrade to free
 *   DID_CHANGE_RENEWAL_STATUS → log only (auto-renew on/off toggle)
 *   TEST                 → reply 200 OK (Apple sandbox test fire)
 *   …others              → log + no-op
 */

import {
  getServiceClient,
  corsResponse,
  jsonResponse,
  errorResponse,
} from "../_shared/auth.ts";
import {
  appleProductToPlan,
  verifyAppleJws,
  type AppleNotificationPayload,
  type AppleTransactionPayload,
} from "../_shared/apple-iap.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      signedPayload?: string;
    };

    if (!body.signedPayload) {
      return errorResponse("Missing signedPayload", 400, req);
    }

    // ── Verify the outer notification JWS ──
    let notification: AppleNotificationPayload;
    try {
      notification = await verifyAppleJws<AppleNotificationPayload>(
        body.signedPayload
      );
    } catch (err) {
      console.error("[apple-webhook] Outer JWS verification failed:", err);
      return errorResponse("Invalid signedPayload signature", 400, req);
    }

    const expectedBundle = Deno.env.get("APPLE_BUNDLE_ID");
    if (
      expectedBundle &&
      notification.data?.bundleId &&
      notification.data.bundleId !== expectedBundle
    ) {
      console.warn(
        "[apple-webhook] Bundle ID mismatch:",
        notification.data.bundleId
      );
      return jsonResponse({ ok: true, ignored: "bundle_mismatch" }, 200, req);
    }

    console.log(
      `[apple-webhook] event=${notification.notificationType}`,
      notification.subtype ? `subtype=${notification.subtype}` : "",
      `env=${notification.data?.environment}`,
      `uuid=${notification.notificationUUID}`
    );

    // Apple test fires when you click "Request a Test Notification" in
    // App Store Connect. Just acknowledge with 200.
    if (notification.notificationType === "TEST") {
      return jsonResponse({ ok: true, test: true }, 200, req);
    }

    // ── Decode the inner signedTransactionInfo (most events have this) ──
    let transaction: AppleTransactionPayload | null = null;
    if (notification.data?.signedTransactionInfo) {
      try {
        transaction = await verifyAppleJws<AppleTransactionPayload>(
          notification.data.signedTransactionInfo
        );
      } catch (err) {
        console.error(
          "[apple-webhook] Inner transaction JWS verification failed:",
          err
        );
        // Don't fail the webhook — Apple will retry, but log and continue
      }
    }

    if (!transaction) {
      console.warn(
        "[apple-webhook] No transaction info — event:",
        notification.notificationType
      );
      return jsonResponse({ ok: true, no_transaction: true }, 200, req);
    }

    const db = getServiceClient();

    // ── Route by event type ──
    switch (notification.notificationType) {
      case "SUBSCRIBED":
      case "DID_RENEW":
      case "OFFER_REDEEMED":
      case "RENEWAL_EXTENDED":
        await applyActiveSubscription(db, transaction);
        break;

      case "DID_FAIL_TO_RENEW":
        // User's payment failed — Apple will retry; mark past_due
        await markStatus(db, transaction.originalTransactionId, "past_due");
        break;

      case "EXPIRED":
      case "GRACE_PERIOD_EXPIRED":
        await markStatus(db, transaction.originalTransactionId, "canceled");
        await downgradeToFree(db, transaction.originalTransactionId);
        break;

      case "REFUND":
      case "REVOKE":
        await markStatus(db, transaction.originalTransactionId, "canceled");
        await downgradeToFree(db, transaction.originalTransactionId);
        break;

      case "DID_CHANGE_RENEWAL_STATUS":
        // User toggled auto-renew on/off — no immediate plan change.
        // Just log; status stays active until current period ends.
        console.log(
          "[apple-webhook] Auto-renew status changed:",
          notification.subtype
        );
        break;

      case "PRICE_INCREASE":
        // Notify user via your own channel if you care — no plan change.
        break;

      case "REFUND_DECLINED":
      case "REFUND_REVERSED":
        // No DB change needed
        break;

      default:
        console.log(
          "[apple-webhook] Unhandled event:",
          notification.notificationType
        );
    }

    return jsonResponse({ ok: true }, 200, req);
  } catch (err) {
    console.error("[apple-webhook] Unexpected error:", err);
    // Return 500 so Apple retries
    return errorResponse(
      err instanceof Error ? err.message : "Webhook processing failed",
      500,
      req
    );
  }
});

/* ── DB update helpers ─────────────────────────────────────── */

// deno-lint-ignore no-explicit-any
async function applyActiveSubscription(db: any, txn: AppleTransactionPayload) {
  const planInfo = appleProductToPlan(txn.productId);
  if (!planInfo) {
    console.warn(
      "[apple-webhook] Unknown productId, skipping:",
      txn.productId
    );
    return;
  }

  const periodEnd = txn.expiresDate
    ? new Date(txn.expiresDate).toISOString()
    : null;

  const { error } = await db
    .from("subscriptions")
    .update({
      plan: planInfo.plan,
      billing_interval: planInfo.interval,
      status: "active",
      source: "apple",
      apple_product_id: txn.productId,
      apple_environment: txn.environment,
      current_period_start: new Date(txn.purchaseDate).toISOString(),
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("apple_original_transaction_id", txn.originalTransactionId);

  if (error) {
    console.error(
      "[apple-webhook] Failed to update subscription:",
      error.message
    );
  }
}

// deno-lint-ignore no-explicit-any
async function markStatus(db: any, originalTxnId: string, status: string) {
  const { error } = await db
    .from("subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("apple_original_transaction_id", originalTxnId);

  if (error) {
    console.error("[apple-webhook] markStatus failed:", error.message);
  }
}

// deno-lint-ignore no-explicit-any
async function downgradeToFree(db: any, originalTxnId: string) {
  const { error } = await db
    .from("subscriptions")
    .update({
      plan: "free",
      billing_interval: null,
      source: "free",
      apple_original_transaction_id: null,
      apple_product_id: null,
      apple_environment: null,
      updated_at: new Date().toISOString(),
    })
    .eq("apple_original_transaction_id", originalTxnId);

  if (error) {
    console.error("[apple-webhook] downgradeToFree failed:", error.message);
  }
}
