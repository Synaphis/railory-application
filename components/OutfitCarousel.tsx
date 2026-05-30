"use client";

import { useRef, useState, useEffect } from "react";
import OutfitCard from "@/components/OutfitCard";
import { OutfitWithItems } from "@/lib/types";

export function CubeTransparentIcon({
  className = "w-16 h-16 text-near-black/10 mb-6",
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <polygon points="12 2 20.5 7 20.5 17 12 22 3.5 17 3.5 7" />
      <path d="M12 22v-9" />
      <path d="M12 13L3.5 7" />
      <path d="M12 13l8.5-6" />
      <path d="M12 2v9" />
      <path d="M12 11l8.5 6" />
      <path d="M12 11L3.5 17" />
    </svg>
  );
}

interface OutfitCarouselProps {
  outfits: OutfitWithItems[];
  loading?: boolean;
  savedOutfitIds?: Set<string>;
  onSave?: (outfitId: string) => Promise<void>;
}

const EXAMPLE_PROMPTS = [
  "First date, East London vibes, under $150",
  "Smart casual office, minimal, navy tones",
  "Festival weekend, boho energy, colourful",
];

const STYLING_PHRASES = [
  "Curating your palette",
  "Pairing textures",
  "Balancing proportions",
  "Refining colour harmony",
  "Checking the mirror",
  "Final adjustments",
];

/* ── Loading stage ── */
function StylingStage() {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % STYLING_PHRASES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 gap-8">
      <div className="relative w-16 h-16">
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full text-near-black"
        >
          <path
            d="M32 8c-3 0-5 2-5 5s2 5 5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            fill="none"
            className="animate-pulse"
          />
          <path
            d="M32 18L8 40h48L32 18z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="miter"
            fill="none"
          />
          <line
            x1="8"
            y1="40"
            x2="56"
            y2="40"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        <div className="absolute inset-0 border border-near-black/10 animate-ping" />
      </div>

      <div className="h-6 overflow-hidden relative">
        <p
          key={phraseIdx}
          className="text-sm text-muted-slate font-mono uppercase tracking-widest animate-fade-in"
        >
          {STYLING_PHRASES[phraseIdx]}
        </p>
      </div>

      <div className="w-48 flex flex-col items-center gap-2">
        <div className="w-full h-px bg-hairline relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-near-black/20 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
        </div>
        <span className="text-[10px] font-mono text-muted-slate tracking-wider">
          Styling your looks
        </span>
      </div>
    </div>
  );
}

export default function OutfitCarousel({
  outfits,
  loading = false,
  savedOutfitIds = new Set(),
  onSave,
}: OutfitCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function scrollTo(index: number) {
    const container = scrollRef.current;
    if (!container) return;
    const card = container.children[index] as HTMLElement;
    if (card) {
      card.scrollIntoView({
        behavior: "smooth",
        inline: "start",
        block: "nearest",
      });
      setActiveIndex(index);
    }
  }

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const cardWidth =
      (container.children[0] as HTMLElement)?.offsetWidth ?? 420;
    const index = Math.round(container.scrollLeft / (cardWidth + 24));
    setActiveIndex(Math.min(index, outfits.length - 1));
  }

  /* ── Loading ── */
  if (loading && outfits.length === 0) {
    return <StylingStage />;
  }

  /* ── Empty state ── */
  if (outfits.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24">
        <CubeTransparentIcon />
        <p className="font-display text-feature-heading font-medium text-ink mb-1">
          Your outfit will appear here
        </p>
        <p className="text-muted-slate text-sm mb-10">
          Try one of these to get started
        </p>
        <div className="flex flex-col gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              className="px-5 py-2.5 border border-hairline text-sm text-muted-slate hover:border-near-black hover:text-ink text-left bg-canvas transition-colors"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("fill-prompt", { detail: p })
                );
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Cards ── */
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        {/* Horizontal nav arrows */}
        {activeIndex > 0 && (
          <button
            onClick={() => scrollTo(activeIndex - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-canvas border border-hairline text-ink hover:border-ink flex items-center justify-center shadow-sm"
          >
            &#8249;
          </button>
        )}
        {activeIndex < outfits.length - 1 && (
          <button
            onClick={() => scrollTo(activeIndex + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-canvas border border-hairline text-ink hover:border-ink flex items-center justify-center shadow-sm"
          >
            &#8250;
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-6 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth hide-scrollbar"
        >
          {outfits.map((outfit) => (
            <div
              key={outfit.id}
              className="snap-start shrink-0 w-[420px] aspect-[3/4]"
            >
              <OutfitCard
                outfit={outfit}
                onSave={onSave}
                isSaved={savedOutfitIds.has(outfit.id)}
                lockScroll
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {outfits.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {outfits.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`transition-all ${
                i === activeIndex
                  ? "w-5 h-1 bg-near-black"
                  : "w-1.5 h-1 bg-hairline hover:bg-muted-slate"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
