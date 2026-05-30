# Railory — System Document

> Comprehensive reference for the Railory platform covering architecture, database, edge functions, storage, auth, billing, and native iOS/Android implementation guidance.

---

## 1. Platform Overview

Railory is a prompt-driven outfit generator with AI virtual try-on. Users describe a style in natural language; the system searches a curated product catalogue via vector embeddings, assembles outfits with GPT-4o, and can render the outfit on a chosen avatar.

**Surfaces (two separate deployments):**

| Domain          | Repo                  | Purpose                                          |
|-----------------|-----------------------|--------------------------------------------------|
| `railory.io`    | `railory-marketing`   | Landing, pricing, about, contact, privacy, terms |
| `app.railory.io`| `railory-application` | Auth, generate, try-on, billing — *this repo*    |

Backend lives entirely in **Supabase Edge Functions** (Deno). No Next.js API routes. The web app and any future native client share the same edge function API.

**Clients today:** Next.js web app on `app.railory.io`.
**Planned:** iOS (Swift/SwiftUI), Android (Kotlin/Jetpack Compose).

---

## 2. Tech Stack

| Layer            | Technology                                                                         |
|------------------|------------------------------------------------------------------------------------|
| Web frontend     | Next.js 14.2 (App Router), React 18, Tailwind CSS                                  |
| Auth             | Supabase Auth (email + password). Password reset and change-email flows wired.     |
| Database         | Supabase Postgres 15 with pgvector                                                 |
| Storage          | Supabase Storage (6 buckets)                                                       |
| Backend logic    | Supabase Edge Functions (Deno)                                                     |
| Embeddings       | OpenAI `text-embedding-3-small`                                                    |
| Outfit assembly  | OpenAI `gpt-4o`                                                                    |
| Virtual try-on   | Google `gemini-2.5-flash-image` (primary), OpenAI `gpt-image-1` (fallback)         |
| Billing          | Stripe — Checkout, Customer Portal, webhook-driven sync                            |
| Deployment       | Vercel (web), Supabase (backend), Namecheap (DNS)                                  |

---

## 3. Environment Variables

### Web app (`.env.local`)

| Variable                       | Scope  | Purpose                                                        |
|--------------------------------|--------|----------------------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`     | client | Supabase project URL                                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| client | Supabase anon key                                              |
| `NEXT_PUBLIC_MARKETING_URL`    | client | `https://railory.io` — link target for the wordmark            |
| `SUPABASE_SERVICE_ROLE_KEY`    | server | Privileged DB access (SSR for `/profile`)                      |
| `OPENAI_API_KEY`               | server | Reserved (not used at runtime in this repo today)              |
| `GEMINI_API_KEY`               | server | Reserved (not used at runtime in this repo today)              |

### Edge Function secrets (set via `supabase secrets set`)

| Secret                          | Used by                                                                                  |
|---------------------------------|------------------------------------------------------------------------------------------|
| `SUPABASE_URL`                  | All functions (auto-set by Supabase)                                                     |
| `SUPABASE_ANON_KEY`             | All functions — used by `_shared/auth.ts` for JWT verification                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | All functions — privileged DB and storage operations                                     |
| `OPENAI_API_KEY`                | `generate`, `try-on`                                                                     |
| `GEMINI_API_KEY`                | `try-on`                                                                                 |
| `STRIPE_SECRET_KEY`             | `create-checkout-session`, `create-portal-session`, `stripe-webhook`                     |
| `STRIPE_WEBHOOK_SECRET`         | `stripe-webhook`                                                                         |
| `STRIPE_PRICE_STARTER_MONTHLY`  | `create-checkout-session`, `stripe-webhook` (for reverse price-id → plan mapping)        |
| `STRIPE_PRICE_STARTER_YEARLY`   | same                                                                                     |
| `STRIPE_PRICE_PRO_MONTHLY`      | same                                                                                     |
| `STRIPE_PRICE_PRO_YEARLY`       | same                                                                                     |
| `APP_URL`                       | `create-checkout-session`, `create-portal-session` — checkout success/cancel URLs        |
| `ALLOWED_ORIGINS`               | All functions — comma-separated CORS allowlist (e.g. `https://app.railory.io,https://railory.io`) |

### Native apps

Compile in just two values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Both are public-safe. All privileged work happens server-side inside edge functions using the service role key.

---

## 4. Authentication

### Architecture

Supabase Auth issues a short-lived **access token** (JWT) and a long-lived **refresh token** on sign-in. The web app uses cookie-based sessions via `@supabase/ssr`. Native apps use the official Supabase SDK which manages tokens automatically.

**Every edge function call** (except `stripe-webhook`) requires:

```
Authorization: Bearer <access_token>
```

The Supabase gateway validates the JWT (`verify_jwt: true`) before the function runs. Inside the function, `_shared/auth.ts` extracts the user via `supabase.auth.getUser(token)`.

### Auth flows

| Flow              | Trigger                                           | Endpoint / SDK call                                                                  |
|-------------------|---------------------------------------------------|--------------------------------------------------------------------------------------|
| Sign up           | `/signup` form                                    | `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`            |
| Sign in           | `/login` form                                     | `supabase.auth.signInWithPassword({ email, password })`                              |
| Sign out          | TopBar button                                     | `supabase.auth.signOut()`                                                            |
| Email confirmation| Link in confirm-signup email                      | `GET /auth/callback?code=...&next=/post-auth` → `exchangeCodeForSession(code)`       |
| Forgot password   | `/forgot-password` form                           | `supabase.auth.resetPasswordForEmail(email, { redirectTo: ... /auth/callback?next=/reset-password })` |
| Reset password    | Link in reset email                               | Same callback → lands on `/reset-password` with recovery session → `updateUser({ password })` |
| Change email      | Profile page → Account section                    | `supabase.auth.updateUser({ email }, { emailRedirectTo: ... /auth/callback?next=/profile })` |

### Auth callback (`/auth/callback`)

Single route handler that exchanges any `code` query param for a session and redirects to the `next` param (default `/post-auth`). The `next` param is validated to only allow same-origin relative paths (prevents open redirects).

### Post-auth handler (`/post-auth`)

Client-side router that reads `sessionStorage.pending_checkout` (set if the user came from a marketing-site pricing card). If present, fires Stripe checkout immediately. Otherwise redirects to `/generate`.

### Email templates

Branded HTML email templates live in `supabase/email-templates/`:

- `confirm-signup.html`
- `reset-password.html`
- `change-email.html`

These are pasted into **Supabase dashboard → Authentication → Emails → Templates** (one per template, with corresponding subject line). They use the Railory logo from a public Supabase Storage URL so they render in every email client without external DNS dependencies. See section 6 for the storage path.

### Middleware

`middleware.ts` → `lib/supabase/middleware.ts` runs on every request:

- **Protected** (redirect to `/login` if not authed): `/generate`, `/try-ons`, `/saved`, `/history`, `/profile`, `/billing`
- **Auth-only** (redirect to `/generate` if already authed): `/login`, `/signup`, `/forgot-password`
- **Neither** (works in both states): `/reset-password`, `/post-auth`, `/auth/callback`, `/`

Native apps should implement equivalent guards.

---

## 5. Database Schema

### 5.1 `users`

Application-level user row, extending `auth.users`. Created automatically on signup via DB trigger.

| Column                 | Type        | Notes                                                                                |
|------------------------|-------------|--------------------------------------------------------------------------------------|
| `id`                   | uuid (PK)   | Same as `auth.users.id`                                                              |
| `email`                | text        | Mirrored from auth                                                                   |
| `full_name`            | text        | Optional display name                                                                |
| `custom_avatar_url`    | text        | **Storage path** (not URL) in `user-avatars` bucket — resolved to signed URL on read |
| `height_cm`            | integer     | Body profile                                                                         |
| `weight_kg`            | integer     | Body profile                                                                         |
| `body_type`            | text        | `slim`, `athletic`, `medium`, `curvy`, `plus`                                        |
| `gender_presentation`  | text        | `female`, `male`, `androgynous`                                                      |
| `skin_tone`            | text        | `light`, `fair`, `medium`, `olive`, `brown`, `dark`                                  |
| `hair_colour`          | text        | Free text                                                                            |
| `hair_length`          | text        | `bald`, `short`, `medium`, `long`                                                    |
| `age_range`            | text        | `18-24`, `25-34`, `35-44`, `45-54`, `55+`                                            |
| `country`              | text        | ISO 3166-1 alpha-2 code (`US`, `GB`, `PK`, …)                                        |
| `preferred_currency`   | text        | ISO 4217 (`USD`, `GBP`, `EUR`, …)                                                    |
| `created_at`           | timestamptz | Auto                                                                                 |

### 5.2 `brands`, `categories`, `products`

The product catalogue. Each product has a 1536-d vector embedding for semantic search. See `scripts/` for full schemas — the relevant columns for clients are:

- `id`, `name`, `description`, `price`, `currency`, `original_price`
- `images[]` (URLs), `colours[]`, `style_tags[]`, `occasion_tags[]`, `aesthetic_tags[]`
- `product_url` (web), `deep_link_ios`, `deep_link_android` (native apps)
- `brand_id` → `brands.name`, `category_id` → `categories.name`

### 5.3 `outfit_sessions`

One row per "user prompt" event. Initial generation + refinements share a session.

| Column           | Type        |
|------------------|-------------|
| `id`             | uuid (PK)   |
| `user_id`        | uuid (FK)   |
| `initial_prompt` | text        |
| `filters`        | jsonb       |
| `created_at`     | timestamptz |

### 5.4 `outfits`

| Column          | Type        | Notes                                                                                                |
|-----------------|-------------|------------------------------------------------------------------------------------------------------|
| `id`            | uuid (PK)   |                                                                                                      |
| `session_id`    | uuid (FK)   |                                                                                                      |
| `prompt_used`   | text        | May differ from session's initial_prompt (refinements)                                               |
| `ai_reasoning`  | text        | GPT-4o's editorial styling rationale                                                                 |
| `total_price`   | numeric     |                                                                                                      |
| `preview_image` | text        | Public URL in `outfit-previews` bucket. NULL until preview generates. Persisted across sessions.     |
| `created_at`    | timestamptz |                                                                                                      |

### 5.5 `outfit_items`

| Column       | Type      | Notes                                          |
|--------------|-----------|------------------------------------------------|
| `id`         | uuid (PK) |                                                |
| `outfit_id`  | uuid (FK) |                                                |
| `product_id` | uuid (FK) |                                                |
| `role`       | text      | `top`, `bottom`, `shoe`, `jacket`, `boots`     |

### 5.6 `saved_outfits`

| Column        | Type        | Notes                                           |
|---------------|-------------|-------------------------------------------------|
| `id`          | uuid (PK)   |                                                 |
| `user_id`     | uuid (FK)   |                                                 |
| `outfit_id`   | uuid (FK)   |                                                 |
| `notes`       | text        | Optional, not yet exposed in UI                 |
| `saved_at`    | timestamptz |                                                 |

Unique constraint on `(user_id, outfit_id)` — multiple saves of the same outfit are idempotent.

### 5.7 `subscriptions`

One row per user. Auto-created on signup with `plan='free'`. Stripe fields populated by the `stripe-webhook` edge function.

| Column                   | Type        | Notes                                                                              |
|--------------------------|-------------|------------------------------------------------------------------------------------|
| `id`                     | uuid (PK)   |                                                                                    |
| `user_id`                | uuid (FK, unique) | One subscription per user                                                    |
| `plan`                   | text        | `'free'`, `'starter'`, or `'pro'`                                                  |
| `billing_interval`       | text        | `'monthly'`, `'yearly'`, or NULL (free)                                            |
| `status`                 | text        | `'active'`, `'past_due'`, `'canceled'`, `'trialing'`                               |
| `stripe_customer_id`     | text (unique) |                                                                                  |
| `stripe_subscription_id` | text (unique) |                                                                                  |
| `current_period_start`   | timestamptz | Read from `subscription.items.data[0]` (Stripe API 2025-04-30+ moved it there)     |
| `current_period_end`     | timestamptz | Same                                                                               |
| `created_at`             | timestamptz |                                                                                    |
| `updated_at`             | timestamptz |                                                                                    |

**Grace period:** if `current_period_end` is in the past by more than 3 days, the user is treated as `free` even if `status='active'` (defends against delayed webhooks).

### 5.8 `usage`

Rolling usage counters keyed by **period**. The period key model:

- **Free users**: calendar-month UTC, formatted `YYYY-MM-01` (e.g. `2026-05-01`).
- **Paid users**: the most recent monthly anniversary of their `subscription.current_period_start`, formatted `YYYY-MM-DD` (e.g. `2026-05-24` → `2026-06-24` → `2026-07-24` …).
- **Yearly subscribers**: the anchor walks forward one month at a time within the yearly billing cycle. "200/month" really means 200 each month for 12 months, not 2,400 spread across the year.

A new period key has no row → counter returns zero → counter resets cleanly without any cron job.

| Column         | Type        | Notes                                              |
|----------------|-------------|----------------------------------------------------|
| `id`           | uuid (PK)   |                                                    |
| `user_id`      | uuid (FK)   |                                                    |
| `period`       | text        | `YYYY-MM-DD` (paid) or `YYYY-MM-01` (free)         |
| `generations`  | int         | Outfit generations this period                     |
| `try_ons`      | int         | Virtual try-ons this period                        |
| `saved_looks`  | int         | Legacy — actual saved count comes from `saved_outfits` |
| `created_at`   | timestamptz |                                                    |
| `updated_at`   | timestamptz |                                                    |

Unique constraint on `(user_id, period)`.

### 5.9 RPC: `check_and_increment_usage`

Atomic check-and-increment for limit enforcement. Holds a `SELECT FOR UPDATE` row lock so concurrent callers serialize — there's no window where two requests can both wrongly succeed or both wrongly fail at the limit boundary.

```
check_and_increment_usage(
  p_user_id uuid,
  p_period  text,         -- YYYY-MM-DD or YYYY-MM-01
  p_field   text,         -- 'generations' or 'try_ons'
  p_limit   int           -- the plan's limit for this field
) → table(allowed bool, new_count int)
```

Returns `(true, new_count)` if the increment succeeded, or `(false, current_count)` if at/over the limit (no increment performed).

### 5.10 RPC: `increment_usage`

Simple atomic upsert (`INSERT … ON CONFLICT DO UPDATE`). Used for rollback when an AI call fails after a successful `check_and_increment_usage`.

```
increment_usage(
  p_user_id uuid,
  p_period  text,
  p_field   text,
  p_amount  int default 1   -- pass -1 to rollback
) → void
```

### 5.11 RPC: `match_products`

Vector similarity search over the product catalogue.

```
match_products(
  query_vector  vector(1536),
  match_count   integer,
  price_max     numeric,
  price_min     numeric,
  gender_filter text
) → setof record
```

Returns products sorted by cosine similarity, filtered by price + gender. Used by the `generate` edge function.

---

## 6. Storage Buckets

| Bucket             | Public | Purpose                                                                                |
|--------------------|--------|----------------------------------------------------------------------------------------|
| `avatars`          | Yes    | 12 predefined 3D-rendered avatar images (`f-1.png` through `a-4.png`)                  |
| `user-avatars`     | No     | User-uploaded custom avatars. Path: `{user_id}/avatar.{ext}`. Signed-URL access.       |
| `product-images`   | Yes    | Product catalogue images                                                               |
| `outfit-previews`  | Yes    | Persisted try-on preview images. Path: `{user_id}/{outfit_id}.png`                     |
| `generated-outfits`| No     | Reserved for future use                                                                |
| `brand`            | Yes    | Brand assets (logo PNG used by transactional emails)                                   |

### Public URL pattern

```
{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
```

Examples:

- Predefined avatar: `{SUPABASE_URL}/storage/v1/object/public/avatars/f-1.png`
- Brand logo (used in emails): `{SUPABASE_URL}/storage/v1/object/public/brand/railory_logo_black.png`
- Outfit preview: `{SUPABASE_URL}/storage/v1/object/public/outfit-previews/{user_id}/{outfit_id}.png`

### Signed URLs for private buckets

`user-avatars` is private. The `profile` edge function generates a 1-hour signed URL whenever a profile is fetched. Native clients should re-fetch the profile to refresh expired URLs.

---

## 7. Edge Functions

All edge functions are at `https://<project>.supabase.co/functions/v1/<name>`.

Every function except `stripe-webhook` requires `Authorization: Bearer <access_token>`. CORS allowlist is enforced via the `ALLOWED_ORIGINS` secret.

Shared helpers in `_shared/`:

- `auth.ts` — `authenticateRequest()`, `getServiceClient()`, CORS helpers, rate limit
- `plans.ts` — `PLAN_LIMITS`, `getLimits()`, `getStripePriceId()`, `planFromPriceId()`
- `subscription.ts` — period model, atomic check/increment, limit helpers, error responses
- `try-on.ts` — `generateTryOnImage()`, prompt builder, Gemini/OpenAI strategy
- `currency.ts` — price conversion, brand-shipping scoring

### 7.1 `generate`

**Purpose:** Full outfit generation pipeline.

**Method:** `POST`

**Request:**
```json
{
  "prompt": "smart casual outfit for a summer date under $200",
  "filters": {
    "budget_min": 0,
    "budget_max": 200,
    "gender": "mens",
    "brands": []
  },
  "session_id": null
}
```

**Pipeline:**

1. Atomic limit check via `check_and_increment_usage` — rejects with 403 `LIMIT_EXCEEDED` if at cap.
2. Create session (if `session_id` is null).
3. Embed prompt via OpenAI `text-embedding-3-small`.
4. Vector search via `match_products` (40 candidates).
5. Send candidates + prompt to GPT-4o — returns 4 outfit combinations.
6. Validate product IDs (filter hallucinations).
7. Save outfits + items.
8. Return enriched response.
9. On any failure post-increment, calls `incrementUsage(-1)` to rollback the counter.

**Response:**
```json
{
  "session_id": "uuid",
  "outfits": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "prompt_used": "...",
      "ai_reasoning": "A relaxed summer look with...",
      "total_price": 149.97,
      "created_at": "2026-05-24T...",
      "items": [
        {
          "product": {
            "id": "uuid",
            "name": "Linen Blend Shirt",
            "brand_name": "Zara",
            "category_name": "Tops",
            "price": 35.99,
            "currency": "USD",
            "images": ["https://..."],
            "colours": ["White"],
            "product_url": "https://...",
            "deep_link_ios": null,
            "deep_link_android": null
          },
          "role": "top"
        }
      ]
    }
  ]
}
```

### 7.2 `save-outfit`

**Save — POST:**
```json
{ "outfit_id": "uuid" }
```
Response: `{ "saved": true }`. Checks `saved_looks` total cap first.

**Unsave — DELETE** with query param `?saved_id=uuid` (the `saved_outfits.id`, not the outfit ID).
Response: `{ "saved": false }`.

### 7.3 `try-on`

**Purpose:** AI virtual try-on. Two modes:

- **Standard** (user-triggered, counts against `try_ons` limit)
- **Preview** (free, auto-generated after a new outfit is created)

**Method:** `POST`

**Request:**
```json
{
  "model_image": "https://...avatar-url.png",
  "garments": [
    { "role": "top", "image": "https://...", "name": "Linen Shirt" },
    { "role": "bottom", "image": "https://...", "name": "Chinos" },
    { "role": "shoe", "image": "https://...", "name": "Loafers" }
  ],
  "angle": null,
  "reference_image": null,
  "body_context": null,
  "preview": false,
  "outfit_id": null,
  "pose": null
}
```

| Field             | Type             | Notes                                                                 |
|-------------------|------------------|-----------------------------------------------------------------------|
| `model_image`     | URL              | Avatar URL (predefined public or signed URL for custom)               |
| `garments`        | array            | Min 1. Each: `role`, `image` (URL), `name`                            |
| `angle`           | string?          | `front`, `back`, `left-side`, `right-side`, `three-quarter`, `close-up-top`, `close-up-bottom` |
| `reference_image` | string?          | Base64 data URL of previous result, for angle consistency             |
| `body_context`    | object?          | Sent when using custom avatar: `height_cm`, `weight_kg`, `body_type`, `gender_presentation`, `skin_tone` |
| `preview`         | boolean          | `true` = free preview, no usage counted. Requires `outfit_id`.        |
| `outfit_id`       | string?          | Required when `preview: true`                                         |
| `pose`            | string?          | Pose instruction for preview variety (preview-only)                   |

**Standard mode:** atomic limit check, returns base64 data URL.
**Preview mode:** no limits, persists to `outfit-previews` bucket, returns public URL, writes URL into `outfits.preview_image`.

**Preview poses** (cycled by outfit index 0–3):

| Index | Pose                                                            |
|-------|-----------------------------------------------------------------|
| 0     | Standing straight, arms relaxed at sides, feet together         |
| 1     | Arms crossed over chest, composed editorial stance              |
| 2     | One hand on hip, weight shifted, confident                      |
| 3     | Both hands in pockets, relaxed slouch                           |

**Provider strategy:**
1. Try Gemini 2.5 Flash Image (cheaper).
2. Fallback to OpenAI `gpt-image-1` (1024×1024, low quality, ~$0.011/image).

**Response:**
```json
{ "output_url": "https://...storage/.../{outfit_id}.png" }
```

Preview returns the persisted public URL. Standard returns a base64 data URL.

### 7.4 `profile`

| Method | Purpose                  | Body                            | Response                            |
|--------|--------------------------|---------------------------------|-------------------------------------|
| GET    | Fetch profile            | —                               | Profile + signed `custom_avatar_url`|
| PATCH  | Update body details      | Subset of profile fields        | `{ "ok": true }`                    |
| POST   | Upload custom avatar     | `multipart/form-data` `avatar`  | `{ "custom_avatar_url": "..." }`    |

**Avatar upload** is gated to the `pro` plan (returns 403 `FEATURE_GATED` otherwise).

### 7.5 `create-checkout-session`

**POST:**
```json
{ "plan": "starter" | "pro", "interval": "monthly" | "yearly" }
```

Resolves to a Stripe Price ID, creates a Stripe Checkout Session, returns `{ "url": "https://checkout.stripe.com/..." }`. The client redirects there. Success returns to `${APP_URL}/billing?success=true`.

### 7.6 `create-portal-session`

**POST** (no body). Returns `{ "url": "https://billing.stripe.com/..." }`. Requires the user to already have a `stripe_customer_id` (i.e. has subscribed at least once).

### 7.7 `get-usage`

**GET** (no body). Returns the user's plan, limits, and current-period usage for billing UI.

```json
{
  "plan": "starter",
  "status": "active",
  "billing_interval": "yearly",
  "current_period_end": "2027-05-24T23:12:40+00:00",
  "limits": {
    "generations": 50,
    "try_ons": 30,
    "saved_looks": 50,
    "try_on_angles": 3,
    "custom_avatar": false
  },
  "usage": {
    "generations": 12,
    "try_ons": 5,
    "saved_looks": 8
  }
}
```

The `usage` figures reflect the user's *current monthly period* — billing-anniversary for paid plans, calendar month for free.

### 7.8 `stripe-webhook`

**POST** — Stripe calls this directly, `verify_jwt: false`. Signature verified via `STRIPE_WEBHOOK_SECRET`.

Endpoint URL to register in Stripe dashboard:

```
https://<project>.supabase.co/functions/v1/stripe-webhook
```

Events handled:

| Event                            | Action                                                                   |
|----------------------------------|--------------------------------------------------------------------------|
| `checkout.session.completed`     | Activate subscription, set plan + billing interval + period dates        |
| `invoice.paid`                   | Renew period dates, confirm `status='active'`                            |
| `customer.subscription.updated`  | Plan/status change                                                       |
| `customer.subscription.deleted`  | Downgrade to free                                                        |

**Important:** period dates are read from `subscription.items.data[0].current_period_start/end` (Stripe API 2025-04-30+ moved them from the top-level Subscription object). A `getPeriodDates()` helper falls back to the top-level fields for older API versions.

### 7.9 Plan limits

| Feature                   | Free | Starter             | Pro                  |
|---------------------------|------|---------------------|----------------------|
| Price                     | $0   | $19/mo or $190/yr   | $39/mo or $390/yr    |
| Generations / month       | 5    | 50                  | 200                  |
| Virtual try-ons / month   | 0    | 30                  | 100                  |
| Saved looks (total cap)   | 10   | 50                  | 500                  |
| Try-on angles             | 0    | 3 (front, back, left)| 7 (all angles)      |
| Custom avatar upload      | No   | No                  | Yes                  |

### 7.10 Error responses

**Limit exceeded** (HTTP 403):
```json
{
  "error": "generations limit reached",
  "code": "LIMIT_EXCEEDED",
  "resource": "generations",
  "current": 50,
  "limit": 50,
  "plan": "starter",
  "upgrade_url": "/billing"
}
```

**Feature gated** (HTTP 403):
```json
{
  "error": "Custom avatar is not available on the starter plan",
  "code": "FEATURE_GATED",
  "feature": "Custom avatar",
  "plan": "starter",
  "upgrade_url": "/billing"
}
```

**Auth failure** (HTTP 401): `{ "error": "Unauthorized" }`
**Rate limited** (HTTP 429): `{ "error": "Too many requests" }`

---

## 8. Predefined Avatars

12 3D-rendered avatars in the public `avatars` bucket. Diverse across gender, ethnicity, body type.

| ID    | Name   | Gender      | Description                            |
|-------|--------|-------------|----------------------------------------|
| `f-1` | Amara  | Female      | Young Black woman, slim                |
| `f-2` | Sofia  | Female      | Latina, mid-20s, medium                |
| `f-3` | Mei    | Female      | East Asian, petite                     |
| `f-4` | Priya  | Female      | South Asian, curvy                     |
| `m-1` | James  | Male        | White, athletic, 30s                   |
| `m-2` | Kwame  | Male        | Black, tall, lean                      |
| `m-3` | Ravi   | Male        | South Asian, medium                    |
| `m-4` | Kenji  | Male        | East Asian, slim, 20s                  |
| `a-1` | River  | Androgynous | Mixed-race, lean                       |
| `a-2` | Sam    | Androgynous | White, medium, 40s                     |
| `a-3` | Jules  | Androgynous | Black, athletic                        |
| `a-4` | Noor   | Androgynous | Middle-Eastern, slim                   |

**URL pattern:** `{SUPABASE_URL}/storage/v1/object/public/avatars/{id}.png`

**Image specs:** Full-body, front-facing, neutral pose, plain background, fitted base clothing, ≥768×1024px.

---

## 9. Web App Structure

### Routes

| Route               | Description                                                                                  |
|---------------------|----------------------------------------------------------------------------------------------|
| `/`                 | Auth-aware: redirects authed users to `/generate`, guests to `/login`                        |
| `/login`            | Email/password login, with "Forgot password?" link                                           |
| `/signup`           | Registration                                                                                 |
| `/forgot-password`  | Email input, fires reset email                                                               |
| `/reset-password`   | Lands here from reset email; sets new password                                               |
| `/post-auth`        | Reads `sessionStorage.pending_checkout`, fires Stripe checkout if set                        |
| `/auth/callback`    | Exchanges Supabase auth `code` for session                                                   |
| `/generate`         | Prompt input + horizontal outfit carousel                                                    |
| `/try-ons`          | Virtual try-on gallery                                                                       |
| `/saved`            | Saved outfits grid                                                                           |
| `/history`          | Session history with expanded card view (4-col grid)                                         |
| `/profile`          | Account (email change), avatar upload, body details, country & currency                      |
| `/billing`          | Plan, usage meters, upgrade flow, manage subscription                                        |

### Key shared components

| Component        | Purpose                                                                                              |
|------------------|------------------------------------------------------------------------------------------------------|
| `TopBar`         | Fixed-position top nav (`position: fixed top-0 z-30`)                                                |
| `PromptInput`    | Prompt textarea with submit                                                                          |
| `FilterBar`      | Budget slider, gender selector, brand filter                                                         |
| `OutfitCarousel` | Horizontal-scroll carousel of outfit cards with progressive preview loading                          |
| `OutfitCard`     | Preview-first card. Wheel inside the card cycles images (with boundary passthrough on grid pages, locked on carousel) |
| `TryOnModal`     | Avatar selection + garment picker + angle controls + result display                                  |
| `ProfileForm`    | Account section (change email), avatar upload, body details, location/currency                       |
| `UpgradeBanner`  | Inline upgrade prompt on limit/feature errors                                                        |

### Design system

- **No rounded corners** — sharp, editorial aesthetic across the auth surface and the rest of the app.
- **Tailwind tokens:** `near-black`, `ink`, `muted-slate`, `stone`, `canvas`, `hairline`, `coral`, `deep-green`, `action-blue`.
- **Typography:** `font-display` (Space Grotesk) for headings, `font-sans` (Inter) for body, `font-mono` (JetBrains Mono) for small labels.

---

## 10. User Flows

### 10.1 Sign up → confirm → first session

```
/signup → supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
  ↓
"Check your email" screen
  ↓ (user clicks confirm in email)
/auth/callback?code=... → exchangeCodeForSession
  ↓
/post-auth — checks sessionStorage.pending_checkout
  ↓
  if pending: redirect to Stripe Checkout
  else: redirect to /generate
```

### 10.2 Forgot password

```
/forgot-password → resetPasswordForEmail(email, { redirectTo: /auth/callback?next=/reset-password })
  ↓
"Check your email" screen
  ↓ (user clicks reset link)
/auth/callback?code=...&next=/reset-password → exchangeCodeForSession (recovery)
  ↓
/reset-password — gated by valid recovery session
  ↓ (user submits new password)
updateUser({ password }) → /generate (now authed normally)
```

### 10.3 Change email (from profile)

```
/profile → Account section → enters new email → Change email
  ↓
updateUser({ email }, { emailRedirectTo: /auth/callback?next=/profile })
  ↓
"Confirmation sent to <new email>" toast
  ↓ (user clicks link in NEW email)
/auth/callback?code=... → exchangeCodeForSession → /profile shows new email
```

### 10.4 Generate outfits

```
User submits prompt → POST /generate
  ↓
edge function: limit check → embed → vector search → GPT-4o → save → return outfits
  ↓
client kicks off 4 parallel POSTs to /try-on with preview=true, one per outfit
  ↓
each preview persists to outfit-previews bucket and writes URL to outfits.preview_image
  ↓
cards stream into carousel as previews arrive
```

### 10.5 Standard try-on (paid feature)

```
User opens try-on modal on a card → POST /try-on (no preview flag)
  ↓
atomic check_and_increment_usage on try_ons
  ↓
fetch images → build prompt → Gemini (fallback OpenAI) → return base64
  ↓
user picks angle → POST /try-on with angle + reference_image
```

### 10.6 Subscription upgrade

```
/billing → user clicks plan card
  ↓
POST /create-checkout-session { plan, interval }
  ↓
redirect to Stripe Checkout
  ↓
Stripe → POST webhook to /stripe-webhook
  ↓
DB: subscriptions row updated with plan, period dates from items.data[0]
  ↓
redirect back to /billing?success=true → /get-usage reflects new plan + limits
```

---

## 11. Native App Implementation Guide

### 11.1 SDKs

| Platform | Library                                                                |
|----------|------------------------------------------------------------------------|
| iOS      | [`supabase-swift`](https://github.com/supabase/supabase-swift)         |
| Android  | [`supabase-kt`](https://github.com/supabase-community/supabase-kt)     |

Both SDKs handle token persistence, refresh, and secure storage. Initialize with `SUPABASE_URL` + `SUPABASE_ANON_KEY`.

### 11.2 Calling edge functions

**Swift:**
```swift
let response: GenerateResponse = try await supabase.functions.invoke(
  "generate",
  options: .init(body: [
    "prompt": "casual summer outfit",
    "filters": ["budget_max": 200, "gender": "mens"]
  ])
)
```

**Kotlin:**
```kotlin
val response = supabase.functions.invoke("generate") {
  setBody(buildJsonObject {
    put("prompt", "casual summer outfit")
    putJsonObject("filters") {
      put("budget_max", 200)
      put("gender", "mens")
    }
  })
}.body<GenerateResponse>()
```

The SDK automatically attaches the `Authorization: Bearer` header.

### 11.3 Direct DB reads (Postgres via Supabase REST/Realtime)

Read directly (subject to RLS — users can only see their own rows):

- `outfit_sessions` — list past sessions
- `outfits` + `outfit_items` joined with `products` — load a session
- `saved_outfits` joined with `outfits` → `outfit_items` → `products` — saved looks list

Write only via edge functions (never direct insert/update on these tables).

### 11.4 Image handling

| Image type           | Source                                              | Caching       |
|----------------------|-----------------------------------------------------|---------------|
| Product images       | `products.images[]` — public URLs                   | Cache forever |
| Predefined avatar    | `avatars/{id}.png` — public URL                     | Cache forever |
| Custom avatar        | Signed URL from `profile` GET (1hr expiry)          | Cache 1hr; re-fetch profile to refresh |
| Outfit preview       | `outfits.preview_image` — public URL, persisted     | Cache forever |
| Try-on result (standard) | Base64 data URL                                 | Decode + display; not persisted |

### 11.5 Deep links

`products.deep_link_ios` and `deep_link_android` open the product in the retailer's native app. Fall back to `products.product_url` for web. Both columns may be NULL — check before use.

### 11.6 Push notifications

Not implemented in v1. Recommended trigger candidates for future:

- Subscription renewal upcoming (Stripe webhook → push)
- "Limit almost reached" reminder
- New seasonal collection drop

Implementation would route through APNs/FCM with tokens stored on a new `device_tokens` table.

### 11.7 Offline behavior

| Feature              | Offline-capable? | Notes                                                    |
|----------------------|------------------|----------------------------------------------------------|
| Browse saved outfits | Yes              | Cache `saved_outfits` + product data                     |
| View profile         | Yes              | Cache last-fetched profile                               |
| Generate             | No               | Requires server-side AI                                  |
| Try-on               | No               | Requires server-side AI                                  |
| Sign up / log in     | No               | Auth network call                                        |

Use Supabase Realtime if you want live updates to `outfit_sessions` / `saved_outfits` when the user has the app open.

### 11.8 Suggested screens

| Screen          | Notes                                                                                  |
|-----------------|----------------------------------------------------------------------------------------|
| Splash + Onboarding | Sign-up / sign-in choice. After auth, check `/get-usage` for plan state.            |
| Generate        | Prompt input + filter chips + result carousel (mirrors web `/generate`)                |
| Outfit detail   | Full preview, AI reasoning, item list with deep link buttons                           |
| Try-on          | Avatar picker + angle controls (gate angles by plan; gate custom avatar by Pro)        |
| Saved           | Grid of saved outfits                                                                  |
| History         | Sessions list, expandable to grid                                                      |
| Profile         | Body details, avatar upload, country/currency, change email                            |
| Billing         | Plan + usage meters + upgrade CTA (open Stripe Customer Portal via web)                |

---

## 12. Security Model

### Edge function auth

1. Supabase gateway validates the JWT (`verify_jwt: true`) before the function runs — invalid/expired tokens get rejected with 401 by the gateway, never reach our code.
2. `_shared/auth.ts` calls `supabase.auth.getUser(token)` to get the verified user.
3. Service role client is used inside functions for privileged ops. Never exposed to the client.

### Row-level security

RLS enabled on all user-scoped tables. Policies:

- Users read/write their own `subscriptions`, `usage`, `outfit_sessions`, `outfits`, `outfit_items`, `saved_outfits`.
- Products, brands, categories: readable by all authenticated users.

Service role bypasses RLS, used by edge functions for cross-user ops (e.g. webhook updating arbitrary subscriptions).

### Storage policies

- `user-avatars` — private; folder-per-user policies + signed URLs for read.
- `avatars`, `product-images`, `outfit-previews`, `brand` — public.

### Open redirect defense

`/auth/callback` validates the `next` param: must start with `/` and not `//`. Falls back to `/post-auth` otherwise.

### CORS

Edge functions check `Origin` against `ALLOWED_ORIGINS` (currently `https://app.railory.io,https://railory.io`). For native apps, the Origin header is typically absent — handle in the CORS helper if needed for mobile.

### What the client never sees

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`, `GEMINI_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Raw product embeddings

---

## 13. Domain & Deployment

### Domains

| Surface  | Domain          | Project                                         |
|----------|-----------------|-------------------------------------------------|
| Marketing| `railory.io`    | Vercel project: `railory-marketing`             |
| App      | `app.railory.io`| Vercel project: `railory-application`           |
| Backend  | `<ref>.supabase.co` | Supabase project: `rkbljmsalughhsuspwoi`    |

### DNS (Namecheap)

| Type  | Host  | Value                            |
|-------|-------|----------------------------------|
| A     | `@`   | `76.76.21.21` (Vercel apex)      |
| CNAME | `www` | `cname.vercel-dns.com`           |
| CNAME | `app` | `cname.vercel-dns.com`           |

### Supabase auth URL config

- **Site URL:** `https://app.railory.io`
- **Redirect URLs:**
  - `https://app.railory.io/auth/callback`
  - `https://app.railory.io/post-auth`
  - `http://localhost:3000/auth/callback` (dev)

### Cookie scope

Supabase auth cookies are scoped to `app.railory.io`. They are **not** sent to `railory.io`. The marketing site cannot tell whether a user is logged in. Pricing CTAs always go to `app.railory.io/signup?plan=...` and the app routes appropriately if the user is already signed in.

---

## 14. Allowed Values Reference

Useful for building form UIs.

| Field                | Options                                                                                      |
|----------------------|----------------------------------------------------------------------------------------------|
| Body type            | `slim`, `athletic`, `medium`, `curvy`, `plus`                                                |
| Gender presentation  | `female`, `male`, `androgynous`                                                              |
| Skin tone            | `light`, `fair`, `medium`, `olive`, `brown`, `dark`                                          |
| Hair length          | `bald`, `short`, `medium`, `long`                                                            |
| Hair colour          | Free text                                                                                    |
| Age range            | `18-24`, `25-34`, `35-44`, `45-54`, `55+`                                                    |
| Outfit gender filter | `mens`, `womens`, `unisex`                                                                   |
| Outfit item roles    | `top`, `bottom`, `shoe`, `jacket`, `boots`                                                   |
| Try-on angles        | `front`, `back`, `left-side`, `right-side`, `three-quarter`, `close-up-top`, `close-up-bottom` |
| Country (ISO 3166-1) | `US`, `GB`, `PK`, `AE`, `SA`, `IN`, `DE`, `FR`, `CA`, `AU`, `TR`                             |
| Currency (ISO 4217)  | `USD`, `GBP`, `EUR`, `PKR`, `AED`, `SAR`, `INR`, `CAD`, `AUD`, `TRY`                         |

---

## 15. API Quick Reference

| Action                 | Function                | Method  | Key fields                                                                             |
|------------------------|-------------------------|---------|----------------------------------------------------------------------------------------|
| Generate outfits       | `generate`              | POST    | `prompt`, `filters`, `session_id?`                                                     |
| Save outfit            | `save-outfit`           | POST    | `outfit_id`                                                                            |
| Unsave outfit          | `save-outfit`           | DELETE  | `?saved_id=uuid`                                                                       |
| Try on (standard)      | `try-on`                | POST    | `model_image`, `garments[]`, `angle?`, `reference_image?`, `body_context?`             |
| Try on (preview)       | `try-on`                | POST    | `model_image`, `garments[]`, `preview: true`, `outfit_id`, `pose?`                     |
| Get profile            | `profile`               | GET     | —                                                                                      |
| Update profile         | `profile`               | PATCH   | Body detail fields                                                                     |
| Upload avatar (Pro)    | `profile`               | POST    | `avatar` (multipart)                                                                   |
| Get usage              | `get-usage`             | GET     | —                                                                                      |
| Start checkout         | `create-checkout-session`| POST   | `plan`, `interval`                                                                     |
| Open billing portal    | `create-portal-session` | POST    | —                                                                                      |

### Approx API cost per call (server-side)

| Call                      | Cost          |
|---------------------------|---------------|
| Generate (embed + GPT-4o) | ~$0.03        |
| Try-on preview (Gemini)   | ~$0.002       |
| Try-on preview (OpenAI fallback, 1024×1024 low) | ~$0.011 |
| Full generation (incl. 4 previews) | ~$0.04 – $0.08 |

---

## 16. Useful SQL Queries (for debugging)

```sql
-- Subscription for a user
select * from public.subscriptions where user_id = '<uuid>';

-- Current period usage for a user
select * from public.usage
where user_id = '<uuid>'
order by period desc
limit 5;

-- All saved outfits with product items
select s.id, s.saved_at, o.ai_reasoning, p.name, p.price, p.currency
from public.saved_outfits s
join public.outfits o on o.id = s.outfit_id
join public.outfit_items oi on oi.outfit_id = o.id
join public.products p on p.id = oi.product_id
where s.user_id = '<uuid>'
order by s.saved_at desc;

-- Recently active sessions
select s.id, s.initial_prompt, count(o.id) as outfit_count, s.created_at
from public.outfit_sessions s
left join public.outfits o on o.session_id = s.id
where s.user_id = '<uuid>'
group by s.id
order by s.created_at desc
limit 20;

-- Fast-forward usage to test limits
update public.usage set generations = 50
where user_id = '<uuid>' and period = '2026-05-24';
```
