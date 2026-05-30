"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MARKETING_URL } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Capture ?plan=&interval= from marketing-site checkout CTAs
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    const interval = params.get("interval");
    if (plan && interval) {
      sessionStorage.setItem(
        "pending_checkout",
        JSON.stringify({ plan, interval })
      );
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // If a pending checkout was captured, go through /post-auth to fire it
      const pending = sessionStorage.getItem("pending_checkout");
      router.push(pending ? "/post-auth" : "/generate");
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6">
      <a href={MARKETING_URL} className="flex items-center gap-2.5 mb-12 hover:opacity-80 transition-opacity">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/railory_logo_black.png" alt="" width={40} height={40} className="w-10 h-10" />
        <span className="font-display text-xl font-medium text-near-black">
          Railory
        </span>
      </a>

      <div className="w-full max-w-sm">
        <h1 className="font-display text-card-heading font-medium mb-1 text-near-black">
          Welcome back
        </h1>
        <p className="text-muted-slate text-sm mb-8">Sign in to your account</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-canvas border border-hairline  px-4 py-2.5 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black focus:ring-1 focus:ring-near-black"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="block text-xs font-medium text-ink">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-action-blue hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-canvas border border-hairline  px-4 py-2.5 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black focus:ring-1 focus:ring-near-black"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-700 text-sm bg-red-50 border border-red-200 px-4 py-3 ">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-near-black text-white text-sm font-medium  hover:bg-ink disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-muted-slate text-sm mt-6">
          No account?{" "}
          <Link href="/signup" className="text-action-blue hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
