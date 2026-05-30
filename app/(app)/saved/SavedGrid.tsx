"use client";

import { useState } from "react";
import OutfitCard from "@/components/OutfitCard";
import { OutfitWithItems } from "@/lib/types";
import { callEdgeFunction } from "@/lib/api";
import { Bookmark} from 'lucide-react';
// Usage: <Box size={24} strokeWidth={1.5} />

type RawProduct = {
  id: string; name: string; price: number; currency: string | null;
  images: string[]; colours: string[];
  style_tags: string[]; occasion_tags: string[]; aesthetic_tags: string[];
  fit: string | null; product_url: string | null; description: string | null;
  subcategory: string | null; brands?: { name: string }; categories?: { name: string };
};
type RawItem = { id: string; role: string; products: RawProduct };
type RawOutfit = { id: string; session_id: string; prompt_used: string; ai_reasoning: string | null; total_price: number | null; preview_image: string | null; created_at: string; outfit_items: RawItem[] };
export type RawSavedRow = { id: string; saved_at: string; notes: string | null; outfit_id: string; outfits: RawOutfit };

function mapRow(row: RawSavedRow): OutfitWithItems {
  const outfit = row.outfits;
  return {
    ...outfit,
    items: (outfit.outfit_items ?? []).filter((item) => item.products).map((item) => ({
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
  };
}

export default function SavedGrid({ savedRows }: { savedRows: RawSavedRow[] }) {
  const [rows, setRows] = useState(savedRows);

  async function handleUnsave(savedId: string) {
    await callEdgeFunction("save-outfit", {
      method: "DELETE",
      searchParams: { saved_id: savedId },
    });
    setRows((prev) => prev.filter((r) => r.id !== savedId));
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24">
        <div className="w-16 h-16  bg-stone flex items-center justify-center mb-5">
          <Bookmark
  className="w-12 h-12 text-near-black/10 " 
  strokeWidth={1.5} 
/>
        </div>
        <p className="font-display text-feature-heading font-medium text-ink mb-1">No saved outfits yet</p>
        <p className="text-muted-slate text-sm">Start styling to save looks you love.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="px-8 pt-6 pb-16">
        <h1 className="font-display text-card-heading font-medium text-near-black mb-6">
          Saved Looks
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {rows.map((row) => (
            <div key={row.id} className="relative aspect-[3/5]">
              <button
                onClick={() => handleUnsave(row.id)}
                className="absolute top-3 left-3 z-30 w-7 h-7 bg-black/30 backdrop-blur-sm border border-white/15 text-white hover:text-red-400 hover:border-red-400 text-sm flex items-center justify-center"
                title="Remove"
              >
                &times;
              </button>
              <OutfitCard outfit={mapRow(row)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
