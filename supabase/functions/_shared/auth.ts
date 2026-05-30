import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** Allowed origins for CORS. In production, restrict to your domain. */
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((o) => o.trim());

function resolveOrigin(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0] ?? "";
}

/**
 * Create a Supabase client scoped to the calling user's JWT.
 * Returns the authenticated user or null.
 */
export async function authenticateRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: "Missing or invalid Authorization header" };
  }

  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: error?.message ?? "Invalid token" };
  }

  return { user, error: null };
}

/** Service-role client for privileged operations. */
export function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Build CORS headers for a specific request. */
export function getCorsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveOrigin(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  };
}

/** Standard CORS headers (fallback for non-request contexts). */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes("*") ? "*" : ALLOWED_ORIGINS[0] ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

/** Return a CORS preflight response. */
export function corsResponse(req?: Request) {
  const headers = req ? getCorsHeaders(req) : CORS_HEADERS;
  return new Response(null, { status: 204, headers });
}

/** Return a JSON response with CORS headers. */
export function jsonResponse(
  data: unknown,
  status = 200,
  req?: Request
): Response {
  const headers = req ? getCorsHeaders(req) : CORS_HEADERS;
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/** Return an error JSON response. */
export function errorResponse(
  message: string,
  status = 400,
  req?: Request
): Response {
  return jsonResponse({ error: message }, status, req);
}

/* ── Rate Limiter (in-memory, per-isolate) ──────────────────
   Simple sliding-window rate limiter. Works within a single
   warm Deno isolate. Gracefully allows traffic on cold starts.
   ──────────────────────────────────────────────────────────── */

const rateLimitStore = new Map<string, number[]>();

const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  generate:                { maxRequests: 6,  windowMs: 60_000 },    // 6/min
  "try-on":                { maxRequests: 10, windowMs: 60_000 },    // 10/min
  profile:                 { maxRequests: 20, windowMs: 60_000 },    // 20/min
  "save-outfit":           { maxRequests: 30, windowMs: 60_000 },    // 30/min
  "get-usage":             { maxRequests: 30, windowMs: 60_000 },    // 30/min
  "create-checkout-session":{ maxRequests: 5, windowMs: 60_000 },    // 5/min
  "create-portal-session": { maxRequests: 5,  windowMs: 60_000 },    // 5/min
  _default:                { maxRequests: 30, windowMs: 60_000 },    // 30/min
};

/**
 * Check rate limit for a user+function combo.
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(userId: string, functionName: string): boolean {
  const config = RATE_LIMITS[functionName] ?? RATE_LIMITS._default;
  const key = `${userId}:${functionName}`;
  const now = Date.now();

  let timestamps = rateLimitStore.get(key) ?? [];
  // Prune expired entries
  timestamps = timestamps.filter((t) => now - t < config.windowMs);

  if (timestamps.length >= config.maxRequests) {
    rateLimitStore.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  return true;
}

/** Return a 429 rate limit response. */
export function rateLimitResponse(req?: Request): Response {
  return jsonResponse(
    { error: "Too many requests. Please try again shortly." },
    429,
    req
  );
}

// Periodic cleanup of stale rate limit entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const fresh = timestamps.filter((t) => now - t < 120_000);
    if (fresh.length === 0) rateLimitStore.delete(key);
    else rateLimitStore.set(key, fresh);
  }
}, 300_000);

/* ── Input Validation ─────────────────────────────────────── */

export const MAX_PROMPT_LENGTH = 1000;
export const MAX_GARMENTS = 6;
export const MAX_BODY_SIZE = 50_000; // 50KB JSON body limit
