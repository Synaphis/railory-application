"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/generate", label: "Generate" },
  { href: "/saved", label: "Saved" },
  { href: "/try-ons", label: "Try-Ons" },
  { href: "/history", label: "History" },
  { href: "/profile", label: "Profile" },
  { href: "/billing", label: "Billing" },
];

export default function TopBar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  // Close the mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [mobileOpen]);

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 h-12 border-b border-hairline bg-canvas flex items-center justify-between px-4 md:px-6">
        {/* ── Left: brand + (desktop) nav ── */}
        <div className="flex items-center gap-4 md:gap-8 min-w-0">
          <Link
            href="/generate"
            className="font-display text-base font-medium tracking-tight text-near-black flex-shrink-0"
          >
            Railory
          </Link>

          {/* Desktop nav — hidden under md */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-3 py-1.5 text-sm transition-colors",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "text-ink font-medium bg-stone"
                    : "text-muted-slate hover:text-ink"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* ── Right: (desktop) email + sign out  /  (mobile) hamburger ── */}
        <div className="hidden md:flex items-center gap-4">
          <span className="text-muted-slate text-xs truncate max-w-[180px]">
            {userEmail}
          </span>
          <button
            onClick={handleSignOut}
            className="text-xs text-muted-slate hover:text-ink"
          >
            Sign out
          </button>
        </div>

        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden w-9 h-9 -mr-2 flex items-center justify-center text-ink hover:bg-stone transition-colors"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          )}
        </button>
      </header>

      {/* ── Mobile drawer ──
            z-40 so it sits above any in-page UI (saved-grid unsave button
            is z-30, OutfitCard overlays are z-10..20). The header above
            remains z-30 — they don't visually overlap because drawer
            starts at top:48 (below the 48px header). */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40" style={{ top: 48 }}>
          {/* Backdrop */}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="absolute inset-0 bg-black/30 animate-fade-in"
          />
          {/* Slide-down panel */}
          <div className="absolute top-0 left-0 right-0 bg-canvas border-b border-hairline animate-slide-up">
            <nav className="flex flex-col py-2">
              {NAV_ITEMS.map(({ href, label }) => {
                const active =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "px-5 py-3 text-base transition-colors border-l-2",
                      active
                        ? "text-ink font-medium bg-stone border-near-black"
                        : "text-muted-slate hover:text-ink border-transparent"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-hairline px-5 py-4 flex items-center justify-between">
              <span className="text-xs text-muted-slate truncate flex-1 mr-3">
                {userEmail}
              </span>
              <button
                onClick={handleSignOut}
                className="text-xs text-muted-slate hover:text-ink font-medium flex-shrink-0"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
