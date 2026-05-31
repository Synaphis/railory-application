# Railory — Backend Reference

Complete API + schema reference for native client development. Read [SYSTEM.md](./SYSTEM.md) first for architectural context; this document is the deep technical reference.

**Audience:** AI agents and engineers building iOS, Android, or any non-web client against the Railory backend.

---

## 0. Project coordinates

```
SUPABASE_PROJECT_REF   = rkbljmsalughhsuspwoi
SUPABASE_URL           = https://rkbljmsalughhsuspwoi.supabase.co
EDGE_FUNCTIONS_URL     = https://rkbljmsalughhsuspwoi.supabase.co/functions/v1
WEB_APP_URL            = https://app.railory.io
MARKETING_URL          = https://railory.io
STRIPE_API_VERSION     = 2025-04-30.basil
```

Native apps embed only `SUPABASE_URL` + `SUPABASE_ANON_KEY` (both public-safe).

---

## 1. Authentication

### 1.1 SDK setup

**Swift (`supabase-swift`):**
```swift
import Supabase

let supabase = SupabaseClient(
  supabaseURL: URL(string: "https://rkbljmsalughhsuspwoi.supabase.co")!,
  supabaseKey: "<anon key>"
)
```

**Kotlin (`supabase-kt`):**
```kotlin
val supabase = createSupabaseClient(
  supabaseUrl = "https://rkbljmsalughhsuspwoi.supabase.co",
  supabaseKey = "<anon key>"
) {
  install(Auth)
  install(Postgrest)
  install(Functions)
  install(Storage)
}
```

### 1.2 Auth methods used by Railory

| Action | Swift call | Returns |
|---|---|---|
| Sign up | `try await supabase.auth.signUp(email: ..., password: ...)` | `AuthResponse` with session if email-confirmation disabled, else null session |
| Sign in | `try await supabase.auth.signIn(email: ..., password: ...)` | `Session` |
| Sign out | `try await supabase.auth.signOut()` | void |
| Reset password (send email) | `try await supabase.auth.resetPasswordForEmail("...")` | void |
| Set new password (after recovery link) | `try await supabase.auth.update(user: .init(password: "..."))` | `User` |
| Change email | `try await supabase.auth.update(user: .init(email: "newaddr"))` | sends confirmation to NEW email |
| Refresh session | SDK does it automatically | — |
| Get current user | `try await supabase.auth.user` | `User?` |
| Listen to auth changes | `supabase.auth.authStateChanges` (AsyncStream) | events: `signedIn`, `signedOut`, `tokenRefreshed`, `userUpdated`, `passwordRecovery` |

### 1.3 JWT contents

After sign-in, the `session.accessToken` is a JWT with:

```jsonc
{
  "aud": "authenticated",
  "exp": 1748742000,          // 1-hour expiry
  "sub": "uuid-of-user",      // ← user_id (matches public.users.id)
  "email": "user@example.com",
  "role": "authenticated",
  "session_id": "...",
  "user_metadata": { "full_name": "..." }
}
```

Every edge function call must include `Authorization: Bearer <access_token>`. The SDK attaches this automatically when using `supabase.functions.invoke(...)` or `supabase.from(...).select()`.

### 1.4 Email confirmation flow

1. User signs up → Supabase sends `Confirm signup` email
2. User clicks link → lands at `https://app.railory.io/auth/callback?code=...`
3. Web app exchanges code for session
4. **Native app equivalent**: use a custom URL scheme (e.g. `railory://auth-callback`) configured in Supabase auth → deep link the user back into the app → call `supabase.auth.exchangeCodeForSession(code)`

Configure additional redirect URLs in Supabase: `Authentication → URL Configuration → Redirect URLs`. Add `railory://auth-callback` (or your chosen scheme) when you ship native apps.

### 1.5 Password reset flow (native)

1. User taps "Forgot password?" → enter email → `supabase.auth.resetPasswordForEmail(email, redirectTo: "railory://reset-password")`
2. User clicks link in email → deep links to your app's reset-password screen
3. Screen detects `authStateChanges` emits `.passwordRecovery` → reveal "new password" form
4. On submit: `try await supabase.auth.update(user: .init(password: newPassword))`

---

## 2. Database tables — exact schemas

### 2.1 `public.users`

Application-level user. Created via DB trigger on `auth.users` INSERT.

| Column                 | Type        | Nullable | Default       | Notes |
|------------------------|-------------|----------|---------------|-------|
| `id`                   | uuid        | NO       | —             | PK, FK → `auth.users.id` |
| `email`                | text        | NO       | —             | Mirrored from auth |
| `full_name`            | text        | YES      | NULL          | |
| `avatar_url`           | text        | YES      | NULL          | Legacy; unused |
| `custom_avatar_url`    | text        | YES      | NULL          | Storage **path** in `user-avatars` bucket (not URL) — resolve via `profile` edge fn |
| `height_cm`            | integer     | YES      | NULL          | |
| `weight_kg`            | integer     | YES      | NULL          | |
| `body_type`            | text        | YES      | NULL          | `slim` `athletic` `medium` `curvy` `plus` |
| `gender_presentation`  | text        | YES      | NULL          | `female` `male` `androgynous` |
| `skin_tone`            | text        | YES      | NULL          | `light` `fair` `medium` `olive` `brown` `dark` |
| `hair_colour`          | text        | YES      | NULL          | Free text |
| `hair_length`          | text        | YES      | NULL          | `bald` `short` `medium` `long` |
| `age_range`            | text        | YES      | NULL          | `18-24` `25-34` `35-44` `45-54` `55+` |
| `country`              | text        | YES      | NULL          | ISO 3166-1 alpha-2 (`US`, `GB`, `PK`, ...) |
| `preferred_currency`   | text        | YES      | NULL          | ISO 4217 (`USD`, `GBP`, ...) |
| `created_at`           | timestamptz | NO       | `now()`       | |

**TypeScript type:**
```ts
interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_type: string | null;
  gender_presentation: string | null;
  skin_tone: string | null;
  hair_colour: string | null;
  hair_length: string | null;
  age_range: string | null;
  country: string | null;
  preferred_currency: string | null;
  created_at: string;
}
```

**RLS:** User reads/writes own row only. `auth.uid() = id`.

### 2.2 `public.brands`

Brand catalog.

| Column          | Type        | Notes |
|-----------------|-------------|-------|
| `id`            | uuid (PK)   | |
| `name`          | text        | e.g. `"Zara"` |
| `slug`          | text        | URL-safe identifier |
| `base_url`      | text        | Brand website |
| `logo_url`      | text        | |
| `price_tier`    | text        | |
| `has_api`       | boolean     | |
| `affiliate_base`| text        | |
| `scrape_config` | jsonb       | |
| `is_active`     | boolean     | |
| `created_at`    | timestamptz | |

**RLS:** Read-only for all authenticated users.

### 2.3 `public.categories`

| Column            | Type    | Notes |
|-------------------|---------|-------|
| `id`              | uuid (PK) | |
| `name`            | text    | e.g. `"Tops"` |
| `parent_category` | text    | |
| `display_order`   | integer | |

**RLS:** Read-only for all authenticated users.

### 2.4 `public.products`

Product catalog with vector embeddings for semantic search. **Read-only for clients.**

| Column                 | Type            | Notes |
|------------------------|-----------------|-------|
| `id`                   | uuid (PK)       | |
| `source`               | text            | Where scraped from |
| `brand_id`             | uuid (FK)       | → `brands.id` |
| `category_id`          | uuid (FK)       | → `categories.id` |
| `external_id`          | text            | Source's product ID |
| `parent_product_id`    | uuid            | For colour variants |
| `name`                 | text            | |
| `subcategory`          | text            | |
| `description`          | text            | |
| `tagline`              | text            | |
| `collection_name`      | text            | |
| `collection_season`    | text            | |
| `is_new_arrival`       | boolean         | |
| `price`                | numeric         | |
| `original_price`       | numeric         | Pre-sale |
| `currency`             | text            | ISO 4217 |
| `is_on_sale`           | boolean         | |
| `discount_percent`     | numeric         | |
| `colours`              | text[]          | |
| `colour_codes`         | text[]          | Hex |
| `sizes_available`      | text[]          | |
| `size_system`          | text            | |
| `fit`                  | text            | `regular` `slim` `oversized` |
| `dimensions`           | jsonb           | |
| `weight_grams`         | integer         | |
| `materials`            | text[]          | |
| `care_instructions`    | text[]          | |
| `country_of_origin`    | text            | |
| `style_tags`           | text[]          | `casual` `streetwear` etc. |
| `occasion_tags`        | text[]          | `date-night` `work` etc. |
| `season_tags`          | text[]          | |
| `aesthetic_tags`       | text[]          | `minimalist` `editorial` etc. |
| `gender`               | text            | `mens` `womens` `unisex` |
| `images`               | text[]          | Public URLs |
| `source_image_urls`    | text[]          | Original source |
| `variants`             | jsonb           | |
| `shipping_info`        | jsonb           | |
| `stock_status`         | jsonb           | |
| `rating`               | numeric         | |
| `review_count`         | integer         | |
| `rating_breakdown`     | jsonb           | |
| `product_url`          | text            | Web link |
| `affiliate_url`        | text            | |
| `deep_link_ios`        | text            | iOS app deep link (may be null) |
| `deep_link_android`    | text            | Android app deep link (may be null) |
| `styled_with`          | text[]          | Related product IDs |
| `sustainability_info`  | jsonb           | |
| `search_keywords`      | text[]          | |
| `raw_scraped_text`     | text            | |
| `raw_product`          | jsonb           | Full raw payload |
| `scrape_confidence`    | numeric         | |
| `combined_text`        | text            | Searchable concatenation |
| `embedding`            | vector(1536)    | OpenAI `text-embedding-3-small` |
| `vector_timestamp`     | timestamptz     | |
| `scraped_at`           | timestamptz     | |
| `last_updated`         | timestamptz     | |
| `is_active`            | boolean         | |
| `jewellery_metal`      | text            | |
| `jewellery_stone`      | text            | |

**Native apps don't query this table directly** — they receive `ProductCandidate` shape from the `generate` edge function (see § 6.1).

### 2.5 `public.outfit_sessions`

| Column           | Type        | Notes |
|------------------|-------------|-------|
| `id`             | uuid (PK)   | |
| `user_id`        | uuid (FK)   | → `users.id` |
| `initial_prompt` | text        | |
| `filters`        | jsonb       | Stored `GenerateFilters` object (see § 6.1) |
| `created_at`     | timestamptz | |

**RLS:** User reads own sessions only.

### 2.6 `public.outfits`

| Column          | Type        | Notes |
|-----------------|-------------|-------|
| `id`            | uuid (PK)   | |
| `session_id`    | uuid (FK)   | → `outfit_sessions.id` |
| `prompt_used`   | text        | May differ from session's prompt for refinements |
| `ai_reasoning`  | text        | GPT-4o styling rationale |
| `total_price`   | numeric     | |
| `preview_image` | text        | Public URL in `outfit-previews` bucket. NULL until preview generates. **Persisted across sessions** |
| `created_at`    | timestamptz | |

**RLS:** User reads outfits belonging to their own sessions (via JOIN).

### 2.7 `public.outfit_items`

| Column       | Type      | Notes |
|--------------|-----------|-------|
| `id`         | uuid (PK) | |
| `outfit_id`  | uuid (FK) | → `outfits.id` |
| `product_id` | uuid (FK) | → `products.id` |
| `role`       | text      | `top` `bottom` `shoe` `jacket` `boots` |

### 2.8 `public.saved_outfits`

| Column      | Type        | Notes |
|-------------|-------------|-------|
| `id`        | uuid (PK)   | |
| `user_id`   | uuid (FK)   | |
| `outfit_id` | uuid (FK)   | |
| `notes`     | text        | Optional, unused in v1 UI |
| `saved_at`  | timestamptz | |

**Constraint:** `UNIQUE (user_id, outfit_id)` — saves are idempotent.

**RLS:** User reads/writes own only.

### 2.9 `public.subscriptions`

| Column                   | Type             | Notes |
|--------------------------|------------------|-------|
| `id`                     | uuid (PK)        | |
| `user_id`                | uuid (FK, UNIQUE)| One sub per user |
| `plan`                   | text             | `free` `starter` `pro` |
| `billing_interval`       | text             | `monthly` `yearly` NULL |
| `status`                 | text             | `active` `past_due` `canceled` `trialing` |
| `stripe_customer_id`     | text (UNIQUE)    | |
| `stripe_subscription_id` | text (UNIQUE)    | |
| `current_period_start`   | timestamptz      | From `subscription.items.data[0]` (Stripe API ≥2025-04-30) |
| `current_period_end`     | timestamptz      | |
| `created_at`             | timestamptz      | |
| `updated_at`             | timestamptz      | |

**Grace period:** if `current_period_end + 3 days < now()`, user is treated as `free` even if `status='active'` (defends against delayed webhooks).

**RLS:** User reads own only. Writes are via service-role (webhook).

### 2.10 `public.usage`

Per-period usage counters.

| Column         | Type        | Notes |
|----------------|-------------|-------|
| `id`           | uuid (PK)   | |
| `user_id`      | uuid (FK)   | |
| `period`       | text        | `YYYY-MM-01` for free users / `YYYY-MM-DD` for paid users |
| `generations`  | int         | |
| `try_ons`      | int         | |
| `saved_looks`  | int         | Legacy field; actual count = `SELECT COUNT(*) FROM saved_outfits WHERE user_id=...` |
| `created_at`   | timestamptz | |
| `updated_at`   | timestamptz | |

**Constraint:** `UNIQUE (user_id, period)`.

**Period key model:**

```ts
function currentPeriod(sub: Subscription | null): string {
  if (!sub || sub.plan === "free" || !sub.current_period_start) {
    // Free users: first of calendar month UTC
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-01`;
  }
  // Paid users: monthly anniversary of current_period_start (anchored,
  // walks forward one month at a time)
  return monthlyAnchor(new Date(sub.current_period_start), new Date())
    .toISOString().slice(0, 10);
}
```

For yearly subs: even though Stripe renews once a year, the period key rotates **monthly** within that yearly cycle. So "200 generations / month" applies properly to yearly subscribers too.

---

## 3. RPCs (database functions)

### 3.1 `public.check_and_increment_usage`

Atomic limit check + increment in one row-locked SQL call. Used by `generate` and `try-on` edge functions.

```sql
check_and_increment_usage(
  p_user_id uuid,
  p_period  text,
  p_field   text,         -- 'generations' or 'try_ons'
  p_limit   int
) RETURNS TABLE(allowed bool, new_count int)
```

Returns `(true, newCount)` if incremented within limit, `(false, currentCount)` if at/over limit (no increment performed). Holds `SELECT FOR UPDATE` for the duration — concurrent callers serialize.

### 3.2 `public.increment_usage`

Simple atomic upsert (used for rollback after AI call failure).

```sql
increment_usage(
  p_user_id uuid,
  p_period  text,
  p_field   text,
  p_amount  int DEFAULT 1   -- pass -1 to roll back
) RETURNS void
```

### 3.3 `public.match_products`

Vector similarity search. Internal to `generate`. Not called by clients.

```sql
match_products(
  query_vector  vector(1536),
  match_count   integer,
  price_max     numeric,
  price_min     numeric,
  gender_filter text
) RETURNS SETOF record
```

---

## 4. Storage buckets

| Bucket             | Public | Path pattern                              | Notes |
|--------------------|--------|-------------------------------------------|-------|
| `avatars`          | ✅      | `{id}.png` (e.g. `f-1.png`)               | 12 predefined avatars |
| `user-avatars`     | ❌      | `{user_id}/avatar.{ext}`                  | Private, signed-URL access via `profile` fn |
| `product-images`   | ✅      | varies                                    | Product catalog images |
| `outfit-previews`  | ✅      | `{user_id}/{outfit_id}.png`               | Persisted try-on previews |
| `generated-outfits`| ❌      | (reserved)                                | Future use |
| `brand`            | ✅      | `railory_logo_black.png`, etc.             | Brand assets for email templates |

### Public URL pattern

```
https://rkbljmsalughhsuspwoi.supabase.co/storage/v1/object/public/{bucket}/{path}
```

**Examples:**
```
Predefined avatar:    .../public/avatars/f-1.png
Outfit preview:       .../public/outfit-previews/{user_id}/{outfit_id}.png
Brand logo:           .../public/brand/railory_logo_black.png
```

### `user-avatars` (private) RLS

```sql
-- Read/write own folder only
bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text
```

Clients access via:
- **Direct upload (Pro plan):** native SDK to `user-avatars/{user_id}/avatar.{ext}`. The `profile` edge fn signs a URL on the next GET.
- **Read:** call `profile` (GET) → returns a 1-hour signed URL in `custom_avatar_url`.

### 12 predefined avatars

| ID    | Name   | Gender      | Description |
|-------|--------|-------------|-------------|
| `f-1` | Amara  | Female      | Young Black woman, slim |
| `f-2` | Sofia  | Female      | Latina, mid-20s, medium |
| `f-3` | Mei    | Female      | East Asian, petite |
| `f-4` | Priya  | Female      | South Asian, curvy |
| `m-1` | James  | Male        | White, athletic, 30s |
| `m-2` | Kwame  | Male        | Black, tall, lean |
| `m-3` | Ravi   | Male        | South Asian, medium |
| `m-4` | Kenji  | Male        | East Asian, slim, 20s |
| `a-1` | River  | Androgynous | Mixed-race, lean |
| `a-2` | Sam    | Androgynous | White, medium, 40s |
| `a-3` | Jules  | Androgynous | Black, athletic |
| `a-4` | Noor   | Androgynous | Middle-Eastern, slim |

---

## 5. Edge function URLs

All at `https://rkbljmsalughhsuspwoi.supabase.co/functions/v1/{name}`:

| Function                  | Method | Auth required | Purpose |
|---------------------------|--------|---------------|---------|
| `generate`                | POST   | ✅            | Full outfit generation pipeline |
| `save-outfit`             | POST   | ✅            | Save an outfit |
| `save-outfit`             | DELETE | ✅            | Unsave an outfit |
| `try-on`                  | POST   | ✅            | Virtual try-on (standard or preview mode) |
| `profile`                 | GET    | ✅            | Fetch profile + signed avatar URL |
| `profile`                 | PATCH  | ✅            | Update body details / location |
| `profile`                 | POST   | ✅            | Upload custom avatar (Pro only) |
| `get-usage`               | GET    | ✅            | Plan, limits, current usage |
| `create-checkout-session` | POST   | ✅            | Returns Stripe Checkout URL |
| `create-portal-session`   | POST   | ✅            | Returns Stripe Customer Portal URL |
| `stripe-webhook`          | POST   | ❌ (signature-verified) | Receives Stripe events |

---

## 6. Edge function details (request / response)

### 6.1 `generate` — POST

Full outfit generation. Atomic limit check at start, rollback on failure.

**Request body:**
```ts
interface GenerateRequest {
  prompt: string;
  filters: {
    budget_min: number;        // in user's preferred currency
    budget_max: number;
    gender: "mens" | "womens" | "unisex";
    brands: string[];          // brand UUIDs to filter to (empty = all)
    body_type?: string | null;
    age_range?: string | null;
    occasion?: string | null;
    season?: string | null;
    preferred_currency?: string;
  };
  session_id?: string | null;  // null = new session; UUID = refinement
}
```

**Sample request JSON:**
```json
{
  "prompt": "smart casual outfit for a wine bar, under $200",
  "filters": {
    "budget_min": 0,
    "budget_max": 200,
    "gender": "mens",
    "brands": [],
    "preferred_currency": "USD"
  },
  "session_id": null
}
```

**Response body (200):**
```ts
interface GenerateResponse {
  session_id: string;
  outfits: OutfitWithItems[];
}

interface OutfitWithItems {
  id: string;
  session_id: string;
  prompt_used: string;
  ai_reasoning: string | null;
  total_price: number | null;
  preview_image: string | null;   // populated async after preview gen
  created_at: string;
  items: {
    product: ProductCandidate;
    role: string;                 // "top" | "bottom" | "shoe" | "jacket" | "boots"
  }[];
}

interface ProductCandidate {
  id: string;
  name: string;
  brand_name: string;
  category_name: string;
  subcategory: string | null;
  description: string | null;
  price: number;                  // in user's preferred currency
  currency: string;
  original_price: number;
  original_currency: string;
  colours: string[];
  images: string[];
  style_tags: string[];
  occasion_tags: string[];
  aesthetic_tags: string[];
  fit: string | null;
  product_url: string | null;
  similarity: number;             // 0..1 cosine similarity score
}
```

**Errors:**

| Status | Code              | Body |
|--------|-------------------|------|
| 401    | —                 | `{ "error": "Unauthorized" }` |
| 403    | `LIMIT_EXCEEDED`  | `{ "error": "generations limit reached", "code": "LIMIT_EXCEEDED", "resource": "generations", "current": 5, "limit": 5, "plan": "free", "upgrade_url": "/billing" }` |
| 429    | —                 | `{ "error": "Too many requests" }` |
| 400    | —                 | `{ "error": "Prompt too long" }` (max 1000 chars) |
| 500    | —                 | `{ "error": "<message>" }` |

**Side effects:**
- `usage.generations` ++
- Creates `outfit_sessions` row (or appends to existing)
- Creates 4 `outfits` rows + their `outfit_items`
- After return: web client triggers 4 parallel `try-on` calls in preview mode to populate `outfits.preview_image`

### 6.2 `save-outfit` — POST / DELETE

**POST — Save:**
```ts
// Request
{ outfit_id: string }
// Response
{ saved: true }
```

**DELETE — Unsave:**
```
DELETE /functions/v1/save-outfit?saved_id={uuid}
```
The `saved_id` is the `saved_outfits.id`, NOT the outfit ID.

**Response:** `{ "saved": false }`

**Errors:** 403 `LIMIT_EXCEEDED` on save if at `saved_looks` cap.

### 6.3 `try-on` — POST

Virtual try-on. Two modes selected by `preview` field.

**Request:**
```ts
interface TryOnRequest {
  model_image: string;            // URL — predefined avatar public URL or signed URL for custom
  garments: Array<{
    role: string;
    image: string;
    name: string;
  }>;
  angle?: TryOnAngle | null;
  reference_image?: string | null; // Base64 data URL of previous result for angle consistency
  body_context?: {
    height_cm: number | null;
    weight_kg: number | null;
    body_type: string | null;
    gender_presentation: string | null;
    skin_tone: string | null;
  } | null;
  preview?: boolean;              // true = free preview mode, requires outfit_id
  outfit_id?: string | null;
  pose?: string | null;           // preview mode only
}

type TryOnAngle =
  | "front" | "back" | "left-side" | "right-side"
  | "three-quarter" | "close-up-top" | "close-up-bottom";
```

**Mode 1 — Standard (counts against `try_ons` limit):**

```jsonc
{
  "model_image": "https://...avatar.png",
  "garments": [
    { "role": "top",    "image": "https://...", "name": "Linen Shirt" },
    { "role": "bottom", "image": "https://...", "name": "Chinos" },
    { "role": "shoe",   "image": "https://...", "name": "Loafers" }
  ],
  "angle": "front",
  "body_context": { "height_cm": 175, "body_type": "athletic", ... }
}
```

Response: `{ "output_url": "data:image/png;base64,..." }`

**Mode 2 — Preview (free, persists to bucket):**

```jsonc
{
  "model_image": "https://...avatar.png",
  "garments": [ ... ],
  "preview": true,
  "outfit_id": "<uuid>",
  "pose": "Arms crossed over chest, composed editorial stance"
}
```

Response: `{ "output_url": "https://...storage/.../outfit-previews/{user_id}/{outfit_id}.png" }`

Also writes the URL to `outfits.preview_image` so future loads don't regenerate.

**Errors:**

| Status | Code              | Body |
|--------|-------------------|------|
| 403    | `LIMIT_EXCEEDED`  | At try-on cap |
| 403    | `FEATURE_GATED`   | Free users (try_ons=0) |
| 400    | —                 | Invalid `outfit_id` (preview mode) — must own the outfit |
| 500    | —                 | All AI providers failed |

**Plan-based angle restriction:**
- Free: no try-on at all (FEATURE_GATED)
- Starter: 3 angles allowed (`front`, `back`, `left-side`)
- Pro: all 7 angles

**Cost (server-side):** ~$0.002 (Gemini) or ~$0.011 (OpenAI fallback). Always 1024×1024 low quality.

### 6.4 `profile`

**GET — Fetch profile:**

Response:
```ts
interface ProfileResponse {
  full_name: string | null;
  email: string;
  custom_avatar_url: string | null;  // 1-hour signed URL
  height_cm: number | null;
  weight_kg: number | null;
  body_type: string | null;
  gender_presentation: string | null;
  skin_tone: string | null;
  hair_colour: string | null;
  hair_length: string | null;
  age_range: string | null;
  country: string | null;
  preferred_currency: string | null;
}
```

**PATCH — Update body details:**

Request:
```ts
{
  full_name?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  body_type?: string | null;
  gender_presentation?: string | null;
  skin_tone?: string | null;
  hair_colour?: string | null;
  hair_length?: string | null;
  age_range?: string | null;
  country?: string | null;
  preferred_currency?: string | null;
}
```

Response: `{ "ok": true }`. Unrecognized fields are silently ignored.

**POST — Upload custom avatar:**

Multipart form with `avatar` (image, max 10MB).

Response: `{ "custom_avatar_url": "https://...signed-url" }`

**Plan gate:** POST requires `pro`. Returns 403 `FEATURE_GATED` for free/starter.

### 6.5 `create-checkout-session` — POST

```ts
// Request
{ plan: "starter" | "pro", interval: "monthly" | "yearly" }
// Response
{ url: "https://checkout.stripe.com/..." }
```

Resolves `plan + interval` → Stripe Price ID (from env), reuses existing Stripe Customer (or creates one with email-dedup), opens a Checkout Session. Native apps redirect to this URL in a `SFSafariViewController` (iOS) / `Custom Tabs` (Android).

After successful checkout, Stripe redirects to `${APP_URL}/billing?success=true` — for native apps, configure a Universal Link / App Link to intercept this URL and route back into your app.

### 6.6 `create-portal-session` — POST

No body. Returns `{ "url": "https://billing.stripe.com/..." }`. Requires the user already to have a `stripe_customer_id`. Use the same Safari/Custom-Tabs pattern.

### 6.7 `get-usage` — GET

```ts
interface UsageResponse {
  plan: "free" | "starter" | "pro";
  status: "active" | "past_due" | "canceled" | "trialing";
  billing_interval: "monthly" | "yearly" | null;
  current_period_end: string | null;   // ISO timestamp
  limits: {
    generations: number;
    try_ons: number;
    saved_looks: number;
    try_on_angles: number;
    custom_avatar: boolean;
  };
  usage: {
    generations: number;
    try_ons: number;
    saved_looks: number;
  };
}
```

Call this on app launch + after every generation/try-on/save to keep the UI counter accurate. Could also be reactive via Realtime subscription to `usage` table (see § 9).

### 6.8 `stripe-webhook` — POST

Not called by clients. Receives Stripe events. Handles:
- `checkout.session.completed` → upsert `subscriptions` with plan + period dates
- `invoice.paid` → renew period dates
- `customer.subscription.updated` → plan/status change
- `customer.subscription.deleted` → downgrade to free

---

## 7. Plan limits matrix

| Feature                | Free | Starter ($9.99/mo, $95/yr) | Pro ($24.99/mo, $239/yr) |
|------------------------|------|-----------------------------|---------------------------|
| Generations / month    | 5    | 50                          | 200                       |
| Virtual try-ons / month| 0    | 30                          | 100                       |
| Saved looks (total)    | 10   | 50                          | 500                       |
| Try-on angles          | 0    | 3                           | 7                         |
| Custom avatar upload   | ❌   | ❌                           | ✅                         |
| Yearly discount        | —    | 20%                         | 20%                       |

---

## 8. Direct DB query patterns (for native clients)

These tables are queryable directly via `supabase.from(...)` — bypassing edge functions where appropriate. RLS enforces user scope.

### 8.1 List user's outfit sessions

**Swift:**
```swift
let sessions: [OutfitSession] = try await supabase
  .from("outfit_sessions")
  .select()
  .order("created_at", ascending: false)
  .limit(20)
  .execute()
  .value
```

### 8.2 Load a session's outfits with full product data

**Swift:**
```swift
let outfits: [OutfitFull] = try await supabase
  .from("outfits")
  .select("""
    id, prompt_used, ai_reasoning, total_price, preview_image, created_at,
    outfit_items (
      role,
      products ( id, name, price, currency, images, colours,
                 style_tags, occasion_tags, aesthetic_tags, product_url,
                 deep_link_ios, brands(name), categories(name) )
    )
  """)
  .eq("session_id", sessionId)
  .order("created_at", ascending: true)
  .execute()
  .value
```

### 8.3 List saved outfits

**Swift:**
```swift
let saved: [SavedOutfitFull] = try await supabase
  .from("saved_outfits")
  .select("""
    id, saved_at,
    outfits (
      id, prompt_used, ai_reasoning, total_price, preview_image,
      outfit_items ( role, products ( id, name, price, images, ... ) )
    )
  """)
  .order("saved_at", ascending: false)
  .execute()
  .value
```

### 8.4 Check current usage (alternative to /get-usage)

**Swift:**
```swift
let usage: [Usage] = try await supabase
  .from("usage")
  .select()
  .eq("period", currentPeriodKey)  // compute via getCurrentPeriod()
  .limit(1)
  .execute()
  .value
```

But prefer `get-usage` edge fn — it already does the period math + applies plan-based limits.

---

## 9. Realtime (optional)

Supabase Realtime supports row-level change subscriptions. Useful for:

- **Usage counter**: subscribe to `usage` table filtered by `user_id` → UI counter auto-updates without polling.
- **Preview images**: subscribe to `outfits` table → as `preview_image` populates async, cards animate in.

**Swift:**
```swift
let channel = supabase.channel("usage-updates")
channel.onPostgresChange(
  AnyAction.self,
  schema: "public",
  table: "usage",
  filter: "user_id=eq.\(userId)"
) { change in
  // update local state
}
try await channel.subscribe()
```

Don't forget to clean up channels on screen-leave.

---

## 10. Stripe webhook event shapes (for reference only)

Native apps don't process webhooks — only Stripe → our backend. Listed for completeness.

### `checkout.session.completed`

```jsonc
{
  "id": "evt_...",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_...",
      "customer": "cus_...",
      "subscription": "sub_...",
      "metadata": { "supabase_user_id": "uuid" },
      "mode": "subscription",
      "payment_status": "paid",
      ...
    }
  }
}
```

### `customer.subscription.updated`

```jsonc
{
  "data": {
    "object": {
      "id": "sub_...",
      "customer": "cus_...",
      "status": "active",
      "items": {
        "data": [{
          "id": "si_...",
          "price": { "id": "price_...", "recurring": { "interval": "year" } },
          "current_period_start": 1748742000,    // Unix timestamp (seconds)
          "current_period_end": 1780278000
        }]
      },
      "metadata": { "supabase_user_id": "uuid" }
    }
  }
}
```

⚠️ Note `current_period_start`/`end` moved from top-level Subscription into `items.data[0]` in Stripe API ≥2025-04-30. The webhook handles this.

### `customer.subscription.deleted`

Same shape as `.updated`. Triggers DB row reset to `plan='free', status='canceled'`.

---

## 11. Allowed values reference

For form dropdowns / pickers.

| Field                | Allowed values |
|----------------------|----------------|
| `body_type`          | `slim` `athletic` `medium` `curvy` `plus` |
| `gender_presentation`| `female` `male` `androgynous` |
| `skin_tone`          | `light` `fair` `medium` `olive` `brown` `dark` |
| `hair_length`        | `bald` `short` `medium` `long` |
| `age_range`          | `18-24` `25-34` `35-44` `45-54` `55+` |
| `gender` (generate)  | `mens` `womens` `unisex` |
| Outfit item `role`   | `top` `bottom` `shoe` `jacket` `boots` |
| Try-on `angle`       | `front` `back` `left-side` `right-side` `three-quarter` `close-up-top` `close-up-bottom` |
| `country`            | ISO 3166-1 alpha-2 — currently used: `US` `GB` `PK` `AE` `SA` `IN` `DE` `FR` `CA` `AU` `TR` |
| `preferred_currency` | ISO 4217 — `USD` `GBP` `EUR` `PKR` `AED` `SAR` `INR` `CAD` `AUD` `TRY` |
| Plan                 | `free` `starter` `pro` |
| Billing interval     | `monthly` `yearly` |

---

## 12. Error response catalog

All edge function errors return JSON with `error` field. Specific codes:

| Code             | HTTP | When |
|------------------|------|------|
| (none)           | 401  | Missing / invalid / expired JWT |
| (none)           | 429  | Rate limit exceeded (per-function, per-user) |
| (none)           | 400  | Invalid input (e.g. prompt too long, malformed body) |
| `LIMIT_EXCEEDED` | 403  | Plan's monthly cap reached for the requested action |
| `FEATURE_GATED`  | 403  | Action requires a higher plan (e.g. custom avatar on free) |
| (none)           | 500  | Server-side failure (AI provider error, etc.) |

**Standard error body:**
```ts
interface ErrorResponse {
  error: string;
  code?: "LIMIT_EXCEEDED" | "FEATURE_GATED";
  // LIMIT_EXCEEDED extras:
  resource?: "generations" | "try_ons" | "saved_looks";
  current?: number;
  limit?: number;
  // both 403 codes share:
  plan?: string;
  upgrade_url?: string;
  // FEATURE_GATED extras:
  feature?: string;
}
```

---

## 13. Native app architectural notes

### 13.1 Deep linking

Configure these intercepts:

| URL pattern                                    | Action |
|------------------------------------------------|--------|
| `https://app.railory.io/billing?success=true`  | Show "Subscription activated" success state, refresh usage |
| `https://app.railory.io/billing?canceled=true` | Show "Checkout canceled" toast, no state change |
| `railory://auth-callback?code=...`             | Exchange code for session, route to home |
| `railory://reset-password?...`                 | Show new-password form |

### 13.2 Session persistence

Both `supabase-swift` and `supabase-kt` persist sessions to secure storage (Keychain / EncryptedSharedPreferences) automatically. On app launch:

```swift
// Swift
if let session = try await supabase.auth.session { /* logged in */ }
```

Tokens refresh automatically when used.

### 13.3 Image strategy

| Source                       | Cache policy            | URL stability |
|------------------------------|-------------------------|---------------|
| `products.images[]`          | Forever                 | Stable        |
| `outfits.preview_image`      | Forever                 | Stable        |
| Predefined avatar            | Forever                 | Stable        |
| Custom avatar (`/profile`)   | 1 hour, then re-fetch   | Signed URL    |
| Try-on standard result       | Don't cache; ephemeral  | Base64 data URL |
| Brand assets (`/brand/...`)  | Forever                 | Stable        |

Use a library like `Kingfisher` (Swift) or `Coil` (Kotlin) with disk cache enabled.

### 13.4 Offline behavior

| Feature              | Offline-capable | Strategy |
|----------------------|-----------------|----------|
| View saved outfits   | ✅              | Cache outfits + product data |
| View profile         | ✅              | Cache last fetch |
| View usage           | ⚠️ stale        | Cache + show stale indicator |
| Generate             | ❌              | Network required |
| Try-on               | ❌              | Network required |
| Sign up / Sign in    | ❌              | Network required |

### 13.5 Platform-stickiness rules (mirror the web)

These are **product decisions** the web app already enforces — the native apps must match to keep the stickiness story consistent.

#### a) Do NOT add a "Save to Photos" / "Save to Gallery" affordance

The web app deliberately removed all "Download Image" buttons so users keep coming back to the platform to view their try-ons rather than treating it as a one-shot image generator. Native apps should mirror this:

- ❌ **Don't** add a `UIActivityViewController` action that saves the image to the camera roll
- ❌ **Don't** add a long-press → "Save Image" gesture
- ❌ **Don't** add an explicit Save button anywhere

iOS users may still long-press and use the "Save to Photos" system-level action on an `<UIImage>`. That's an OS-level capability we can't prevent without rendering through canvas/SwiftUI's `.allowsHitTesting(false)` tricks (hostile, not recommended). Just don't add OUR own affordance.

#### b) Share button must use the marketing-page URL, never the raw image URL

The web app shares `https://railory.io/o/{outfit_id}`, which renders a branded marketing page with a "Try Railory free" CTA. Native apps must do the same.

**Swift:**
```swift
let shareUrl = URL(string: "https://railory.io/o/\(outfit.id)")!
let shareText = outfit.prompt.map { "Styled with Railory — \"\($0)\"" }
  ?? "Check out my virtual try-on from Railory"
let activityVC = UIActivityViewController(
  activityItems: [shareText, shareUrl],
  applicationActivities: nil
)
present(activityVC, animated: true)
```

**Kotlin:**
```kotlin
val shareUrl = "https://railory.io/o/${outfit.id}"
val shareText = outfit.prompt?.let { "Styled with Railory — \"$it\"" }
  ?: "Check out my virtual try-on from Railory"
val intent = Intent(Intent.ACTION_SEND).apply {
  type = "text/plain"
  putExtra(Intent.EXTRA_TEXT, "$shareText\n$shareUrl")
}
startActivity(Intent.createChooser(intent, "Share via"))
```

**Don't** share `outfit.preview_image` (the raw bucket URL) — that lets the image spread without a path back to Railory.

#### c) Watermark is handled server-side

You don't need to overlay anything in the native client. The `try-on` edge function composites the Railory mark onto every image before returning it. Both `output_url` (data URL or storage URL) is already watermarked. Just render the image as-is.

### 13.6 Universal Links / App Links (recommended)

When a recipient receives a shared `railory.io/o/{id}` URL and clicks it on a device with the Railory app installed, the OS can open the app directly to a native outfit-view screen (instead of the browser). Much better UX than bouncing through Safari for an existing user.

**iOS — Universal Links setup:**

1. In the **marketing repo** (`railory-marketing`), serve a file at `public/.well-known/apple-app-site-association` (no extension, must be served as JSON):
   ```json
   {
     "applinks": {
       "details": [{
         "appID": "TEAMID.com.railory.ios",
         "paths": ["/o/*"]
       }]
     }
   }
   ```
2. In the iOS app's entitlements: add Associated Domains → `applinks:railory.io`
3. Handle the incoming URL in `App.onOpenURL` / `SceneDelegate`:
   ```swift
   .onOpenURL { url in
     // Parse /o/{id} from url.pathComponents and navigate to outfit view
     guard url.pathComponents.contains("o"),
           let id = url.pathComponents.last else { return }
     // Fetch via get-outfit-preview, render native screen
   }
   ```

**Android — App Links setup:**

1. Serve `public/.well-known/assetlinks.json` from the marketing repo:
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.railory.android",
       "sha256_cert_fingerprints": ["<your-cert-sha256>"]
     }
   }]
   ```
2. In `AndroidManifest.xml`, add an intent filter to the activity:
   ```xml
   <intent-filter android:autoVerify="true">
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="https" android:host="railory.io" android:pathPrefix="/o/" />
   </intent-filter>
   ```
3. In the activity, intercept the URL and navigate to the native outfit screen.

**Why bother:** without Universal/App Links, every shared link opens in Safari/Chrome even for users who have the app. That's a worse experience and you lose the chance to immediately deep-engage an existing user with a native screen.

For the native outfit view itself, hit the public `get-outfit-preview` endpoint with the URL's outfit ID — same data the marketing page consumes. Renders fast, no auth required.

### 13.7 Push notifications

Not implemented in v1. If/when added:
- Add a `device_tokens(user_id, platform, token)` table
- Trigger candidates: subscription renewing, "near limit" warning, new product collections

### 13.8 Telemetry (recommendation)

Track these events for product insight:
- `prompt_submitted` (with prompt length, filters)
- `outfit_generated` (with session_id, count of outfits)
- `try_on_started` / `try_on_completed` (with angle, plan)
- `outfit_saved` / `outfit_unsaved`
- `checkout_started` (plan, interval)
- `checkout_completed`
- `subscription_canceled`
- `limit_hit` (resource, plan)
- `upgrade_clicked` (from limit banner)

---

## 14. Cost economics (server-side)

| Action                              | Cost     |
|-------------------------------------|----------|
| Embed (text-embedding-3-small)      | ~$0.0001 |
| GPT-4o outfit assembly              | ~$0.03   |
| Gemini try-on (preview or standard) | ~$0.002  |
| OpenAI try-on fallback (1024×1024 low) | ~$0.011 |
| Full generation (incl. 4 previews)  | ~$0.04 – $0.08 |
| Stripe fee                          | 2.9% + $0.30/charge (US cards) |

Margins documented in PRICING analysis: Starter ~80% at realistic usage, Pro ~76%.

---

## 15. Quick reference card

```
EDGE FUNCTIONS
  POST   /functions/v1/generate                       → outfit gen
  POST   /functions/v1/save-outfit                    → save (body)
  DELETE /functions/v1/save-outfit?saved_id=...       → unsave
  POST   /functions/v1/try-on                         → virtual try-on
  GET    /functions/v1/profile                        → fetch profile
  PATCH  /functions/v1/profile                        → update body details
  POST   /functions/v1/profile                        → upload avatar (Pro)
  GET    /functions/v1/get-usage                      → plan + usage
  POST   /functions/v1/create-checkout-session        → Stripe checkout URL
  POST   /functions/v1/create-portal-session          → Stripe portal URL

DIRECT DB (RLS-protected)
  SELECT public.outfit_sessions
  SELECT public.outfits (JOIN outfit_items, products)
  SELECT public.saved_outfits (JOIN outfits, items, products)
  SELECT public.usage WHERE period=...
  SELECT public.subscriptions WHERE user_id=auth.uid()
  SELECT public.brands, public.categories, public.products

STORAGE (public)
  /storage/v1/object/public/avatars/{id}.png
  /storage/v1/object/public/outfit-previews/{user_id}/{outfit_id}.png
  /storage/v1/object/public/brand/railory_logo_black.png

STORAGE (private, signed URL via /profile)
  user-avatars/{user_id}/avatar.{ext}

AUTH SCHEMES
  https://app.railory.io/auth/callback   (web)
  railory://auth-callback                (native — configure scheme)
  railory://reset-password               (native — configure scheme)
```

Done — this is everything a native client needs.
