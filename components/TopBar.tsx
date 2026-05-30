"use client";

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="h-12 flex-shrink-0 border-b border-hairline bg-canvas flex items-center justify-between px-6">
      <div className="flex items-center gap-8">
        <Link
          href="/generate"
          className="font-display text-base font-medium tracking-tight text-near-black"
        >
          Railory
        </Link>

        <nav className="flex items-center gap-1">
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

      <div className="flex items-center gap-4">
        <span className="text-muted-slate text-xs">{userEmail}</span>
        <button
          onClick={handleSignOut}
          className="text-xs text-muted-slate hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
