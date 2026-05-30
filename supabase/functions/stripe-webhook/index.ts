import { getServiceClient } from "../_shared/auth.ts";
import { planFromPriceId } from "../_shared/plans.ts";
import Stripe from "npm:stripe@17.7.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-04-30.basil",
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

/**
 * POST /stripe-webhook
 *
 * Handles Stripe webhook events. This function has verify_jwt = false
 * because Stripe calls it directly (no user auth header).
 *
 * Events handled:
 *   - checkout.session.completed  → create/activate subscription
 *   - invoice.paid               → renew period, confirm active
 *   - customer.subscription.updated → plan change, status change
 *   - customer.subscription.deleted → cancel subscription
 */
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // ── Verify webhook signature ──
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET);
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    const db = getServiceClient();

    // ── Route events ──
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(db, session);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(db, invoice);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(db, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(db, subscription);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-webhook] Unexpected error:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }
});

// ── Event handlers ──────────────────────────────────────────

async function handleCheckoutCompleted(
  db: ReturnType<typeof getServiceClient>,
  session: Stripe.Checkout.Session
) {
  if (session.mode !== "subscription") return;

  const userId = session.subscription
    ? (session.metadata?.supabase_user_id ??
        (typeof session.subscription === "string"
          ? await resolveUserFromSubscription(db, session.subscription)
          : null))
    : null;

  // Resolve from subscription metadata if not on session
  const stripeSubscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;

  const resolvedUserId =
    userId ?? stripeSubscription?.metadata?.supabase_user_id ?? null;

  if (!resolvedUserId) {
    console.error("[stripe-webhook] No user ID found in checkout session");
    return;
  }

  const priceId = stripeSubscription?.items?.data?.[0]?.price?.id;
  const planInfo = priceId ? planFromPriceId(priceId) : null;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  const { error } = await db
    .from("subscriptions")
    .update({
      plan: planInfo?.plan ?? "starter",
      billing_interval: planInfo?.interval ?? "monthly",
      status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      current_period_start: stripeSubscription?.current_period_start
        ? new Date(stripeSubscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: stripeSubscription?.current_period_end
        ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", resolvedUserId);

  if (error) {
    console.error("[stripe-webhook] Failed to update subscription:", error);
  } else {
    console.log(
      `[stripe-webhook] Activated ${planInfo?.plan} for user ${resolvedUserId}`
    );
  }
}

async function handleInvoicePaid(
  db: ReturnType<typeof getServiceClient>,
  invoice: Stripe.Invoice
) {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) return;

  // Fetch the full subscription to get period dates
  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = stripeSub.items.data[0]?.price?.id;
  const planInfo = priceId ? planFromPriceId(priceId) : null;

  const updates: Record<string, unknown> = {
    status: "active",
    current_period_start: new Date(
      stripeSub.current_period_start * 1000
    ).toISOString(),
    current_period_end: new Date(
      stripeSub.current_period_end * 1000
    ).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (planInfo) {
    updates.plan = planInfo.plan;
    updates.billing_interval = planInfo.interval;
  }

  const { error } = await db
    .from("subscriptions")
    .update(updates)
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("[stripe-webhook] invoice.paid update failed:", error);
  }
}

async function handleSubscriptionUpdated(
  db: ReturnType<typeof getServiceClient>,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price?.id;
  const planInfo = priceId ? planFromPriceId(priceId) : null;

  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    trialing: "trialing",
    unpaid: "past_due",
    incomplete: "past_due",
    incomplete_expired: "canceled",
    paused: "canceled",
  };

  const updates: Record<string, unknown> = {
    status: statusMap[subscription.status] ?? "active",
    current_period_start: new Date(
      subscription.current_period_start * 1000
    ).toISOString(),
    current_period_end: new Date(
      subscription.current_period_end * 1000
    ).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (planInfo) {
    updates.plan = planInfo.plan;
    updates.billing_interval = planInfo.interval;
  }

  const { error } = await db
    .from("subscriptions")
    .update(updates)
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("[stripe-webhook] subscription.updated failed:", error);
  }
}

async function handleSubscriptionDeleted(
  db: ReturnType<typeof getServiceClient>,
  subscription: Stripe.Subscription
) {
  // Downgrade to free when subscription is canceled/expired
  const { error } = await db
    .from("subscriptions")
    .update({
      plan: "free",
      status: "canceled",
      billing_interval: null,
      stripe_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("[stripe-webhook] subscription.deleted failed:", error);
  } else {
    console.log(
      `[stripe-webhook] Downgraded subscription ${subscription.id} to free`
    );
  }
}

/** Try to find the user_id from a subscription ID already in our DB. */
async function resolveUserFromSubscription(
  db: ReturnType<typeof getServiceClient>,
  subscriptionId: string
): Promise<string | null> {
  const { data } = await db
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  return data?.user_id ?? null;
}
