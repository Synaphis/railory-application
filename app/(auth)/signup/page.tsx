"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MARKETING_URL } from "@/lib/utils";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: redirectTo },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setError(null);
      setSuccess(true);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6">
      <a href={MARKETING_URL} className="flex items-center gap-2.5 mb-12 hover:opacity-80 transition-opacity">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/railory_logo_black.png" alt="" width={40} height={40} className="w-12 h-12" />
        <span className="font-display text-2xl font-medium text-near-black">
          Railory
        </span>
      </a>

      <div className="w-full max-w-sm">
        {success ? (
          <div className="text-center">
            <h1 className="font-display text-feature-heading font-medium mb-2 text-near-black">
              Check your email
            </h1>
            <p className="text-muted-slate text-sm mb-6">
              We sent a confirmation link to <span className="font-medium text-ink">{email}</span>.
              Click it to activate your account.
            </p>
            <Link href="/login" className="text-action-blue hover:underline text-sm">
              Back to sign in
            </Link>
          </div>
        ) : (
        <>
        <h1 className="font-display text-feature-heading font-medium mb-1 text-near-black">
          Create account
        </h1>
        <p className="text-muted-slate text-sm mb-8">Start discovering your style</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-canvas border border-hairline  px-4 py-2.5 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black focus:ring-1 focus:ring-near-black"
              placeholder="Alex Chen"
            />
          </div>

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
            <label className="block text-xs font-medium text-ink mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-canvas border border-hairline  px-4 py-2.5 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black focus:ring-1 focus:ring-near-black"
              placeholder="Min. 6 characters"
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-muted-slate text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-action-blue hover:underline">
            Sign in
          </Link>
        </p>
        </>
        )}
      </div>
    </main>
  );
}
