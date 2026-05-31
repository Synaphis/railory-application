import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

/**
 * Public share page for a single outfit.
 *
 *   URL pattern: https://railory.io/o/{outfit_uuid}
 *
 * Server-rendered with OG / Twitter card meta so links unfurl as rich
 * previews on socials. Data is fetched from the public
 * get-outfit-preview edge function (no auth required, UUIDs are
 * unguessable so security relies on link secrecy — same model as
 * Google Docs link sharing).
 */

const SUPABASE_FUNCTIONS_URL =
  "https://rkbljmsalughhsuspwoi.supabase.co/functions/v1";
const APP_URL = "https://app.railory.io";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", GBP: "£", EUR: "€", AED: "AED ", PKR: "Rs ",
  SAR: "SAR ", INR: "₹", CAD: "CA$", AUD: "A$", JPY: "¥", TRY: "₺",
};

function formatPrice(value: number, currency = "USD"): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const decimals = ["PKR", "JPY", "IDR"].includes(currency) ? 0 : 2;
  return `${sym}${value.toFixed(decimals)}`;
}

interface OutfitPreview {
  id: string;
  preview_image: string;
  ai_reasoning: string | null;
  total_price: number | null;
  currency: string;
  prompt: string | null;
  created_at: string;
  items: Array<{
    role: string;
    product: {
      id: string;
      name: string;
      brand_name: string;
      category_name: string;
      price: number;
      currency: string;
      images: string[];
      colours: string[];
      product_url: string | null;
    };
  }>;
}

async function fetchOutfit(id: string): Promise<OutfitPreview | null> {
  try {
    const res = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/get-outfit-preview?id=${encodeURIComponent(id)}`,
      { next: { revalidate: 3600 } } // cache for 1 hour
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Meta tags for social previews ─────────────────────────────

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const outfit = await fetchOutfit(params.id);

  if (!outfit) {
    return {
      title: "Outfit not found — Railory",
      description: "This outfit isn't available.",
    };
  }

  const title = outfit.prompt
    ? `"${outfit.prompt}" — styled by Railory`
    : "An outfit styled by Railory";
  const description =
    outfit.ai_reasoning ??
    "AI-generated outfit with virtual try-on by Railory. Describe a vibe, get the outfit.";
  const url = `https://railory.io/o/${outfit.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Railory",
      type: "article",
      images: [
        {
          url: outfit.preview_image,
          width: 1024,
          height: 1024,
          alt: outfit.prompt ?? "Railory outfit",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [outfit.preview_image],
    },
  };
}

// ── Page ──────────────────────────────────────────────────────

export default async function OutfitPage(
  { params }: { params: { id: string } }
) {
  const outfit = await fetchOutfit(params.id);
  if (!outfit) notFound();

  return (
    <main className="min-h-screen bg-canvas">
      {/* Brand bar */}
      <header className="border-b border-hairline px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/railory_logo_black.png"
            alt=""
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="font-display text-lg font-medium text-near-black">
            Railory
          </span>
        </Link>
        <Link
          href={`${APP_URL}/signup`}
          className="text-sm text-action-blue hover:underline"
        >
          Sign up
        </Link>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-10">
        {/* Hero image */}
        <div className="aspect-[9/16] max-h-[80vh] mx-auto bg-stone overflow-hidden mb-8 border border-hairline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={outfit.preview_image}
            alt={outfit.prompt ?? "Outfit try-on by Railory"}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Prompt / brief */}
        {outfit.prompt && (
          <div className="mb-6">
            <p className="text-xs font-mono text-muted-slate uppercase tracking-wider mb-2">
              The brief
            </p>
            <p className="font-display text-2xl text-near-black leading-tight italic">
              &ldquo;{outfit.prompt}&rdquo;
            </p>
          </div>
        )}

        {/* AI reasoning */}
        {outfit.ai_reasoning && (
          <p className="text-base text-ink leading-relaxed mb-10">
            {outfit.ai_reasoning}
          </p>
        )}

        {/* Items */}
        <section className="border-t border-hairline pt-8 mb-12">
          <p className="text-xs font-mono text-muted-slate uppercase tracking-wider mb-5">
            The outfit &middot; {outfit.items.length} {outfit.items.length === 1 ? "item" : "items"}
          </p>
          <div className="space-y-3">
            {outfit.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-4 py-3 border-b border-hairline last:border-b-0"
              >
                {item.product.images[0] && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-16 h-20 object-cover bg-stone border border-hairline flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-coral uppercase tracking-wider mb-0.5">
                    {item.role}
                  </p>
                  <p className="text-sm font-medium text-ink leading-snug">
                    {item.product.name}
                  </p>
                  <p className="text-xs text-muted-slate">
                    {item.product.brand_name}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-ink whitespace-nowrap">
                    {formatPrice(item.product.price, item.product.currency)}
                  </p>
                  {item.product.product_url && (
                    <a
                      href={item.product.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-action-blue hover:underline"
                    >
                      Shop &rarr;
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {outfit.total_price !== null && (
            <div className="flex items-center justify-between border-t border-near-black pt-5 mt-6">
              <p className="text-xs font-mono text-muted-slate uppercase tracking-wider">
                Total
              </p>
              <p className="font-display text-2xl font-medium text-near-black tracking-tight">
                {formatPrice(outfit.total_price, outfit.currency)}
              </p>
            </div>
          )}
        </section>

        {/* CTA */}
        <div className="border border-near-black p-10 text-center">
          <p className="font-display text-3xl font-medium text-near-black mb-3 tracking-tight">
            Want your own AI stylist?
          </p>
          <p className="text-sm text-muted-slate mb-6 max-w-md mx-auto">
            Describe any vibe. Get the outfit. Try it on yourself with our virtual try-on.
          </p>
          <Link
            href={`${APP_URL}/signup`}
            className="inline-block px-8 py-3 bg-near-black text-white text-sm font-medium hover:bg-ink transition-colors"
          >
            Try Railory free
          </Link>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-hairline px-6 py-8 mt-12 text-center">
        <p className="text-xs text-muted-slate">
          &copy; {new Date().getFullYear()} Railory &middot;{" "}
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>{" "}
          &middot;{" "}
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </p>
      </footer>
    </main>
  );
}
