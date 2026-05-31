"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";
import { MARKETING_URL } from "@/lib/utils";
import {
  validateSignupEmail,
  validateSignupPassword,
  TURNSTILE_SITE_KEY,
} from "@/lib/auth-validation";

// ── Cloudflare Turnstile (env-gated, see lib/auth-validation.ts) ──
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Turnstile state (only active when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set)
  const [captchaToken, setCaptchaToken] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

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

  // Render the Turnstile widget once the script is loaded and the
  // container is mounted. Safe no-op if the site key is not configured.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !scriptLoaded || !widgetRef.current) return;
    if (widgetIdRef.current) return; // already rendered
    if (!window.turnstile) return;

    widgetIdRef.current = window.turnstile.render(widgetRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => setCaptchaToken(token),
      "expired-callback": () => setCaptchaToken(""),
      "error-callback": () => setCaptchaToken(""),
      theme: "light",
    });
  }, [scriptLoaded]);

  function resetCaptcha() {
    setCaptchaToken("");
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // ── Client-side validation (fast-fail before network) ──
    const emailError = validateSignupEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const passwordError = validateSignupPassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Please complete the captcha challenge.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectTo,
        // captchaToken is only sent when present; Supabase ignores it
        // unless captcha is also enabled in the project dashboard.
        captchaToken: captchaToken || undefined,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      // Reset captcha so user can retry without page refresh
      resetCaptcha();
    } else {
      setError(null);
      setSuccess(true);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6">
      {/* Load Turnstile script only when a site key is configured */}
      {TURNSTILE_SITE_KEY && (
        <Script
          src={TURNSTILE_SCRIPT_URL}
          strategy="lazyOnload"
          onLoad={() => setScriptLoaded(true)}
        />
      )}

      <a
        href={MARKETING_URL}
        className="flex items-center gap-2.5 mb-12 hover:opacity-80 transition-opacity"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/railory_logo_black.png"
          alt=""
          width={40}
          height={40}
          className="w-12 h-12"
        />
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
              We sent a confirmation link to{" "}
              <span className="font-medium text-ink">{email}</span>. Click it to
              activate your account.
            </p>
            <Link
              href="/login"
              className="text-action-blue hover:underline text-sm"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-feature-heading font-medium mb-1 text-near-black">
              Create account
            </h1>
            <p className="text-muted-slate text-sm mb-8">
              Start discovering your style
            </p>

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
                  minLength={8}
                  maxLength={72}
                  className="w-full bg-canvas border border-hairline  px-4 py-2.5 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black focus:ring-1 focus:ring-near-black"
                  placeholder="Min. 8 characters"
                />
              </div>

              {/* Turnstile widget — only rendered when site key is set */}
              {TURNSTILE_SITE_KEY && (
                <div ref={widgetRef} className="flex justify-center" />
              )}

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
