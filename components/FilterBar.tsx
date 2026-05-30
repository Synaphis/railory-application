"use client";

import { useState } from "react";
import { GenerateFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  filters: GenerateFilters;
  onChange: (filters: GenerateFilters) => void;
}

const GENDERS = [
  { value: "womens", label: "Women" },
  { value: "mens", label: "Men" },
  { value: "unisex", label: "Both" },
] as const;

const BODY_TYPES = ["Slim", "Athletic", "Medium", "Curvy", "Plus"];
const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];
const OCCASIONS = ["Casual", "Smart Casual", "Formal", "Date Night", "Party", "Office", "Weekend"];
const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", GBP: "£", EUR: "€", AED: "AED ", PKR: "Rs ",
  SAR: "SAR ", INR: "₹", CAD: "CA$", AUD: "A$", TRY: "₺",
};

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const sym = CURRENCY_SYMBOLS[filters.preferred_currency ?? "USD"] ?? "$";

  const activeCount = [
    filters.budget_max !== 500 || filters.budget_min !== 0 ? "budget" : null,
    filters.gender !== "unisex" ? "gender" : null,
    filters.body_type,
    filters.age_range,
    filters.occasion,
    filters.season,
  ].filter(Boolean).length;

  return (
    <div>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-xs font-medium border transition-colors",
          open || activeCount > 0
            ? "border-near-black text-ink bg-stone"
            : "border-hairline text-muted-slate hover:border-ink hover:text-ink bg-canvas"
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M1 3.5h12M3.5 7h7M5.5 10.5h3" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="w-4 h-4 bg-near-black text-white text-[9px] flex items-center justify-center font-medium">
            {activeCount}
          </span>
        )}
      </button>

      {/* Collapsible filter panel */}
      {open && (
        <div className="mt-3 pt-4 pb-2 border-t border-hairline space-y-4 animate-fade-in">
          {/* Row 1: Budget + Gender */}
          <div className="flex items-end gap-6 flex-wrap">
            {/* Budget */}
            <div>
              <label className="text-[10px] font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Budget
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-slate text-xs">{sym}</span>
                <input
                  type="number"
                  value={filters.budget_min}
                  onChange={(e) =>
                    onChange({ ...filters, budget_min: Number(e.target.value) })
                  }
                  min={0}
                  max={filters.budget_max}
                  className="w-16 bg-canvas border border-hairline px-2 py-1.5 text-xs text-ink text-center focus:outline-none focus:border-near-black"
                />
                <span className="text-muted-slate text-xs">&ndash;</span>
                <span className="text-muted-slate text-xs">{sym}</span>
                <input
                  type="number"
                  value={filters.budget_max}
                  onChange={(e) =>
                    onChange({ ...filters, budget_max: Number(e.target.value) })
                  }
                  min={filters.budget_min}
                  className="w-16 bg-canvas border border-hairline px-2 py-1.5 text-xs text-ink text-center focus:outline-none focus:border-near-black"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="text-[10px] font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Gender
              </label>
              <div className="flex gap-1">
                {GENDERS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => onChange({ ...filters, gender: value })}
                    className={cn(
                      "px-3 py-1.5 text-xs border transition-colors",
                      filters.gender === value
                        ? "border-near-black bg-near-black text-white"
                        : "border-hairline text-muted-slate hover:border-ink hover:text-ink bg-canvas"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Body Type, Age, Occasion, Season */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Body Type */}
            <div>
              <label className="text-[10px] font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Body type
              </label>
              <select
                value={filters.body_type ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, body_type: e.target.value || null })
                }
                className="w-full bg-canvas border border-hairline px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-near-black appearance-none"
              >
                <option value="">Any</option>
                {BODY_TYPES.map((b) => (
                  <option key={b} value={b.toLowerCase()}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Age Range */}
            <div>
              <label className="text-[10px] font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Age range
              </label>
              <select
                value={filters.age_range ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, age_range: e.target.value || null })
                }
                className="w-full bg-canvas border border-hairline px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-near-black appearance-none"
              >
                <option value="">Any</option>
                {AGE_RANGES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Occasion */}
            <div>
              <label className="text-[10px] font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Occasion
              </label>
              <select
                value={filters.occasion ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, occasion: e.target.value || null })
                }
                className="w-full bg-canvas border border-hairline px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-near-black appearance-none"
              >
                <option value="">Any</option>
                {OCCASIONS.map((o) => (
                  <option key={o} value={o.toLowerCase()}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            {/* Season */}
            <div>
              <label className="text-[10px] font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Season
              </label>
              <select
                value={filters.season ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, season: e.target.value || null })
                }
                className="w-full bg-canvas border border-hairline px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-near-black appearance-none"
              >
                <option value="">Any</option>
                {SEASONS.map((s) => (
                  <option key={s} value={s.toLowerCase()}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
