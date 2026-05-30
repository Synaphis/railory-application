import { callEdgeFunction } from "./api";

// ── Types ──────────────────────────────────────────────────

export interface UsageData {
  plan: string;
  status: string;
  billing_interval: string | null;
  current_period_end: string | null;
  limits: {
    generations: number;
    try_ons: number;
    saved_looks: number;
    try_on_angles: number;
    custom_avatar: boolean;
  };
  usage: {
    generations: number;
    try_ons: number;
    saved_looks: number;
  };
}

export interface LimitError {
  error: string;
  code: "LIMIT_EXCEEDED" | "FEATURE_GATED";
  resource?: string;
  feature?: string;
  current?: number;
  limit?: number;
  plan: string;
  upgrade_url: string;
}

// ── API calls ──────────────────────────────────────────────

/** Fetch the user's current plan, limits, and usage. */
export async function getUsage(): Promise<UsageData> {
  const res = await callEdgeFunction("get-usage");
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json();
}

/** Create a Stripe Checkout session and redirect. */
export async function startCheckout(
  plan: "starter" | "pro",
  interval: "monthly" | "yearly"
): Promise<void> {
  const res = await callEdgeFunction("create-checkout-session", {
    method: "POST",
    body: { plan, interval },
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Failed to create checkout session");
  }

  const { url } = await res.json();
  if (url) window.location.href = url;
}

/** Open the Stripe Customer Portal. */
export async function openBillingPortal(): Promise<void> {
  const res = await callEdgeFunction("create-portal-session", {
    method: "POST",
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Failed to open billing portal");
  }

  const { url } = await res.json();
  if (url) window.location.href = url;
}

// ── Helpers ────────────────────────────────────────────────

/** Check if an API response is a limit error and parse it. */
export function parseLimitError(
  status: number,
  data: Record<string, unknown> | null
): LimitError | null {
  if (
    status === 403 &&
    (data?.code === "LIMIT_EXCEEDED" || data?.code === "FEATURE_GATED")
  ) {
    return data as unknown as LimitError;
  }
  return null;
}

/** Human-readable plan name. */
export function planLabel(plan: string): string {
  const labels: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    pro: "Pro",
  };
  return labels[plan] ?? plan;
}
