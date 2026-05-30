"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startCheckout } from "@/lib/billing";

/**
 * Post-authentication landing page.
 *
 * Reads `pending_checkout` from sessionStorage (set by /signup when a
 * `?plan=&interval=` query came from the marketing site). If present,
 * fires Stripe checkout. Otherwise, sends the user to /generate.
 */
export default function PostAuthPage() {
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("pending_checkout");
    if (!raw) {
      router.replace("/generate");
      return;
    }

    try {
      const { plan, interval } = JSON.parse(raw) as {
        plan: "starter" | "pro";
        interval: "monthly" | "yearly";
      };
      sessionStorage.removeItem("pending_checkout");
      // Fire checkout — redirects to Stripe
      startCheckout(plan, interval).catch(() => {
        router.replace("/billing");
      });
    } catch {
      sessionStorage.removeItem("pending_checkout");
      router.replace("/generate");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-canvas flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-2 border-hairline border-t-near-black animate-spin mb-4" />
      <p className="text-sm text-muted-slate font-mono uppercase tracking-wider">
        Setting things up&hellip;
      </p>
    </main>
  );
}
