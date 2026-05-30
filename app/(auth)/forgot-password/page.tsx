"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MARKETING_URL } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
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
              If an account exists for <span className="font-medium text-ink">{email}</span>, we sent a password reset link. It expires in 1 hour.
            </p>
            <Link href="/login" className="text-action-blue hover:underline text-sm">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-feature-heading font-medium mb-1 text-near-black">
              Reset password
            </h1>
            <p className="text-muted-slate text-sm mb-8">
              Enter your email and we&rsquo;ll send a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="text-center text-muted-slate text-sm mt-6">
              Remembered it?{" "}
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
