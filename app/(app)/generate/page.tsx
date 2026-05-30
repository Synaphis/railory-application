"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PromptInput from "@/components/PromptInput";
import FilterBar from "@/components/FilterBar";
import OutfitCarousel from "@/components/OutfitCarousel";
import { GenerateFilters, OutfitSession, OutfitWithItems } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api";
import { truncate, formatDate } from "@/lib/utils";
import { parseLimitError, type LimitError } from "@/lib/billing";
import UpgradeBanner from "@/components/UpgradeBanner";

const DEFAULT_FILTERS: GenerateFilters = {
  budget_min: 0,
  budget_max: 500,
  gender: "unisex",
  brands: [],
};

type RawItem = {
  outfit_id: string;
  role: string;
  products: {
    id: string; name: string; price: number; currency: string | null;
    images: string[];
    colours: string[]; style_tags: string[]; occasion_tags: string[];
    aesthetic_tags: string[]; fit: string | null; product_url: string | null;
    description: string | null; subcategory: string | null;
    brands?: { name: string }; categories?: { name: string };
  };
};

export default function GeneratePageWrapper() {
  return (
    <Suspense fallback={null}>
      <GeneratePage />
    </Suspense>
  );
}

function GeneratePage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const deepLinked = useRef(false);

  const [prompt, setPrompt] = useState("");
  const [filters, setFilters] = useState<GenerateFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [outfits, setOutfits] = useState<OutfitWithItems[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [sessions, setSessions] = useState<OutfitSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const [refinePrompt, setRefinePrompt] = useState("");
  const [refineLoading, setRefineLoading] = useState(false);
  const [limitError, setLimitError] = useState<LimitError | null>(null);

  const [showPrompt, setShowPrompt] = useState(true);
  const [showSessions, setShowSessions] = useState(false);

  // Track the fixed bottom bar's height so the cards area can pad itself
  // exactly right — height changes when the sessions drawer toggles or
  // the prompt section expands/collapses.
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);

  useEffect(() => {
    const el = bottomBarRef.current;
    if (!el) return;
    const update = () => setBottomBarHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("outfit_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setSessions(data ?? []);
    setSessionsLoading(false);
  }, [supabase]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Pre-fill filters from user profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await callEdgeFunction("profile", { method: "GET" });
        if (!res.ok) return;
        const p = await res.json();
        setFilters((prev) => ({
          ...prev,
          gender:
            p.gender_presentation === "male"
              ? "mens"
              : p.gender_presentation === "female"
                ? "womens"
                : prev.gender,
          body_type: p.body_type ?? prev.body_type,
          age_range: p.age_range ?? prev.age_range,
          preferred_currency: p.preferred_currency ?? prev.preferred_currency,
        }));
      } catch {
        // Profile is optional
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      setPrompt((e as CustomEvent).detail as string);
    }
    window.addEventListener("fill-prompt", handler);
    return () => window.removeEventListener("fill-prompt", handler);
  }, []);

  async function generate(promptText: string, sid?: string | null) {
    if (!promptText.trim()) return;
    setLoading(true);
    setError(null);
    setLimitError(null);
    setShowPrompt(false);

    try {
      const res = await callEdgeFunction("generate", {
        body: { prompt: promptText, filters, session_id: sid },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const limit = parseLimitError(res.status, data);
        if (limit) {
          setLimitError(limit);
          setShowPrompt(true);
          return;
        }
        throw new Error(data?.error || "Failed to generate outfits");
      }

      const data = await res.json();
      setSessionId(data.session_id);
      setOutfits(data.outfits);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setShowPrompt(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!refinePrompt.trim() || !sessionId) return;
    setRefineLoading(true);
    await generate(refinePrompt, sessionId);
    setRefinePrompt("");
    setRefineLoading(false);
  }

  async function loadSession(session: OutfitSession) {
    setLoading(true);
    setError(null);
    setSessionId(session.id);
    setPrompt(session.initial_prompt);
    setShowPrompt(false);
    setShowSessions(false);

    try {
      const { data: outfitRows } = await supabase
        .from("outfits")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (!outfitRows?.length) { setOutfits([]); return; }

      const { data: itemRows } = await supabase
        .from("outfit_items")
        .select(`*, products (id, name, price, currency, images, colours, style_tags, occasion_tags, aesthetic_tags, fit, product_url, description, subcategory, brands ( name ), categories ( name ))`)
        .in("outfit_id", outfitRows.map((o) => o.id));

      const loadedOutfits = outfitRows.map((o) => ({
        ...o,
        items: ((itemRows ?? []) as unknown as RawItem[])
          .filter((item) => item.outfit_id === o.id && item.products)
          .map((item) => ({
            product: {
              id: item.products.id, name: item.products.name,
              brand_name: item.products.brands?.name ?? "Unknown",
              category_name: item.products.categories?.name ?? "",
              subcategory: item.products.subcategory,
              description: item.products.description,
              price: item.products.price,
              currency: item.products.currency ?? "USD",
              original_price: item.products.price,
              original_currency: item.products.currency ?? "USD",
              colours: item.products.colours ?? [],
              images: item.products.images ?? [],
              style_tags: item.products.style_tags ?? [],
              occasion_tags: item.products.occasion_tags ?? [],
              aesthetic_tags: item.products.aesthetic_tags ?? [],
              fit: item.products.fit,
              product_url: item.products.product_url,
              similarity: 0,
            },
            role: item.role,
          })),
      }));

      setOutfits(loadedOutfits);
    } catch {
      setError("Failed to load session");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load session from ?session= query param (e.g. from Try-Ons → View Outfit)
  useEffect(() => {
    const sid = searchParams.get("session");
    if (sid && !deepLinked.current) {
      deepLinked.current = true;
      // Find or fabricate a minimal session object to trigger loadSession
      (async () => {
        const { data } = await supabase
          .from("outfit_sessions")
          .select("*")
          .eq("id", sid)
          .single();
        if (data) loadSession(data as OutfitSession);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleSave(outfitId: string) {
    const res = await callEdgeFunction("save-outfit", {
      body: { outfit_id: outfitId },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const limit = parseLimitError(res.status, data);
      if (limit) {
        setLimitError(limit);
        return;
      }
    }

    setSavedIds((prev) => new Set(Array.from(prev).concat(outfitId)));
  }

  const hasResults = outfits.length > 0 || loading;

  return (
    <div
      className="min-h-full bg-canvas flex flex-col"
      style={{ paddingBottom: bottomBarHeight }}
    >
      {/* ── Limit error ── */}
      {limitError && (
        <div className="mx-6 mt-4">
          <UpgradeBanner
            error={limitError}
            onDismiss={() => setLimitError(null)}
          />
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Cards (center stage) ── */}
      <div className="flex-1 min-w-0 px-6 py-8">
        <OutfitCarousel
          outfits={outfits}
          loading={loading}
          savedOutfitIds={savedIds}
          onSave={handleSave}
        />
      </div>

      {/* ── Bottom controls (fixed to viewport) ── */}
      <div
        ref={bottomBarRef}
        className="fixed bottom-0 left-0 right-0 z-20 bg-canvas border-t border-hairline"
      >
        {/* Refine bar */}
        {hasResults && !loading && outfits.length > 0 && (
          <div className="border-b border-hairline px-6 py-3">
            <div className="max-w-2xl mx-auto flex gap-3">
              <input
                value={refinePrompt}
                onChange={(e) => setRefinePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleRefine();
                  }
                }}
                placeholder="Refine: swap the jacket for something leather…"
                className="flex-1 bg-canvas border border-hairline px-4 py-2.5 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black"
              />
              <button
                onClick={handleRefine}
                disabled={refineLoading || !refinePrompt.trim()}
                className="px-5 py-2.5 bg-near-black text-white text-sm font-medium hover:bg-ink disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {refineLoading ? "Refining…" : "Refine"}
              </button>
            </div>
          </div>
        )}

        {/* Prompt + filters */}
        {showPrompt ? (
          <div className="border-b border-hairline">
            <div className="max-w-2xl mx-auto px-6 py-5">
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onSubmit={() => generate(prompt, null)}
                loading={loading}
              />
              <div className="mt-4">
                <FilterBar filters={filters} onChange={setFilters} />
              </div>
            </div>
          </div>
        ) : (
          <div className="border-b border-hairline px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-mono-label font-mono text-muted-slate uppercase tracking-wide text-xs">Prompt</span>
              <p className="text-sm text-ink truncate">{prompt}</p>
            </div>
            <button
              onClick={() => setShowPrompt(true)}
              className="text-xs text-muted-slate hover:text-ink flex-shrink-0 px-3 py-1 border border-hairline hover:border-ink transition-colors"
            >
              Edit
            </button>
          </div>
        )}

        {/* Sessions drawer */}
        <div>
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="w-full px-6 py-2 flex items-center justify-between text-xs text-muted-slate hover:text-ink"
          >
            <span className="font-mono uppercase tracking-wide">
              Recent sessions ({sessions.length})
            </span>
            <span className="text-base leading-none">{showSessions ? "−" : "+"}</span>
          </button>

          {showSessions && (
            <div className="px-6 pb-4 max-h-48 overflow-y-auto border-t border-hairline">
              {sessionsLoading ? (
                <p className="text-muted-slate text-xs py-3">Loading…</p>
              ) : sessions.length === 0 ? (
                <p className="text-muted-slate text-xs py-3">No sessions yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 py-3">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadSession(s)}
                      className={`text-left px-3 py-2 border text-xs hover:border-ink group transition-colors ${
                        sessionId === s.id
                          ? "border-near-black bg-stone"
                          : "border-hairline"
                      }`}
                    >
                      <p className="text-ink font-medium truncate group-hover:text-near-black">
                        {truncate(s.initial_prompt, 50)}
                      </p>
                      <p className="text-muted-slate mt-0.5">{formatDate(s.created_at)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
