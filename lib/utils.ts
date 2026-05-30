const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", GBP: "£", EUR: "€", AED: "AED ", PKR: "Rs ",
  SAR: "SAR ", INR: "₹", CAD: "CA$", AUD: "A$", JPY: "¥", TRY: "₺",
};

export function formatPrice(price: number, currency = "USD"): string {
  const code = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? (currency + " ");
  // No decimals for high-value currencies like PKR and JPY
  const decimals = ["PKR", "JPY", "IDR"].includes(code) ? 0 : 2;
  return `${symbol}${price.toFixed(decimals)}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length).trim() + "…";
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function groupByDate<T extends { created_at: string }>(
  items: T[]
): Record<string, T[]> {
  return items.reduce(
    (acc, item) => {
      const date = new Date(item.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Marketing site URL — used for "back to home" links from the app. */
export const MARKETING_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://railory.io";
