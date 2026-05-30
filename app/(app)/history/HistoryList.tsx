"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import OutfitCard from "@/components/OutfitCard";
import { OutfitSession, OutfitWithItems } from "@/lib/types";
import { formatDate, groupByDate, truncate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api";

type RawProduct = {
  id: string; name: string; price: number; currency: string | null;
  images: string[]; colours: string[];
  style_tags: string[]; occasion_tags: string[]; aesthetic_tags: string[];
  fit: string | null; product_url: string | null; description: string | null;
  subcategory: string | null; brands?: { name: string }; categories?: { name: string };
};
type RawItem = { id: string; outfit_id: string; role: string; products: RawProduct };
type SessionWithCount = OutfitSession & { outfits: { count: number }[] };

function mapItems(itemRows: RawItem[], outfitId: string): OutfitWithItems["items"] {
  return itemRows
    .filter((item) => item.outfit_id === outfitId && item.products)
    .map((item) => ({
      product: {
        id: item.products.id, name: item.products.name,
        brand_name: item.products.brands?.name ?? "Unknown",
        category_name: item.products.categories?.name ?? "",
        subcategory: item.products.subcategory, description: item.products.description,
        price: item.products.price,
        currency: item.products.currency ?? "USD",
        original_price: item.products.price,
        original_currency: item.products.currency ?? "USD",
        colours: item.products.colours ?? [],
        images: item.products.images ?? [], style_tags: item.products.style_tags ?? [],
        occasion_tags: item.products.occasion_tags ?? [],
        aesthetic_tags: item.products.aesthetic_tags ?? [],
        fit: item.products.fit, product_url: item.products.product_url, similarity: 0,
      },
      role: item.role,
    }));
}

export default function HistoryList({ sessions }: { sessions: SessionWithCount[] }) {
  const searchParams = useSearchParams();
  const deepLinked = useRef(false);

  const highlightOutfitId = searchParams.get("outfit");

  const [expanded, setExpanded] = useState<string | null>(null);
  const [sessionOutfits, setSessionOutfits] = useState<Record<string, OutfitWithItems[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const supabase = createClient();
  const grouped = groupByDate(sessions);

  async function handleSave(outfitId: string) {
    await callEdgeFunction("save-outfit", {
      body: { outfit_id: outfitId },
    });
    setSavedIds((prev) => new Set(Array.from(prev).concat(outfitId)));
  }

  async function toggleSession(session: SessionWithCount) {
    if (expanded === session.id) { setExpanded(null); return; }
    setExpanded(session.id);
    if (sessionOutfits[session.id]) return;

    setLoading(session.id);
    try {
      const { data: outfitRows } = await supabase
        .from("outfits").select("*").eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (!outfitRows?.length) { setSessionOutfits((p) => ({ ...p, [session.id]: [] })); return; }

      const { data: itemRows } = await supabase
        .from("outfit_items")
        .select(`id, outfit_id, role, products (id, name, price, currency, images, colours, style_tags, occasion_tags, aesthetic_tags, fit, product_url, description, subcategory, brands ( name ), categories ( name ))`)
        .in("outfit_id", outfitRows.map((o) => o.id));

      setSessionOutfits((p) => ({
        ...p,
        [session.id]: outfitRows.map((o) => ({
          ...o,
          items: mapItems((itemRows ?? []) as unknown as RawItem[], o.id),
        })),
      }));
    } finally { setLoading(null); }
  }

  // Auto-expand session from ?session= query param (e.g. from Try-Ons → View Outfit)
  useEffect(() => {
    const sid = searchParams.get("session");
    if (sid && !deepLinked.current) {
      deepLinked.current = true;
      const match = sessions.find((s) => s.id === sid);
      if (match) toggleSession(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, sessions]);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24">
        <div className="w-16 h-16  bg-stone flex items-center justify-center mb-5">
          <span className="text-2xl">◷</span>
        </div>
        <p className="font-display text-feature-heading font-medium text-ink mb-1">No history yet</p>
        <p className="text-muted-slate text-sm">Your generated outfits will appear here.</p>
      </div>
    );
  }

  // Find the expanded session object for the locked view
  const expandedSession = expanded
    ? sessions.find((s) => s.id === expanded) ?? null
    : null;

  return (
    <div>
      <div className="px-8 pt-6 pb-16">
        <h1 className="font-display text-card-heading font-medium text-near-black mb-6">
          History
        </h1>

        {/* ── Expanded / locked view ── */}
        {expandedSession ? (
          <div>
            {/* Sticky header with prompt + close */}
            <div className="sticky top-0 z-10 bg-canvas border border-near-black mb-4">
              <button
                onClick={() => setExpanded(null)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {expandedSession.initial_prompt}
                  </p>
                  <p className="text-xs text-muted-slate mt-0.5">
                    {(expandedSession.outfits?.[0]?.count ?? 0)} outfit{(expandedSession.outfits?.[0]?.count ?? 0) !== 1 ? "s" : ""} &middot; {formatDate(expandedSession.created_at)}
                  </p>
                </div>
                <span className="text-muted-slate hover:text-ink text-lg ml-4 flex-shrink-0">
                  &times;
                </span>
              </button>
            </div>

            {/* Outfit cards */}
            {loading === expanded ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[1, 2].map((i) => (
                  <div key={i} className="skeleton aspect-[3/5]" />
                ))}
              </div>
            ) : (sessionOutfits[expanded!] ?? []).length === 0 ? (
              <p className="text-muted-slate text-sm">No outfits found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {(sessionOutfits[expanded!] ?? []).map((outfit) => (
                  <div
                    key={outfit.id}
                    className={`aspect-[3/5] ${
                      highlightOutfitId === outfit.id
                        ? "ring-2 ring-coral ring-offset-2 ring-offset-canvas"
                        : ""
                    }`}
                  >
                    <OutfitCard
                      outfit={outfit}
                      onSave={handleSave}
                      isSaved={savedIds.has(outfit.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Session list (collapsed view) ── */
          <>
            {Object.entries(grouped).map(([date, daySessions]) => (
              <div key={date} className="mb-8">
                <p className="text-xs font-medium text-muted-slate mb-3 pb-2 border-b border-hairline">
                  {date}
                </p>
                <div className="space-y-1.5">
                  {daySessions.map((session) => {
                    const count = session.outfits?.[0]?.count ?? 0;
                    return (
                      <div key={session.id} className="border border-hairline">
                        <button
                          onClick={() => toggleSession(session)}
                          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-stone/40 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-ink">
                              {truncate(session.initial_prompt, 72)}
                            </p>
                            <p className="text-xs text-muted-slate mt-0.5">
                              {count} outfit{count !== 1 ? "s" : ""} &middot; {formatDate(session.created_at)}
                            </p>
                          </div>
                          <span className="text-muted-slate text-lg ml-4">+</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
