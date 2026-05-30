"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/generate", label: "Generate" },
  { href: "/saved", label: "Saved" },
  { href: "/history", label: "History" },
  { href: "/profile", label: "Profile" },
];

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="w-52 flex-shrink-0 border-r border-hairline bg-canvas flex flex-col py-5">
      {/* Logo */}
      <div className="px-5 mb-8">
        <Link href="/generate" className="font-display text-lg font-medium tracking-tight text-near-black">
          Railory
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center px-3 py-2 text-sm rounded-sm",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-stone text-ink font-medium"
                : "text-muted-slate hover:text-ink hover:bg-stone/50"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-5 pt-5 border-t border-hairline">
        <p className="text-muted-slate text-xs truncate mb-2.5">{userEmail}</p>
        <button
          onClick={handleSignOut}
          className="text-xs text-muted-slate hover:text-red-600"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
