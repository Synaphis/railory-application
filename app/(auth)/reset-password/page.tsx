"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MARKETING_URL } from "@/lib/utils";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/generate");
      router.refresh();
    }
  }

  if (authed === null) {
    return <main className="min-h-screen bg-canvas" />;
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
        {!authed ? (
          <div className="text-center">
            <h1 className="font-display text-feature-heading font-medium mb-2 text-near-black">
              Link expired
            </h1>
            <p className="text-muted-slate text-sm mb-6">
              This password reset link is no longer valid. Request a new one to continue.
            </p>
            <Link href="/forgot-password" className="text-action-blue hover:underline text-sm">
              Request a new link
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-feature-heading font-medium mb-1 text-near-black">
              Set new password
            </h1>
            <p className="text-muted-slate text-sm mb-8">
              Choose a new password for your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">
                  New password
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

              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-canvas border border-hairline  px-4 py-2.5 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black focus:ring-1 focus:ring-near-black"
                  placeholder="Re-enter password"
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
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
