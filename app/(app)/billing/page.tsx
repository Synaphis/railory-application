"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getUsage,
  startCheckout,
  openBillingPortal,
  planLabel,
  type UsageData,
} from "@/lib/billing";

function Meter({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isWarning = pct >= 80;
  const isMaxed = pct >= 100;

  return (
    <div className="flex items-center gap-4">
      <span className="text-[13px] text-muted-slate w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-stone">
        <div
          className={`h-full transition-all duration-500 ${
            isMaxed
              ? "bg-red-500"
              : isWarning
                ? "bg-amber-500"
                : "bg-near-black"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] font-mono text-muted-slate w-16 text-right tabular-nums">
        {current}/{limit}
      </span>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  if (plan === "free") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-muted-slate bg-stone">
        Free
      </span>
    );
  }
  if (plan === "pro") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-white bg-near-black">
        Pro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-ink bg-stone border border-hairline">
      Starter
    </span>
  );
}

const PLAN_FEATURES: Record<string, { generations: string; tryOn: string; looks: string; avatar: string }> = {
  free: { generations: "5 / month", tryOn: "Not included", looks: "10 saved", avatar: "No" },
  starter: { generations: "50 / month", tryOn: "3 angles", looks: "50 saved", avatar: "No" },
  pro: { generations: "200 / month", tryOn: "7 angles", looks: "500 saved", avatar: "Yes" },
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">("yearly");
  const [error, setError] = useState<string | null>(null);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    getUsage()
      .then(setUsage)
      .catch(() => setError("Failed to load billing data"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckout(plan: "starter" | "pro") {
    setCheckoutLoading(plan);
    try {
      await startCheckout(plan, interval);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setCheckoutLoading(null);
    }
  }

  async function handleManageBilling() {
    setCheckoutLoading("portal");
    try {
      await openBillingPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open portal");
      setCheckoutLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-slate text-sm">Loading...</p>
      </div>
    );
  }

  if (error && !usage) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[var(--error-red)] text-sm">{error}</p>
      </div>
    );
  }

  if (!usage) return null;

  const isFree = usage.plan === "free";
  const isPaid = usage.plan === "starter" || usage.plan === "pro";
  const features = PLAN_FEATURES[usage.plan] ?? PLAN_FEATURES.free;

  const prices: Record<string, Record<string, number>> = {
    starter: { monthly: 9.99, yearly: 95 },
    pro: { monthly: 24.99, yearly: 239 },
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-10">
        {/* Banners */}
        {success && (
          <div className="bg-pale-green border border-[#c6efc0] px-4 py-3 mb-6">
            <p className="text-sm text-[#1a5c14]">
              Subscription activated. Welcome to {planLabel(usage.plan)}.
            </p>
          </div>
        )}
        {canceled && (
          <div className="bg-[#fff8f0] border border-[#f0d9b5] px-4 py-3 mb-6">
            <p className="text-sm text-[#8a5a00]">
              Checkout was canceled. No charges were made.
            </p>
          </div>
        )}
        {error && usage && (
          <div className="bg-[#fff5f5] border border-[#f0c0c0] px-4 py-3 mb-6">
            <p className="text-sm text-[var(--error-red)]">{error}</p>
          </div>
        )}

        {/* Current plan */}
        <div className="mb-10">
          <h1 className="text-lg font-display font-medium text-ink mb-1">Billing</h1>
          <p className="text-[13px] text-muted-slate">Manage your plan and usage</p>
        </div>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-[13px] font-mono uppercase tracking-wider text-muted-slate">Current plan</h2>
              <PlanBadge plan={usage.plan} />
            </div>
            {isPaid && (
              <button
                onClick={handleManageBilling}
                disabled={checkoutLoading === "portal"}
                className="text-[13px] text-muted-slate hover:text-ink transition-colors disabled:opacity-50"
              >
                {checkoutLoading === "portal" ? "Opening..." : "Manage"}
              </button>
            )}
          </div>

          <div className="border border-hairline divide-y divide-[var(--card-border)]">
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[13px] text-muted-slate">Generations</span>
              <span className="text-[13px] text-ink">{features.generations}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[13px] text-muted-slate">Virtual try-on</span>
              <span className="text-[13px] text-ink">{features.tryOn}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[13px] text-muted-slate">Saved looks</span>
              <span className="text-[13px] text-ink">{features.looks}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[13px] text-muted-slate">Custom avatar</span>
              <span className="text-[13px] text-ink">{features.avatar}</span>
            </div>
            {isPaid && usage.billing_interval && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13px] text-muted-slate">Billing cycle</span>
                <span className="text-[13px] text-ink capitalize">{usage.billing_interval}</span>
              </div>
            )}
            {isPaid && usage.current_period_end && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13px] text-muted-slate">Renews</span>
                <span className="text-[13px] text-ink">
                  {new Date(usage.current_period_end).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Usage */}
        <section className="mb-10">
          <h2 className="text-[13px] font-mono uppercase tracking-wider text-muted-slate mb-5">Usage this period</h2>
          <div className="space-y-4">
            <Meter label="Generations" current={usage.usage.generations} limit={usage.limits.generations} />
            {usage.limits.try_ons > 0 && (
              <Meter label="Try-ons" current={usage.usage.try_ons} limit={usage.limits.try_ons} />
            )}
            <Meter label="Saved looks" current={usage.usage.saved_looks} limit={usage.limits.saved_looks} />
          </div>
        </section>

        {/* Upgrade options */}
        {(isFree || usage.plan === "starter") && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[13px] font-mono uppercase tracking-wider text-muted-slate">
                {isFree ? "Upgrade" : "Change plan"}
              </h2>
              <div className="flex items-center bg-stone p-0.5">
                <button
                  onClick={() => setInterval("monthly")}
                  className={`px-3 py-1 text-[12px] font-medium transition-colors ${
                    interval === "monthly"
                      ? "bg-white text-ink shadow-sm"
                      : "text-muted-slate hover:text-ink"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setInterval("yearly")}
                  className={`px-3 py-1 text-[12px] font-medium transition-colors ${
                    interval === "yearly"
                      ? "bg-white text-ink shadow-sm"
                      : "text-muted-slate hover:text-ink"
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {(isFree ? ["starter", "pro"] as const : ["pro"] as const).map((plan) => {
                const price = prices[plan][interval];
                const monthlyEquiv = interval === "yearly" ? Math.round(price / 12) : price;
                const isCurrentlyLoading = checkoutLoading === plan;

                return (
                  <div
                    key={plan}
                    className="border border-hairline p-5 flex items-center justify-between gap-4 hover:border-[var(--muted-slate)] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[15px] font-medium text-ink">{planLabel(plan)}</span>
                          {plan === "pro" && (
                            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-slate bg-stone px-1.5 py-0.5">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted-slate">
                          {plan === "starter"
                            ? "50 generations, virtual try-on, 50 saved looks"
                            : "200 generations, 7 try-on angles, custom avatars, 500 looks"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                      <div className="text-right">
                        <span className="text-[15px] font-medium text-ink">${monthlyEquiv}</span>
                        <span className="text-[12px] text-muted-slate">/mo</span>
                        {interval === "yearly" && (
                          <p className="text-[11px] text-muted-slate">${price}/yr</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleCheckout(plan)}
                        disabled={isCurrentlyLoading}
                        className="px-4 py-2 text-[13px] font-medium bg-near-black text-white hover:bg-ink transition-colors disabled:opacity-50"
                      >
                        {isCurrentlyLoading ? "..." : "Upgrade"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {interval === "yearly" && (
              <p className="text-[11px] text-muted-slate mt-3">Save ~20% with yearly billing</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
