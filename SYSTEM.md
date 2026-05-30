# Morphié — System Document

> Comprehensive reference for the Morphié platform covering architecture, database, edge functions, storage, auth, and guidelines for native iOS/Android clients.

---

## 1. Platform Overview

Morphié is a prompt-driven outfit generator. Users describe a style in natural language, the system finds matching products via vector search, assembles outfits with GPT-4o, and offers AI-powered virtual try-on with diverse avatars.

**Current clients:** Next.js web app (the primary client)
**Planned clients:** iOS (Swift/SwiftUI), Android (Kotlin/Jetpack Compose)

All business logic lives in **Supabase Edge Functions** — the web app has zero API routes. Native apps call the same edge functions with the same auth pattern.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Web frontend | Next.js 14.2 (App Router), React 18, Tailwind CSS |
| Auth | Supabase Auth (email/password) |
| Database | Supabase (PostgreSQL 15) with pgvector |
| Storage | Supabase Storage (4 buckets) |
| Backend logic | Supabase Edge Functions (Deno) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Outfit generation | OpenAI `gpt-4o` |
| Virtual try-on | Google `gemini-2.5-flash-image` (primary), OpenAI `gpt-image-1` (fallback) |
| Deployment | Vercel (web), Supabase (backend) |

### Key dependencies (web)

- `@supabase/supabase-js` — client SDK
- `@supabase/ssr` — server-side auth (cookies)
- `framer-motion` — landing page animations
- `lenis` — smooth scrolling (landing page)
- `lucide-react` — icons
- `lucide-react` — icons (landing page + UI)
- `openai` — unused at runtime now (was used by old API routes)

---

## 3. Environment Variables

### Web app (`.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public, embedded in client bundle) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (public, embedded in client bundle) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only — profile page SSR) |
| `OPENAI_API_KEY` | Server-side only (profile page SSR path, not currently used) |
| `GEMINI_API_KEY` | Server-side only (not currently used) |

### Edge Functions (Supabase Secrets)

| Secret | Used by |
|---|---|
| `SUPABASE_URL` | All functions (auto-set by Supabase) |
| `SUPABASE_ANON_KEY` | `_shared/auth.ts` — user JWT verification |
| `SUPABASE_SERVICE_ROLE_KEY` | All functions — privileged DB/storage operations |
| `OPENAI_API_KEY` | `generate`, `try-on` |
| `GEMINI_API_KEY` | `try-on` |
| `STRIPE_SECRET_KEY` | `create-checkout-session`, `create-portal-session`, `stripe-webhook` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` |
| `STRIPE_PRICE_STARTER_MONTHLY` | `create-checkout-session`, `stripe-webhook` |
| `STRIPE_PRICE_STARTER_YEARLY` | `create-checkout-session`, `stripe-webhook` |
| `STRIPE_PRICE_PRO_MONTHLY` | `create-checkout-session`, `stripe-webhook` |
| `STRIPE_PRICE_PRO_YEARLY` | `create-checkout-session`, `stripe-webhook` |

### For native apps

Native apps only need two values compiled in:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

These are public and safe to embed. The anon key is used for auth and for calling edge functions. All privileged operations happen server-side inside edge functions using the service role key.

---

## 4. Authentication

### Flow

1. User signs up / logs in via Supabase Auth (email + password)
2. Supabase returns an **access token** (JWT) and a refresh token
3. Every edge function call includes `Authorization: Bearer <access_token>`
4. The Supabase gateway verifies the JWT (`verify_jwt: true`)
5. Our `_shared/auth.ts` extracts the user ID from the token

### Web implementation

The web app uses `@supabase/ssr` for cookie-based sessions. The helper `lib/api.ts` → `callEdgeFunction()` reads the session and attaches the Bearer token:

```typescript
const { data: { session } } = await supabase.auth.getSession();
// Then: Authorization: Bearer ${session.access_token}
```

### Native app implementation

Use the Supabase client SDK for your platform:
- **iOS:** `supabase-swift`
- **Android:** `supabase-kt`

After login, the SDK manages tokens automatically. When calling edge functions:

```
POST https://<project>.supabase.co/functions/v1/<function-name>
Authorization: Bearer <access_token>
Content-Type: application/json
```

The SDK provides helpers like `supabase.functions.invoke("function-name", body: ...)` that attach the token automatically.

### Protected routes (web)

Root `middleware.ts` delegates to `lib/supabase/middleware.ts` which redirects unauthenticated users:
- `/generate`, `/saved`, `/history`, `/profile`, `/billing` — require auth
- `/login`, `/signup` — redirect to `/generate` if already authenticated

Native apps should implement equivalent navigation guards.

---

## 5. Database Schema

### 5.1 `users`

Extends Supabase `auth.users`. Created automatically on signup via trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Same as `auth.users.id` |
| `email` | text | From auth |
| `full_name` | text | Optional display name |
| `created_at` | timestamptz | Auto |
| `avatar_url` | text | Legacy / unused avatar URL field |
| `custom_avatar_url` | text | Storage path (not URL) to user's avatar in `user-avatars` bucket |
| `height_cm` | integer | Body profile |
| `weight_kg` | integer | Body profile |
| `body_type` | text | `slim`, `athletic`, `medium`, `curvy`, `plus` |
| `gender_presentation` | text | `female`, `male`, `androgynous` |
| `skin_tone` | text | `light`, `fair`, `medium`, `olive`, `brown`, `dark` |
| `hair_colour` | text | Free text (e.g. "Brown", "Black") |
| `hair_length` | text | `bald`, `short`, `medium`, `long` |
| `age_range` | text | `18-24`, `25-34`, `35-44`, `45-54`, `55+` |

**Note:** `custom_avatar_url` stores the **storage path** (e.g. `abc123-uuid/avatar.png`), not a full URL. The `profile` edge function resolves it to a signed URL on read.

### 5.2 `brands`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `name` | text | e.g. "Zara" |
| `slug` | text | URL-safe identifier |
| `base_url` | text | Brand website |
| `logo_url` | text | |
| `price_tier` | text | |
| `has_api` | boolean | |
| `affiliate_base` | text | |
| `scrape_config` | jsonb | Scraper configuration |
| `is_active` | boolean | |
| `created_at` | timestamptz | |

### 5.3 `categories`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `name` | text | e.g. "Tops", "Trousers", "Shoes" |
| `parent_category` | text | |
| `display_order` | integer | |

### 5.4 `products`

The core product catalogue. Each product has a vector embedding for semantic search.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `source` | text | Where scraped from |
| `brand_id` | uuid (FK → brands) | |
| `category_id` | uuid (FK → categories) | |
| `external_id` | text | Original product ID from source |
| `parent_product_id` | uuid | For colour variants |
| `name` | text | Product name |
| `subcategory` | text | |
| `description` | text | |
| `tagline` | text | |
| `collection_name` | text | |
| `collection_season` | text | |
| `is_new_arrival` | boolean | |
| `price` | numeric | Current price |
| `original_price` | numeric | Before discount |
| `currency` | text | Default GBP |
| `is_on_sale` | boolean | |
| `discount_percent` | numeric | |
| `colours` | text[] | e.g. `["Navy", "Blue"]` |
| `colour_codes` | text[] | Hex codes |
| `sizes_available` | text[] | |
| `size_system` | text | |
| `fit` | text | e.g. "regular", "slim", "oversized" |
| `dimensions` | jsonb | |
| `weight_grams` | integer | |
| `materials` | text[] | |
| `care_instructions` | text[] | |
| `country_of_origin` | text | |
| `style_tags` | text[] | e.g. `["casual", "streetwear"]` |
| `occasion_tags` | text[] | e.g. `["date-night", "work"]` |
| `season_tags` | text[] | |
| `aesthetic_tags` | text[] | e.g. `["minimalist", "editorial"]` |
| `gender` | text | `mens`, `womens`, `unisex` |
| `images` | text[] | Product image URLs |
| `source_image_urls` | text[] | Original source URLs |
| `variants` | jsonb | Colour/size variant data |
| `shipping_info` | jsonb | |
| `stock_status` | jsonb | |
| `rating` | numeric | |
| `review_count` | integer | |
| `rating_breakdown` | jsonb | |
| `product_url` | text | Link to buy |
| `affiliate_url` | text | |
| `deep_link_ios` | text | For native app deep linking |
| `deep_link_android` | text | For native app deep linking |
| `styled_with` | text[] | Related product IDs |
| `sustainability_info` | jsonb | |
| `search_keywords` | text[] | |
| `raw_scraped_text` | text | |
| `raw_product` | jsonb | Full raw scraped payload |
| `scrape_confidence` | numeric | |
| `combined_text` | text | Concatenated searchable text |
| `embedding` | vector(1536) | OpenAI `text-embedding-3-small` |
| `vector_timestamp` | timestamptz | When embedding was generated |
| `scraped_at` | timestamptz | |
| `last_updated` | timestamptz | |
| `is_active` | boolean | |
| `jewellery_metal` | text | |
| `jewellery_stone` | text | |

### 5.5 `outfit_sessions`

Groups related outfit generations (initial + refinements).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |
| `initial_prompt` | text | The user's original styling request |
| `filters` | jsonb | Filters used for the session (budget, gender, etc.) |
| `created_at` | timestamptz | |

### 5.6 `outfits`

Individual outfit combinations within a session.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `session_id` | uuid (FK → outfit_sessions) | |
| `prompt_used` | text | May differ from initial prompt (refinements) |
| `ai_reasoning` | text | GPT-4o's editorial styling rationale |
| `total_price` | numeric | Sum of item prices |
| `preview_image` | text | Public URL to persisted try-on preview in `outfit-previews` bucket. NULL until preview is generated. |
| `created_at` | timestamptz | |

### 5.7 `outfit_items`

Products assigned to each outfit with a role.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `outfit_id` | uuid (FK → outfits) | |
| `product_id` | uuid (FK → products) | |
| `role` | text | `top`, `bottom`, `shoe`, `jacket`, etc. |

### 5.8 `saved_outfits`

User bookmarks. Has a unique constraint on `(user_id, outfit_id)`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |
| `outfit_id` | uuid (FK → outfits) | |
| `notes` | text | Optional user notes (not yet exposed in UI) |
| `saved_at` | timestamptz | |

### 5.9 `subscriptions`

One row per user. Auto-created on signup via database trigger (defaults to free plan).
Stripe fields are NULL for free-tier users and populated by the `stripe-webhook` edge function.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users, unique) | One subscription per user |
| `plan` | text | `'free'`, `'starter'`, or `'pro'` |
| `billing_interval` | text | `'monthly'`, `'yearly'`, or NULL (free) |
| `status` | text | `'active'`, `'past_due'`, `'canceled'`, `'trialing'` |
| `stripe_customer_id` | text (unique) | Stripe customer ID |
| `stripe_subscription_id` | text (unique) | Stripe subscription ID |
| `current_period_start` | timestamptz | Current billing period start |
| `current_period_end` | timestamptz | Current billing period end |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 5.10 `usage`

Rolling monthly usage counters. Period key is first-of-month (`'2026-05-01'`).
Upserted atomically by edge functions via the `increment_usage` RPC.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → users) | |
| `period` | text | `'YYYY-MM-01'` format |
| `generations` | int | Outfit generation count this period |
| `try_ons` | int | Virtual try-on render count this period |
| `saved_looks` | int | (Legacy counter — actual saved count is queried from `saved_outfits`) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Unique constraint on `(user_id, period)`.

### 5.11 Database Function: `increment_usage`

Atomic upsert for usage counters. Called from edge functions.

```
increment_usage(
  p_user_id uuid,
  p_period  text,
  p_field   text,    -- 'generations', 'try_ons', or 'saved_looks'
  p_amount  int default 1
) → void
```

### 5.12 Database Function: `match_products`

PostgreSQL RPC function for vector similarity search.

```
match_products(
  query_vector  vector(1536),
  match_count   integer,
  price_max     numeric,
  price_min     numeric,
  gender_filter text
) → setof record
```

Returns products sorted by cosine similarity to the query vector, filtered by price range and gender. Returns columns matching the `ProductCandidate` interface (id, name, brand_name, category_name, price, colours, images, style_tags, etc.) plus a `similarity` score.

---

## 6. Storage Buckets

| Bucket | Public | Purpose |
|---|---|---|
| `avatars` | Yes | 12 predefined 3D-rendered avatar images (f-1.png through a-4.png) |
| `user-avatars` | No | User-uploaded custom avatar photos. Path: `{user_id}/avatar.{ext}` |
| `product-images` | Yes | Product catalogue images |
| `outfit-previews` | Yes | Persisted try-on preview images. Path: `{user_id}/{outfit_id}.png`. Written by `try-on` edge function in preview mode. |
| `generated-outfits` | No | Reserved for future use |

### `user-avatars` storage policies

Each user can only access their own folder (`{user_id}/*`):

- **INSERT:** authenticated users, `foldername(name)[1] = auth.uid()`
- **UPDATE:** authenticated users, same folder check
- **SELECT:** authenticated users, same folder check
- **DELETE:** authenticated users, same folder check

The edge functions use the **service role key** which bypasses these policies. The policies exist for any future direct client-side storage access.

### `outfit-previews` storage policies

Public bucket — anyone can read. Write access is via service role (edge functions):

- **SELECT:** anyone (public bucket)
- **INSERT:** service role (edge function uploads after preview generation)
- **UPDATE:** service role (upsert on re-generation)

### Accessing private bucket files

Since `user-avatars` is private, files are accessed via **signed URLs** (1-hour expiry). The `profile` edge function generates a fresh signed URL whenever a profile is fetched.

---

## 7. Edge Functions

All edge functions live at `https://<project>.supabase.co/functions/v1/<name>`.

Every function (except `stripe-webhook`):
- Requires `Authorization: Bearer <access_token>` header
- Has `verify_jwt: true` (Supabase gateway validates the JWT before the function runs)
- Extracts the user via `_shared/auth.ts`
- Uses the service role client for privileged DB/storage operations
- Returns JSON with CORS headers

Shared helpers in `_shared/`:
- `auth.ts` — `authenticateRequest()`, `getServiceClient()`, CORS helpers
- `plans.ts` — `PLAN_LIMITS`, `getLimits()`, `getStripePriceId()`, `planFromPriceId()`
- `subscription.ts` — `getUserSubscription()`, `getPeriodUsage()`, `getSavedCount()`, `incrementUsage()`, limit check functions, `limitResponse()`, `featureGatedResponse()`
- `try-on.ts` — `generateTryOnImage()`, `ANGLE_DESCRIPTIONS`, `toB64()`, `Garment` type. Contains `buildPrompt()` (with pose support), `tryGemini()`, `tryOpenAI()`. All image generation uses 1024×1024 low quality on OpenAI.

### 7.1 `generate`

**Purpose:** Full outfit generation pipeline — embed prompt, vector search, GPT-4o outfit assembly, save to DB, return enriched results.

**Method:** `POST`

**Request body:**
```json
{
  "prompt": "smart casual outfit for a summer date under £200",
  "filters": {
    "budget_min": 0,
    "budget_max": 200,
    "gender": "mens"
  },
  "session_id": null
}
```

- `prompt` (required) — natural language styling request
- `filters.budget_min` / `budget_max` — price range in GBP
- `filters.gender` — `"mens"` | `"womens"` | `"unisex"`
- `session_id` (optional) — pass an existing session ID to add refinement outfits

**Pipeline:**
1. Create session (if `session_id` is null)
2. Embed prompt via OpenAI `text-embedding-3-small`
3. Vector search via `match_products` RPC (40 candidates)
4. Send candidates + prompt to GPT-4o → 4 outfit combinations
5. Validate product IDs (filter out hallucinated ones)
6. Save outfits + items to DB
7. Fetch full product data with joins
8. Return enriched response

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
            "images": ["https://..."],
            "colours": ["White"],
            "product_url": "https://..."
          },
          "role": "top"
        }
      ]
    }
  ]
}
```

### 7.2 `save-outfit`

**Purpose:** Save/unsave an outfit to the user's collection.

**Save — Method:** `POST`

```json
{ "outfit_id": "uuid" }
```

Response: `{ "saved": true }`

Upserts into `saved_outfits` with `(user_id, outfit_id)` unique constraint — safe to call multiple times.

**Unsave — Method:** `DELETE`

Query parameter: `?saved_id=uuid` (the `saved_outfits.id`, not the outfit ID)

Response: `{ "saved": false }`

### 7.3 `try-on`

**Purpose:** AI-powered virtual try-on. Places garments on an avatar using image generation. Supports two modes: **standard** (user-triggered, counts against limits) and **preview** (free, auto-generated after outfit creation).

**Method:** `POST`

**Request body:**
```json
{
  "model_image": "https://...avatar-url.png",
  "garments": [
    { "role": "top", "image": "https://...product.jpg", "name": "Linen Shirt" },
    { "role": "bottom", "image": "https://...product.jpg", "name": "Chinos" },
    { "role": "shoe", "image": "https://...product.jpg", "name": "Loafers" }
  ],
  "angle": null,
  "reference_image": null,
  "body_context": null,
  "preview": false,
  "outfit_id": null,
  "pose": null
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `model_image` | string (URL) | Yes | Avatar image URL (predefined or signed URL for custom) |
| `garments` | array | Yes (min 1) | Each has `role`, `image` (URL), `name` |
| `angle` | string | No | For re-generation: `front`, `back`, `left-side`, `right-side`, `three-quarter`, `close-up-top`, `close-up-bottom`. Ignored in preview mode. |
| `reference_image` | string | No | Base64 data URL of previous result (for angle consistency). Ignored in preview mode. |
| `body_context` | object | No | `{ height_cm, weight_kg, body_type, gender_presentation, skin_tone }` — sent when using custom avatar |
| `preview` | boolean | No | `true` = free preview mode (no limits, no usage counted). Requires `outfit_id`. |
| `outfit_id` | string | No | Required when `preview: true`. Validates outfit ownership via `outfit_sessions.user_id`. |
| `pose` | string | No | Pose instruction for preview variety. Only used when `preview: true`. See Preview Poses below. |

**Preview mode:**
- Skips all usage limit checks — previews are free
- Does not increment usage counters
- Validates outfit ownership (outfit must belong to the authenticated user)
- Forces front-facing angle (ignores `angle` and `reference_image`)
- After generating, **persists the image** to the `outfit-previews` storage bucket and saves the public URL to `outfits.preview_image`
- Returns the public storage URL instead of a data URL

**Preview poses:**

Each of the 4 outfits per generation gets a different static pose for visual variety. The client cycles through these by outfit index:

| Index | Pose |
|---|---|
| 0 | Standing straight, arms relaxed at sides, feet together |
| 1 | Arms crossed over chest, composed editorial stance |
| 2 | One hand on hip, weight shifted, confident |
| 3 | Both hands in pockets, relaxed slouch |

The pose is injected as a `CRITICAL` instruction in the AI prompt to override the avatar's default pose.

**AI provider strategy:**
1. Try **Gemini 2.5 Flash Image** first (cheaper, good quality)
2. Fall back to **OpenAI gpt-image-1** if Gemini fails (429, quota, etc.)

**Image quality settings:**
- All try-on generations (both preview and standard) use **1024×1024, low quality** on the OpenAI path
- This keeps costs at **$0.011 per image** on gpt-image-1
- Gemini has no explicit quality toggle — uses default settings

**Response:**
```json
{
  "output_url": "https://...supabase.co/storage/v1/object/public/outfit-previews/..."
}
```

For preview mode: returns a public storage URL (persisted).
For standard mode: returns a base64 data URL (`data:image/png;base64,...`).

**Preview persistence flow:**
1. Image generated → base64 result
2. Decode base64 → upload to `outfit-previews/{user_id}/{outfit_id}.png` (upsert)
3. Get public URL from storage
4. Update `outfits.preview_image` with the public URL
5. Return public URL to client

**Angle regeneration flow (standard mode):**
1. Initial try-on → returns result, client sets `activeAngle = "front"`
2. User clicks "Back" → client sends same garments + `angle: "back"` + `reference_image: <previous result>`
3. The prompt instructs the AI to keep the same outfit but change the viewing angle

### 7.4 `profile`

**Purpose:** User profile management — body details and custom avatar.

**GET — Fetch profile**

No body. Returns:
```json
{
  "custom_avatar_url": "https://...signed-url (1hr expiry)" | null,
  "height_cm": 170 | null,
  "weight_kg": 65 | null,
  "body_type": "athletic" | null,
  "gender_presentation": "male" | null,
  "skin_tone": "medium" | null,
  "hair_colour": "Brown" | null,
  "hair_length": "short" | null,
  "age_range": "25-34" | null
}
```

`custom_avatar_url` is resolved from a storage path to a signed URL on every GET.

**PATCH — Update body details**

```json
{
  "height_cm": 175,
  "body_type": "athletic",
  "skin_tone": "olive"
}
```

Only the 8 allowed fields are accepted; all others are silently ignored. Response: `{ "ok": true }`

**POST — Upload avatar photo**

Content-Type: `multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `avatar` | File | Image file, max 10MB |

The file is uploaded to `user-avatars/{user_id}/avatar.{ext}` with upsert (overwrites previous). The storage **path** is saved to `users.custom_avatar_url`. A signed URL is returned for immediate display.

Response: `{ "custom_avatar_url": "https://...signed-url" }`

**Plan gate:** POST (avatar upload) requires `pro` plan. Returns 403 `FEATURE_GATED` for lower plans.

### 7.5 `create-checkout-session`

**Purpose:** Create a Stripe Checkout session and return the URL.

**POST**
```json
{ "plan": "starter" | "pro", "interval": "monthly" | "yearly" }
```

Maps `plan + interval` to a Stripe Price ID (from env), creates a Stripe Checkout Session using the user's Stripe customer ID (creates one if needed), and returns `{ "url": "https://checkout.stripe.com/..." }`.

The client redirects to this URL. On completion, Stripe redirects to `/billing?success=true`.

### 7.6 `create-portal-session`

**Purpose:** Open the Stripe Customer Portal for managing billing.

**POST** (no body)

Returns `{ "url": "https://billing.stripe.com/..." }`. Requires an existing `stripe_customer_id` (i.e., must have subscribed at least once).

### 7.7 `get-usage`

**Purpose:** Return the user's plan, limits, and current usage for the billing UI.

**GET** (no body)

```json
{
  "plan": "starter",
  "status": "active",
  "billing_interval": "monthly",
  "current_period_end": "2026-06-25T...",
  "limits": { "generations": 50, "try_ons": 30, "saved_looks": 50, "try_on_angles": 3, "custom_avatar": false },
  "usage": { "generations": 12, "try_ons": 5, "saved_looks": 8 }
}
```

### 7.8 `stripe-webhook`

**Purpose:** Handle Stripe webhook events to sync subscription state.

**`verify_jwt: false`** — Stripe calls this directly, not the user. Signature is verified using `STRIPE_WEBHOOK_SECRET`.

Events handled:
- `checkout.session.completed` → Activate subscription, set plan + billing interval
- `invoice.paid` → Renew period dates, confirm active status
- `customer.subscription.updated` → Plan changes, status changes
- `customer.subscription.deleted` → Downgrade to free plan

### Plan Limits

| Feature | Free | Starter (£9/mo) | Pro (£19/mo) |
|---|---|---|---|
| Generations / month | 5 | 50 | 200 |
| Virtual try-ons / month | 0 | 30 | 100 |
| Saved looks | 10 | 50 | 500 |
| Try-on angles | 0 | 3 (front, back, left) | 7 (all angles) |
| Custom avatar upload | No | No | Yes |

### Limit Error Responses

All limit-exceeding requests return HTTP 403 with:
```json
{
  "error": "generations limit reached",
  "code": "LIMIT_EXCEEDED",
  "resource": "generations",
  "current": 5,
  "limit": 5,
  "plan": "free",
  "upgrade_url": "/billing"
}
```

Feature-gated requests return:
```json
{
  "error": "Virtual try-on is not available on the free plan",
  "code": "FEATURE_GATED",
  "feature": "Virtual try-on",
  "plan": "free",
  "upgrade_url": "/billing"
}
```

---

## 8. Predefined Avatars

12 3D-rendered avatars stored in the public `avatars` bucket. Diverse across gender, ethnicity, and body type.

| ID | Name | Gender | Description |
|---|---|---|---|
| f-1 | Amara | Female | Young Black woman, slim build |
| f-2 | Sofia | Female | Latina woman, mid-20s, medium build |
| f-3 | Mei | Female | East Asian woman, petite build |
| f-4 | Priya | Female | South Asian woman, curvy build |
| m-1 | James | Male | White man, athletic build, 30s |
| m-2 | Kwame | Male | Black man, tall, lean build |
| m-3 | Ravi | Male | South Asian man, medium build |
| m-4 | Kenji | Male | East Asian man, slim build, 20s |
| a-1 | River | Androgynous | Mixed-race, lean build |
| a-2 | Sam | Androgynous | White, medium build, 40s |
| a-3 | Jules | Androgynous | Black, athletic build |
| a-4 | Noor | Androgynous | Middle-Eastern, slim build |

**Image specs:** Full-body, front-facing, neutral pose, plain background, fitted base clothing, at least 768x1024px.

**URL pattern:** `{SUPABASE_URL}/storage/v1/object/public/avatars/{id}.png`

---

## 9. Web App Structure

### Route groups

| Group | Purpose |
|---|---|
| `(auth)` | Login, signup pages — redirect to `/generate` if authenticated |
| `(app)` | Main app — requires auth, has TopBar navigation |
| `(marketing)` | About, Contact, Privacy, Terms — public pages with shared header/footer layout |
| `/` | Landing page (public) |
| `/auth/callback` | Supabase auth callback handler |

### Pages

| Route | Component | Description |
|---|---|---|
| `/` | `app/page.tsx` | Landing page with editorial sections |
| `/login` | `app/(auth)/login/` | Email/password login |
| `/signup` | `app/(auth)/signup/` | Registration |
| `/generate` | `app/(app)/generate/page.tsx` | Main prompt input + outfit carousel |
| `/saved` | `app/(app)/saved/` | Saved outfits grid with unsave |
| `/history` | `app/(app)/history/` | Session history, expandable |
| `/profile` | `app/(app)/profile/` | Body details + avatar upload |
| `/billing` | `app/(app)/billing/page.tsx` | Plan, usage meters, upgrade, manage billing |
| `/about` | `app/(marketing)/about/` | About page |
| `/contact` | `app/(marketing)/contact/` | Contact page |
| `/privacy` | `app/(marketing)/privacy/` | Privacy policy |
| `/terms` | `app/(marketing)/terms/` | Terms of service |

### Key components

| Component | Purpose |
|---|---|
| `TopBar` | Navigation bar: Generate, Saved, History, Profile, Billing, Sign out |
| `PromptInput` | Text input for styling prompts |
| `FilterBar` | Budget slider, gender selector |
| `OutfitCarousel` | Horizontal scroll of outfit cards. Shows a "Styling" loading stage with rotating phrases and progress bar while previews generate. Only renders cards that have a `preview_image`. Cards appear progressively as previews arrive. |
| `OutfitCard` | Preview-first card: full-width try-on preview hero (2:3, `object-cover`), full-width "Tap to explore angles" bar, collapsed bottom bar (total price + Save + Details toggle), expandable details panel (AI reasoning, item list with Shop links). No product collages. |
| `TryOnModal` | Avatar selection (predefined + custom), garment picker, angle controls, result display |
| `ProfileForm` | Body details form + avatar upload with photo guidelines |
| `UpgradeBanner` | Inline upgrade prompt shown when a user hits a plan limit or feature gate |

### Design system

- **No rounded corners** — sharp, editorial aesthetic throughout
- **Tailwind custom tokens:** `near-black`, `ink`, `muted-slate`, `stone`, `canvas`, `hairline`, `coral`, `deep-green`
- **Typography:** `font-display` for headings, `font-mono` for labels
- **Layout:** Clean, generous whitespace, editorial magazine feel

---

## 10. User Flows

### 10.1 Generate outfit

```
User enters prompt → callEdgeFunction("generate", { prompt, filters })
  ↓
Edge function: embed → vector search → GPT-4o → save → return outfits
  ↓
Client shows "Styling" loading stage (rotating phrases, progress bar)
  ↓
Client fires 4 parallel callEdgeFunction("try-on", { preview: true, outfit_id, pose })
  each outfit gets a different pose (index 0–3)
  ↓
As each preview completes:
  → try-on endpoint uploads image to outfit-previews bucket
  → saves public URL to outfits.preview_image
  → returns public URL to client
  → client updates state, card appears in carousel
  ↓
User can refine (same session) or start new session
```

**Avatar resolution for previews (priority order):**
1. User's `custom_avatar_url` from profile (Pro plan)
2. Match by user's `gender_presentation` profile field → matching predefined avatar
3. Gender filter from request (`mens` → male avatar, `womens` → female, `unisex` → androgynous)
4. First avatar in AVATARS list

**Loading history sessions:**
- Query `outfits` with `select *` → `preview_image` comes from DB
- If `preview_image` is set → card shows immediately, no regeneration
- If `preview_image` is null (old outfits) → fire preview generation, result gets persisted for future loads

### 10.2 Save / unsave outfit

```
User clicks heart icon → callEdgeFunction("save-outfit", { outfit_id })
  ↓
User visits /saved → data loaded via Supabase client (direct DB read)
  ↓
User clicks X → callEdgeFunction("save-outfit", { method: "DELETE", saved_id })
```

### 10.3 Virtual try-on

```
User taps outfit card hero or "Tap to explore angles" bar → TryOnModal opens
  ↓
Modal loads profile (custom avatar + body context) via callEdgeFunction("profile")
  ↓
User selects avatar (predefined or "You" tab) + selects garments
  ↓
User clicks "Try On" → callEdgeFunction("try-on", { model_image, garments, body_context })
  ↓
Edge function: fetch images → build prompt → Gemini (→ OpenAI fallback) → return base64
  (all try-ons use 1024×1024 low quality on OpenAI path)
  ↓
Result displayed. Angle buttons appear.
  ↓
User clicks angle → callEdgeFunction("try-on", { ..., angle, reference_image })
```

### 10.4 Profile management

```
User visits /profile → server component fetches from DB + resolves avatar signed URL
  ↓
User edits fields → "Save Profile" → callEdgeFunction("profile", { method: "PATCH", body })
  ↓
User uploads photo → callEdgeFunction("profile", { method: "POST", formData })
  ↓
Signed URL returned → avatar preview updates immediately
```

### 10.5 Subscription & billing

```
Pricing page or /billing → user clicks plan
  ↓
callEdgeFunction("create-checkout-session", { body: { plan, interval } })
  ↓
Redirect to Stripe Checkout → user completes payment
  ↓
Stripe sends webhook → stripe-webhook edge function updates subscriptions table
  ↓
Redirect to /billing?success=true → user sees updated plan + usage meters
```

**Limit enforcement flow:**
```
User triggers generation/try-on/save
  ↓
Edge function checks subscription plan + usage counters
  ↓
If under limit → proceed, increment usage counter after success
If over limit → return 403 { code: "LIMIT_EXCEEDED" | "FEATURE_GATED" }
  ↓
Client shows UpgradeBanner with link to /billing
```

---

## 11. Native App Implementation Guide

### 11.1 Auth

Use the official Supabase SDK:
- **iOS:** [`supabase-swift`](https://github.com/supabase/supabase-swift)
- **Android:** [`supabase-kt`](https://github.com/supabase-community/supabase-kt)

Both SDKs handle token management, refresh, and persistence. Initialize with `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### 11.2 Calling edge functions

```swift
// iOS (Swift)
let response = try await supabase.functions.invoke(
  "generate",
  options: .init(body: [
    "prompt": "casual summer outfit",
    "filters": ["budget_max": 200, "gender": "mens"]
  ])
)
```

```kotlin
// Android (Kotlin)
val response = supabase.functions.invoke("generate") {
  body = buildJsonObject {
    put("prompt", "casual summer outfit")
    putJsonObject("filters") {
      put("budget_max", 200)
      put("gender", "mens")
    }
  }
}
```

The SDK automatically attaches the `Authorization: Bearer` header from the active session.

### 11.3 Direct DB reads

Some data is read directly from Supabase (not via edge functions):
- **Outfit sessions list** — `outfit_sessions` table, filtered by `user_id`
- **Session outfits** — `outfits` + `outfit_items` joined with `products`
- **Saved outfits** — `saved_outfits` joined with `outfits` → `outfit_items` → `products`

These use the standard Supabase client with RLS (Row Level Security). The anon key + user JWT provides access to rows the user owns.

### 11.4 File uploads

For avatar upload, use the Supabase Storage SDK or send a `multipart/form-data` POST to the `profile` edge function:

```
POST https://<project>.supabase.co/functions/v1/profile
Authorization: Bearer <token>
Content-Type: multipart/form-data

avatar: <image file>
```

### 11.5 Image handling

- **Product images:** Direct URLs from `products.images[]`. Public via `product-images` bucket.
- **Predefined avatars:** Direct URLs. Public via `avatars` bucket. Pattern: `{SUPABASE_URL}/storage/v1/object/public/avatars/{id}.png`
- **Custom avatar:** Signed URL returned by `profile` GET. Expires in 1 hour — re-fetch profile to get a fresh URL.
- **Outfit preview images:** Public URLs from `outfits.preview_image`. Stored in `outfit-previews` bucket. Pattern: `{SUPABASE_URL}/storage/v1/object/public/outfit-previews/{user_id}/{outfit_id}.png`. Persisted — load from DB on session reload, no regeneration needed.
- **Try-on results (standard):** Base64 data URLs (`data:image/png;base64,...`). Decode to display. These are ephemeral — only preview-mode results are persisted to storage.

### 11.6 Deep links

The `products` table has `deep_link_ios` and `deep_link_android` columns. When populated, use these to open the product in the retailer's native app. Fall back to `product_url` for web browser.

### 11.7 Offline considerations

- Cache product images and avatar images locally
- Try-on requires network (AI generation)
- Saved outfits can be cached locally and synced
- Profile data can be cached and synced on reconnect

---

## 12. Security Model

### Edge function auth

1. **JWT verification:** Supabase gateway rejects invalid/expired tokens before the function runs
2. **User extraction:** `_shared/auth.ts` calls `auth.getUser(token)` to get the verified user ID
3. **Service role isolation:** All privileged operations (DB writes, storage) use the service role client inside the edge function — never exposed to the client

### Row Level Security (RLS)

RLS is enabled on all tables. Key policies:
- Users can only read their own sessions, outfits, and saved items
- Users can only modify their own profile
- Products, brands, and categories are readable by all authenticated users

### Storage security

- `user-avatars` — private bucket with per-user folder policies
- `avatars`, `product-images` — public buckets (read-only, admin-managed)

### What the client never sees

- `SUPABASE_SERVICE_ROLE_KEY` — never sent to any client
- `OPENAI_API_KEY` / `GEMINI_API_KEY` — only in edge function secrets
- Raw product embeddings — only accessed server-side for vector search

---

## 13. Legacy / Unused Edge Functions

These three functions were from an earlier architecture where the pipeline was split across functions. They are still deployed but **not called by any client**:

| Function | Original purpose | Status |
|---|---|---|
| `prompt-parser` | Parse prompt → extract filters via GPT-4o-mini | Unused — consolidated into `generate` |
| `embed-and-search` | Embed filters → vector search | Unused — consolidated into `generate` |
| `outfit-generator` | Take candidates → GPT-4o → save outfits | Unused — consolidated into `generate` |

These can be deleted with `supabase functions delete <name>` when ready.

### Dead code in `lib/types.ts`

The `UserPreferences` interface is defined but never imported or used anywhere in the codebase. It can be removed during cleanup.

---

## 14. Allowed Values Reference

For native apps building form UIs:

| Field | Options |
|---|---|
| Body type | `slim`, `athletic`, `medium`, `curvy`, `plus` |
| Gender presentation | `female`, `male`, `androgynous` |
| Skin tone | `light`, `fair`, `medium`, `olive`, `brown`, `dark` |
| Hair length | `bald`, `short`, `medium`, `long` |
| Age range | `18-24`, `25-34`, `35-44`, `45-54`, `55+` |
| Hair colour | Free text |
| Outfit gender filter | `mens`, `womens`, `unisex` |
| Outfit item roles | `top`, `bottom`, `shoe`, `jacket`, `boots` |
| Try-on angles | `front`, `back`, `left-side`, `right-side`, `three-quarter`, `close-up-top`, `close-up-bottom` |

---

## 15. API Quick Reference

| Action | Function | Method | Key fields |
|---|---|---|---|
| Generate outfits | `generate` | POST | `prompt`, `filters`, `session_id?` |
| Save outfit | `save-outfit` | POST | `outfit_id` |
| Unsave outfit | `save-outfit` | DELETE | `?saved_id=uuid` |
| Try on (standard) | `try-on` | POST | `model_image`, `garments[]`, `angle?`, `reference_image?`, `body_context?` |
| Try on (preview) | `try-on` | POST | `model_image`, `garments[]`, `preview: true`, `outfit_id`, `pose?` |
| Get profile | `profile` | GET | — |
| Update profile | `profile` | PATCH | body detail fields |
| Upload avatar | `profile` | POST | `avatar` (multipart file) |
| Get usage | `get-usage` | GET | — |
| Start checkout | `create-checkout-session` | POST | `plan`, `interval` |
| Open billing portal | `create-portal-session` | POST | — |

### Cost per API call (OpenAI path)

| Call | Cost |
|---|---|
| Generate (embed + GPT-4o) | ~$0.03 |
| Try-on preview (1024×1024 low) | ~$0.011 |
| Try-on standard (1024×1024 low) | ~$0.011 |
| Full generation (incl. 4 previews) | ~$0.07 |
