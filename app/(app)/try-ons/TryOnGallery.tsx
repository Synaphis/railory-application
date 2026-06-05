"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, MARKETING_URL } from "@/lib/utils";

export interface GalleryItem {
  outfitId: string;
  sessionId: string;
  previewImage: string;
  allImages: string[];
  prompt: string;
  reasoning: string | null;
  createdAt: string;
}

function ShareIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

/* ── Lightbox viewer ── */
function Lightbox({
  images,
  startIndex,
  prompt,
  sessionId,
  outfitId,
  onClose,
}: {
  images: string[];
  startIndex: number;
  prompt: string;
  sessionId: string;
  outfitId: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [copied, setCopied] = useState(false);
  const current = images[idx];

  async function handleShare() {
    // Share a marketing-page URL (railory.io/o/{outfit_id}) instead of the
    // raw image URL. Recipients land on a branded page with a CTA back
    // to Railory, not a dead-end image file.
    const shareUrl = `${MARKETING_URL}/o/${outfitId}`;
    const shareData = {
      title: "My Railory Try-On",
      text: prompt
        ? `Styled with Railory — "${prompt}"`
        : "Check out my virtual try-on from Railory",
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      style={{ width: "100vw", height: "100vh" }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          {images.length > 1 && (
            <span className="text-white/50 text-xs font-mono">
              {idx + 1} / {images.length}
            </span>
          )}
          {prompt && (
            <p className="text-white/30 text-xs truncate max-w-[200px] sm:max-w-md">
              {prompt}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View Outfit */}
          <Link
            href={`/history?session=${sessionId}&outfit=${outfitId}`}
            onClick={onClose}
            className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M10 14L21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
            View Outfit
          </Link>

          {/* Share */}
          <button
            onClick={handleShare}
            className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <ShareIcon className="w-3.5 h-3.5" />
            {copied ? "Copied" : "Share"}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white hover:text-white/60 text-xl"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Image — fills remaining space */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center px-12 pb-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrows */}
        {images.length > 1 && idx > 0 && (
          <button
            onClick={() => setIdx(idx - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl"
          >
            &#8249;
          </button>
        )}
        {images.length > 1 && idx < images.length - 1 && (
          <button
            onClick={() => setIdx(idx + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl"
          >
            &#8250;
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt="Try-on result"
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  );
}

/* ── Main gallery ── */
export default function TryOnGallery({
  items,
}: {
  items: GalleryItem[];
}) {
  const [lightbox, setLightbox] = useState<{
    images: string[];
    startIndex: number;
    prompt: string;
    sessionId: string;
    outfitId: string;
  } | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24">
        <div className="w-16 h-16 bg-stone flex items-center justify-center mb-5">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-near-black/20"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <p className="font-display text-feature-heading font-medium text-ink mb-1">
          No try-ons yet
        </p>
        <p className="text-muted-slate text-sm">
          Generate outfits and use virtual try-on to see them here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 sm:px-6 md:px-8 pt-6 pb-16">
        <h1 className="font-display text-card-heading font-medium text-near-black mb-1">
          Try-Ons
        </h1>
        <p className="text-sm text-muted-slate mb-8">
          Your virtual try-on gallery. Share your favourites.
        </p>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map((item) =>
            item.allImages.map((imgUrl, imgIdx) => (
              <button
                key={`${item.outfitId}-${imgIdx}`}
                onClick={() =>
                  setLightbox({
                    images: item.allImages,
                    startIndex: imgIdx,
                    prompt: item.prompt,
                    sessionId: item.sessionId,
                    outfitId: item.outfitId,
                  })
                }
                className="group relative aspect-[9/16] bg-stone overflow-hidden border border-hairline hover:border-ink transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt="Try-on result"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                  <div className="w-full px-3 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-[10px] font-mono uppercase tracking-wider">
                      {formatDate(item.createdAt)}
                    </p>
                    {item.allImages.length > 1 && (
                      <p className="text-white/60 text-[9px] font-mono mt-0.5">
                        {item.allImages.length} angles
                      </p>
                    )}
                  </div>
                </div>

                {/* Multi-image badge */}
                {item.allImages.length > 1 && imgIdx === 0 && (
                  <span className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-mono px-1.5 py-0.5">
                    {item.allImages.length}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.startIndex}
          prompt={lightbox.prompt}
          sessionId={lightbox.sessionId}
          outfitId={lightbox.outfitId}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
