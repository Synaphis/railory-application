"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { OutfitWithItems } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

const TryOnModal = lazy(() => import("@/components/TryOnModal"));

/* ── Helpers ───────────────────────────────────────── */
const ROLE_ORDER = ["top", "bottom", "trousers", "shoe", "boots", "jacket"];

function sortByRole(items: OutfitWithItems["items"]) {
  return [...items].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.role.toLowerCase());
    const bi = ROLE_ORDER.indexOf(b.role.toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/* ── Interleaved image sequence ── */
interface SequenceImage {
  url: string;
  itemIndex: number;
  productName: string;
  brandName: string;
  role: string;
}

function buildInterleavedSequence(
  items: OutfitWithItems["items"]
): SequenceImage[] {
  const maxImages = Math.max(
    ...items.map((i) => i.product.images?.length ?? 0),
    0
  );
  const seq: SequenceImage[] = [];
  for (let imgIdx = 0; imgIdx < maxImages; imgIdx++) {
    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      const item = items[itemIdx];
      const images = item.product.images ?? [];
      if (imgIdx < images.length) {
        seq.push({
          url: images[imgIdx],
          itemIndex: itemIdx,
          productName: item.product.name,
          brandName: item.product.brand_name ?? "Unknown",
          role: item.role,
        });
      }
    }
  }
  return seq;
}

/* ── Progressive portrait filter ── */
function checkDims(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject();
    img.src = url;
  });
}

function usePortraitImages(raw: SequenceImage[]): SequenceImage[] {
  const [portraits, setPortraits] = useState<SequenceImage[]>([]);
  const key = useMemo(() => raw.map((s) => s.url).join("|"), [raw]);

  useEffect(() => {
    let cancelled = false;
    setPortraits([]);

    (async () => {
      for (const img of raw) {
        if (cancelled) return;
        try {
          const d = await checkDims(img.url);
          if (!cancelled && d.h >= d.w) {
            setPortraits((prev) => [...prev, img]);
          }
        } catch {
          /* skip */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return portraits;
}

/* ── Card props ── */
interface OutfitCardProps {
  outfit: OutfitWithItems;
  onSave?: (outfitId: string) => Promise<void>;
  isSaved?: boolean;
  /**
   * When true, vertical wheel is fully captured for image cycling.
   * Use on layouts where vertical page scroll has no meaningful target
   * (e.g. the carousel on /generate). When false (default), wheel at
   * the first/last image passes through so the page can scroll —
   * appropriate for grid layouts (/history, /saved).
   */
  lockScroll?: boolean;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Main component
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function OutfitCard({
  outfit,
  onSave,
  isSaved: initialSaved = false,
  lockScroll = false,
}: OutfitCardProps) {
  const sorted = useMemo(() => sortByRole(outfit.items), [outfit.items]);
  const rawSeq = useMemo(() => buildInterleavedSequence(sorted), [sorted]);
  const portraits = usePortraitImages(rawSeq);

  const [idx, setIdx] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showTryOn, setShowTryOn] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);

  const wheelLock = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(idx);

  // Clamp
  useEffect(() => {
    if (portraits.length > 0 && idx >= portraits.length)
      setIdx(portraits.length - 1);
  }, [portraits.length, idx]);

  // Keep idx readable inside the wheel handler without re-attaching.
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  // Native wheel listener so preventDefault actually works (React's
  // synthetic onWheel is passive by default in React 17+).
  //
  // Boundary passthrough: when the carousel is at its first image and
  // the user wheels up, or at its last image and wheels down, we let
  // the event continue so the page can scroll. Otherwise the card
  // would trap all scroll while many cards fill the viewport.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      if (sheetOpen) return;
      const i = idxRef.current;
      const last = portraits.length - 1;
      const goingDown = e.deltaY > 0;
      const goingUp = e.deltaY < 0;
      // Pass through to page scroll at the boundaries — unless the
      // host opts into locked scroll (carousel layouts).
      if (!lockScroll && ((goingDown && i >= last) || (goingUp && i <= 0))) return;

      e.preventDefault();
      if (wheelLock.current) return;
      if (Math.abs(e.deltaY) < 5) return;
      wheelLock.current = true;
      if (goingDown) {
        setIdx((j) => (j < last ? j + 1 : j));
      } else {
        setIdx((j) => (j > 0 ? j - 1 : j));
      }
      setTimeout(() => {
        wheelLock.current = false;
      }, 250);
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [sheetOpen, portraits.length, lockScroll]);

  const cur = portraits[idx] ?? null;
  const hasPreview = !!outfit.preview_image && outfit.preview_image !== "";
  const total = sorted.length;

  /* ── Nav ── */
  function goNext() {
    if (idx < portraits.length - 1) setIdx((i) => i + 1);
  }
  function goPrev() {
    if (idx > 0) setIdx((i) => i - 1);
  }

  /* Click zones — left third = prev, right two‑thirds = next */
  function onImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (sheetOpen) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) goPrev();
    else goNext();
  }

  // Touch
  const touchY = useRef(0);
  const touchX = useRef(0);
  function onTouchStart(e: React.TouchEvent) {
    touchY.current = e.touches[0].clientY;
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dy = touchY.current - e.changedTouches[0].clientY;
    const dx = Math.abs(touchX.current - e.changedTouches[0].clientX);
    if (Math.abs(dy) > 40 && Math.abs(dy) > dx) {
      dy > 0 ? goNext() : goPrev();
    }
  }

  async function handleSave() {
    if (!onSave || saved) return;
    setSaving(true);
    await onSave(outfit.id);
    setSaved(true);
    setSaving(false);
  }

  // Always compute total from items — DB value can be stale or in wrong currency
  const totalPrice = sorted.reduce((s, i) => s + (i.product.price ?? 0), 0);
  const currency = sorted[0]?.product?.currency ?? "USD";

  /* ━━ Render ━━ */
  return (
    <>
      <div
        ref={containerRef}
        className="relative w-full h-full bg-near-black overflow-hidden select-none cursor-pointer"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onImageClick}
      >
        {/* ── Full-bleed image ── */}
        {portraits.length > 0 && cur ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={cur.url}
            src={cur.url}
            alt={`${cur.productName} — ${cur.role}`}
            className="absolute inset-0 w-full h-full object-cover animate-image-in"
          />
        ) : rawSeq.length > 0 ? (
          <div className="absolute inset-0 bg-stone flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-muted-slate/30 border-t-muted-slate animate-spin" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-stone flex items-center justify-center">
            <span className="text-muted-slate text-xs font-mono">
              No images
            </span>
          </div>
        )}

        {/* ── Gradients ── */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

        {/* ── Vertical progress dots (right edge) ── */}
        {portraits.length > 1 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1 pointer-events-none">
            {portraits.map((_, i) => (
              <div
                key={i}
                className={`w-[3px] transition-all duration-300 ${
                  i === idx
                    ? "h-4 bg-white"
                    : "h-[3px] bg-white/30"
                }`}
              />
            ))}
          </div>
        )}

        {/* ── Counter (top left) ── */}
        {portraits.length > 1 && (
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <span className="text-white/60 text-[11px] font-mono tracking-wider">
              {idx + 1} / {portraits.length}
            </span>
          </div>
        )}

        {/* ── Action buttons (top right) ── */}
        <div
          className="absolute top-4 right-12 z-10 flex gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Save */}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="w-9 h-9 flex items-center justify-center bg-black/30 backdrop-blur-sm border border-white/15 text-white hover:bg-black/50 transition-colors disabled:opacity-60"
              title={saved ? "Saved" : "Save outfit"}
            >
              {saved ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              )}
            </button>
          )}

          {/* Try-on */}
          <button
            onClick={() => setShowTryOn(true)}
            className={`w-9 h-9 flex items-center justify-center bg-black/30 backdrop-blur-sm border border-white/15 hover:bg-black/50 transition-colors ${
              hasPreview ? "text-white" : "text-coral"
            }`}
            title="Virtual try-on"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          {/* Info */}
          <button
            onClick={() => setSheetOpen(true)}
            className="w-9 h-9 flex items-center justify-center bg-black/30 backdrop-blur-sm border border-white/15 text-white hover:bg-black/50 transition-colors"
            title="Outfit details"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </button>
        </div>

        {/* ── Bottom content ── */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 z-10 pointer-events-none">
          {/* Price */}
          <p className="font-display text-2xl font-medium text-white tracking-tight mb-1">
            {formatPrice(totalPrice, currency)}
          </p>

          {/* Current product context */}
          {cur && (
            <p className="text-white/50 text-[11px] font-mono uppercase tracking-wider">
              {cur.brandName} &middot; {cur.role}
            </p>
          )}
        </div>

        {/* ── Details sheet (full cover) ── */}
        {sheetOpen && (
          <DetailsSheet
            items={sorted}
            outfit={outfit}
            currency={currency}
            onClose={() => setSheetOpen(false)}
          />
        )}
      </div>

      {/* ── Try-on modal ── */}
      {showTryOn && (
        <Suspense fallback={null}>
          <TryOnModal
            items={sorted}
            outfitId={outfit.id}
            onClose={() => setShowTryOn(false)}
          />
        </Suspense>
      )}
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Details Sheet — covers the entire card
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function DetailsSheet({
  items,
  outfit,
  currency,
  onClose,
}: {
  items: OutfitWithItems["items"];
  outfit: OutfitWithItems;
  currency: string;
  onClose: () => void;
}) {
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxImg) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxImg(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxImg]);

  return (
    <div
      className="absolute inset-0 z-20 bg-canvas animate-slide-up overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-canvas border-b border-hairline">
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-[10px] font-mono text-muted-slate uppercase tracking-wider">
            Outfit details
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-muted-slate hover:text-ink text-lg"
          >
            &times;
          </button>
        </div>
      </div>

      {/* AI reasoning */}
      {outfit.ai_reasoning && (
        <div className="px-5 py-3 border-b border-hairline">
          <p className="text-xs text-muted-slate italic leading-relaxed">
            &ldquo;{outfit.ai_reasoning}&rdquo;
          </p>
        </div>
      )}

      {/* Total */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-hairline">
        <span className="text-[10px] font-mono text-muted-slate uppercase tracking-wider">
          Total
        </span>
        <span className="font-display text-lg font-medium text-near-black tracking-tight">
          {formatPrice(
            items.reduce((s, i) => s + (i.product.price ?? 0), 0),
            currency
          )}
        </span>
      </div>

      {/* Products */}
      <div className="px-5 py-4 space-y-5">
        {items.map((item) => (
          <div key={item.product.id}>
            {/* Role + brand */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono text-coral uppercase tracking-wider">
                {item.role}
              </span>
              <span className="text-hairline">&middot;</span>
              <span className="text-[11px] text-muted-slate">
                {item.product.brand_name}
              </span>
            </div>

            {/* Name + price + shop */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm font-medium text-ink leading-snug flex-1 min-w-0">
                {item.product.name}
              </p>
              <span className="text-sm text-near-black font-medium whitespace-nowrap">
                {formatPrice(item.product.price, item.product.currency)}
              </span>
            </div>

            {/* Shop link */}
            {item.product.product_url && (
              <a
                href={item.product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[11px] font-medium text-action-blue hover:underline mb-2.5"
              >
                View on store &rarr;
              </a>
            )}

            {/* Thumbnail strip — ALL images, click to view full */}
            {item.product.images && item.product.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {item.product.images.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxImg(src)}
                    className="relative w-16 h-20 flex-shrink-0 bg-stone overflow-hidden border border-hairline hover:border-ink transition-colors"
                    title="View full image"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`${item.product.name} ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Lightbox ── */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 animate-fade-in"
          onClick={() => setLightboxImg(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImg}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImg(null);
            }}
            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-sm border border-white/15 text-white hover:bg-black/60 transition-colors text-xl"
            title="Close"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
