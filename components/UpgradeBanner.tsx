"use client";

import Link from "next/link";
import { planLabel, type LimitError } from "@/lib/billing";

/**
 * Inline upgrade prompt shown when a user hits a plan limit.
 * Renders a compact banner with the limit details and a CTA to /billing.
 */
export default function UpgradeBanner({
  error,
  onDismiss,
}: {
  error: LimitError;
  onDismiss?: () => void;
}) {
  const isFeatureGated = error.code === "FEATURE_GATED";

  return (
    <div className="border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">
          {isFeatureGated
            ? `${error.feature} requires an upgrade`
            : `${resourceLabel(error.resource)} limit reached`}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          {isFeatureGated
            ? `This feature is not available on the ${planLabel(error.plan)} plan.`
            : `You've used ${error.current} of ${error.limit} ${resourceLabel(error.resource)} this month on the ${planLabel(error.plan)} plan.`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/billing"
          className="bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-black/90 transition-colors"
        >
          Upgrade
        </Link>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-amber-400 hover:text-amber-600 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function resourceLabel(resource?: string): string {
  const labels: Record<string, string> = {
    generations: "generations",
    try_ons: "virtual try-ons",
    saved_looks: "saved looks",
  };
  return resource ? labels[resource] ?? resource : "usage";
}
