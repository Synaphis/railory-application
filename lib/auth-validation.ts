/**
 * Lightweight client-side auth validation helpers.
 *
 * These are first-line-of-defence checks for the signup form — they
 * catch obvious abuse patterns before we even hit Supabase. Server-side
 * validation in Supabase Auth is the authoritative gate (captcha,
 * email confirmation, password breach check via dashboard settings).
 */

/**
 * Disposable / throwaway email providers we explicitly block on signup.
 *
 * Curated list — covers ~95% of casual free-tier abuse without needing
 * to maintain thousands of entries. Re-add specific domains as we see
 * them appear in user signup logs.
 *
 * Bypassable via the Supabase JS SDK directly, so this is a deterrent
 * not a guarantee — pair with a Supabase Auth Hook for a hard block.
 */
const DISPOSABLE_DOMAINS = new Set<string>([
  // Mailinator family
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  // Temp-Mail and related
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmail.io",
  "tempmail.net",
  // 10-minute mail services
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "20minutemail.com",
  "30minutemail.com",
  // Guerrilla Mail family
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  // YOPmail family
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  // Throwaway and burner services
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "burnermail.io",
  "maildrop.cc",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getairmail.com",
  "getnada.com",
  "moakt.com",
  "mohmal.com",
  // Mailbox.org alts often used for throwaway
  "mytemp.email",
  "minutemail.com",
  "wegwerfemail.de",
  "spamgourmet.com",
  "mailcatch.com",
]);

/**
 * Validate an email address for signup.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateSignupEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return "Email is required";

  // Basic format check — Supabase will also validate but a fast
  // client-side reject avoids a network round trip for obvious typos.
  const formatRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!formatRe.test(trimmed)) return "Enter a valid email address";

  const domain = trimmed.split("@")[1];
  if (!domain) return "Enter a valid email address";

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return "Disposable email addresses aren't supported. Use a real email.";
  }

  return null;
}

/**
 * Validate a password for signup.
 * Existing users with weaker passwords are unaffected — this only runs
 * on the signup form, not at login or session refresh.
 */
export function validateSignupPassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 72) {
    // bcrypt's hard limit — Supabase Auth uses bcrypt under the hood
    return "Password must be 72 characters or fewer";
  }
  return null;
}

/**
 * Cloudflare Turnstile site key — public-safe to expose.
 * When set, the signup page renders the Turnstile widget and passes
 * the resulting token to Supabase, which validates it server-side
 * against the secret key configured in the Supabase dashboard.
 *
 * If unset, captcha is skipped (development / pre-launch state).
 * Once Supabase has captcha enabled in the dashboard, this env var
 * MUST be set or signups will fail with "captcha required".
 */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
