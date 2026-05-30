/**
 * Currency utilities for multi-currency product catalogue.
 * Exchange rates are approximate and updated manually.
 * For production, swap EXCHANGE_RATES_TO_USD with a live rates API.
 */

// 1 unit of this currency = X USD
export const EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  GBP: 1.27,
  EUR: 1.09,
  AED: 0.272,
  PKR: 0.0036,
  SAR: 0.267,
  INR: 0.012,
  CAD: 0.74,
  AUD: 0.65,
  JPY: 0.0067,
  CNY: 0.138,
  TRY: 0.031,
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  AED: "AED ",
  PKR: "Rs ",
  SAR: "SAR ",
  INR: "₹",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
  CNY: "¥",
  TRY: "₺",
};

/** Convert a price from one currency to another via USD as pivot. */
export function convertCurrency(
  price: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) return price;
  const fromRate = EXCHANGE_RATES_TO_USD[fromCurrency.toUpperCase()] ?? 1;
  const toRate = EXCHANGE_RATES_TO_USD[toCurrency.toUpperCase()] ?? 1;
  return (price * fromRate) / toRate;
}

/** Format a price with its currency symbol. */
export function formatCurrency(price: number, currency: string): string {
  const code = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? (currency + " ");
  const decimals = ["JPY", "PKR"].includes(code) ? 0 : 2;
  return `${symbol}${price.toFixed(decimals)}`;
}

/**
 * Infer the likely currency from a brand's base_url.
 * Returns null if unknown (fall back to product.currency column).
 */
export function inferCurrencyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("pk.") || u.includes(".pk/") || u.includes(".pk")) return "PKR";
  if (u.includes("ae.") || u.includes(".ae") || u.includes("thegivingmovement")) return "AED";
  if (
    u.includes("/en_gbp") ||
    u.includes("/en_gb") ||
    u.includes(".com/uk") ||
    u.includes(".com/gb") ||
    u.includes("shop.mango.com/gb") ||
    u.includes("hm.com/en")
  ) return "GBP";
  if (u.includes("/en_eur") || u.includes("/eu/")) return "EUR";
  return null;
}

/**
 * Map country ISO codes to their most common local currency.
 * Used to default preferred_currency when user sets country.
 */
export const COUNTRY_CURRENCY: Record<string, string> = {
  PK: "PKR",
  GB: "GBP",
  US: "USD",
  AE: "AED",
  SA: "SAR",
  IN: "INR",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  CA: "CAD",
  AU: "AUD",
  JP: "JPY",
  CN: "CNY",
  TR: "TRY",
};

/**
 * Determine if a brand likely ships to the given ISO country code,
 * based purely on base_url heuristics (shipping_info is usually null).
 *
 * Returns a confidence score 0–2:
 *   2 = confirmed match (brand's primary market)
 *   1 = likely (global brand or ambiguous)
 *   0 = unlikely (brand primarily serves a different country)
 */
export function brandShippingScore(baseUrl: string | null, userCountry: string): number {
  if (!baseUrl) return 1; // unknown → treat as global
  const u = baseUrl.toLowerCase();
  const country = userCountry.toUpperCase();

  // Pakistani brands
  if (u.includes("pk.") || u.includes(".pk")) {
    return country === "PK" ? 2 : 0;
  }

  // UAE/Gulf brands
  if (u.includes("thegivingmovement.com")) {
    return ["AE", "SA", "QA", "KW", "BH", "OM"].includes(country) ? 2
      : country === "PK" ? 1 // TGM does ship to Pakistan
      : 0;
  }

  // UK-focused brands — most ship internationally via their main site
  // Zara, H&M, ASOS, COS etc. have dedicated country sites/ship globally
  if (
    u.includes(".com/uk") || u.includes("/en_gb") || u.includes("/en_gbp") ||
    u.includes(".com/gb") || u.includes("hm.com/en")
  ) {
    if (country === "GB") return 2;
    // These brands typically ship to most of the world
    // but NOT to every country — be conservative for PK
    return ["PK", "IN", "BD"].includes(country) ? 0 : 1;
  }

  // Domain-only global brands (asos.com, allsaints.com, reiss.com, etc.)
  return 1;
}
