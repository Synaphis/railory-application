# Railory — System Document

> Multi-platform architecture reference. Railory runs on **three clients sharing one backend**: web (`app.railory.io`), iOS, and Android. This document explains how they fit together and where they differ. For exact API shapes / types / examples → see [BACKEND.md](BACKEND.md).

---

## 1. Platform Overview

Railory is a prompt-driven AI personal stylist. Users describe a vibe → the system generates outfit combinations from a curated product catalogue → renders virtual try-ons on user avatars.

### Three clients, one backend

```
                           railory.io                         app.railory.io
                              │                                     │
                       ┌──────┴──────┐                       ┌──────┴──────┐
                       │  Marketing  │                       │   Web App   │
                       │  (Next.js)  │                       │  (Next.js)  │
                       └──────┬──────┘                       └──────┬──────┘
                              │                                     │
                              │     ┌─────────────────────┐         │
                              │     │     iOS App         │         │
                              │     │ (SwiftUI, planned)  │         │
                              │     └──────────┬──────────┘         │
                              │                │                    │
                              │     ┌──────────┴──────────┐         │
                              │     │   Android App       │         │
                              │     │ (Compose, planned)  │         │
                              │     └──────────┬──────────┘         │
                              │                │                    │
                              └────────────────┴────────────────────┘
                                               │
                                ┌──────────────┴──────────────┐
                                │       Supabase Backend      │
                                │  • Postgres + pgvector      │
                                │  • Edge Functions (Deno)    │
                                │  • Storage (6 buckets)      │
                                │  • Auth (email + password)  │
                                │  • Realtime subscriptions   │
                                └──────────────┬──────────────┘
                                               │
                  ┌────────────────────────────┼───────────────────────────┐
                  │                            │                           │
            ┌─────┴─────┐                ┌─────┴─────┐               ┌─────┴─────┐
            │  Stripe   │                │ Apple IAP │               │  Google   │
            │ (web pay) │                │ (iOS pay) │               │   Play    │
            │           │                │           │               │  (future) │
            └───────────┘                └───────────┘               └───────────┘
```

**Domains:**
- `railory.io` — marketing + share pages (separate Vercel project, `railory-marketing` repo)
- `app.railory.io` — authenticated web app (this repo, `railory-application`)

**Native apps in progress:**
- iOS — Swift / SwiftUI, will use Apple IAP for subscriptions
- Android — Kotlin / Jetpack Compose, will use Google Play Billing

---

## 2. Tech Stack

### Backend (shared by all clients)

| Layer | Tech |
|---|---|
| Database | Supabase Postgres 15 with pgvector |
| Auth | Supabase Auth (email + password, JWT-based) |
| Storage | Supabase Storage — 6 buckets, mix of public + private |
| Edge Functions | Deno runtime, 14 deployed functions |
| Realtime | Supabase Realtime (Postgres CDC over WebSocket) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Outfit assembly | OpenAI `gpt-4o` |
| Virtual try-on | Google `gemini-2.5-flash-image` (primary), OpenAI `gpt-image-1` (fallback) |
| Billing | Stripe (web), Apple App Store (iOS), Google Play (Android) |
| Email | Supabase Auth email service (custom HTML templates) |
| Image processing | `imagescript` (pure-Deno, for server-side watermarking) |
| Hosting | Vercel (web + marketing), Supabase (backend) |
| DNS | Namecheap |

### Web app

| Layer | Tech |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS (custom token palette) |
| Animation | Framer Motion, Lenis (smooth scroll) |
| Icons | Lucide React |
| Auth SDK | `@supabase/ssr` (cookie-based sessions) |

### Native apps (recommended stack)

| Platform | Tech |
|---|---|
| iOS | Swift 5.9+, SwiftUI, [`supabase-swift`](https://github.com/supabase/supabase-swift), StoreKit 2 |
| Android | Kotlin, Jetpack Compose, [`supabase-kt`](https://github.com/supabase-community/supabase-kt), Google Play Billing Library 7+ |

---

## 3. Feature matrix — what works where

Most features are identical across platforms. The differences below are intentional (App Store guidelines, OS capabilities, or platform-specific UX).

| Feature | Web | iOS | Android |
|---|---|---|---|
| Sign up / log in / password reset | ✅ | ✅ | ✅ |
| Outfit generation from prompt | ✅ | ✅ | ✅ |
| Virtual try-on (predefined avatar) | ✅ | ✅ | ✅ |
| Virtual try-on (custom avatar, Pro) | ✅ | ✅ | ✅ |
| Save / unsave outfits | ✅ | ✅ | ✅ |
| Session history | ✅ | ✅ | ✅ |
| Try-on gallery | ✅ | ✅ | ✅ |
| Profile + body details | ✅ | ✅ | ✅ |
| Change email / change password | ✅ | ✅ | ✅ |
| Subscribe → **Stripe Checkout** | ✅ | ❌ | ❌ |
| Subscribe → **Apple IAP** | ❌ | ✅ | ❌ |
| Subscribe → **Google Play Billing** | ❌ | ❌ | ✅ (future) |
| Manage subscription | Stripe Customer Portal | iOS Settings → Subscriptions | Google Play Subscriptions |
| Try-on (sync — `try-on`) | ✅ | not recommended (timeouts) | not recommended (timeouts) |
| Try-on (async — `try-on-async`) | optional | ✅ recommended | ✅ recommended |
| Share outfit to socials | Web Share API → `railory.io/o/{id}` | UIActivityViewController → same URL | Intent.ACTION_SEND → same URL |
| Save image to device | ❌ removed (stickiness) | ❌ no Save-to-Photos button | ❌ no Save-to-Gallery button |
| Open shared `/o/{id}` link | Browser | Universal Link → app | App Link → app |
| Push notifications | ❌ | ⬜ Phase 2 (APNs) | ⬜ Phase 2 (FCM) |
| Offline viewing of saved looks | ❌ | ✅ cache locally | ✅ cache locally |
| Deep links to retailer | `product_url` (web link) | `deep_link_ios` then web | `deep_link_android` then web |

### Watermark

**Every** try-on image, regardless of source client, is server-side watermarked with the Railory mark in the bottom-right corner. Clients render the image as-is. See [BACKEND.md §6.3](BACKEND.md) for details.

---

## 4. Authentication (shared model)

All clients use **Supabase Auth** with the same flows:

| Flow | All clients |
|---|---|
| Sign up | `supabase.auth.signUp({ email, password, options: { emailRedirectTo, captchaToken? } })` |
| Confirm email | Email link → `/auth/callback?code=...` → `exchangeCodeForSession` → `/post-auth` |
| Log in | `supabase.auth.signInWithPassword({ email, password })` |
| Forgot password | `supabase.auth.resetPasswordForEmail(email, { redirectTo: ... })` |
| Reset password | Email link → recovery session → `updateUser({ password })` |
| Change email | `updateUser({ email }, { emailRedirectTo })` → confirmation to new email |
| Sign out | `supabase.auth.signOut()` |

### Platform-specific nuances

| Platform | Callback URL scheme | Notes |
|---|---|---|
| Web | `https://app.railory.io/auth/callback` | Cookie-based session via `@supabase/ssr` |
| iOS | `railory://auth-callback` | Universal Link OR custom URL scheme. Configure in Supabase → Auth → Redirect URLs. |
| Android | `railory://auth-callback` | App Link OR custom URL scheme. Same Supabase config. |

The web app cookie scope is `app.railory.io` — cookies do NOT cross to `railory.io`, so the marketing site cannot read auth state. Native apps use Keychain (iOS) / EncryptedSharedPreferences (Android) for token persistence via the official Supabase SDK.

### Signup hardening (live as of latest deploy)

- Client-side disposable email blocklist (~30 known throwaway services)
- Password minimum 8 chars (was 6) — existing users unaffected
- Cloudflare Turnstile captcha (env-gated — dormant until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set + Supabase dashboard captcha enabled)

See [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) for dashboard steps to flip captcha + HaveIBeenPwned + complexity rules on.

---

## 5. Subscriptions & Billing (multi-source)

### One `subscriptions` table, three sources

```
public.subscriptions
  user_id │ plan │ status │ source │ current_period_end │ ...
  uuid    │ pro  │ active │ stripe │ 2027-05-30         │ stripe_subscription_id, ...
  uuid    │ pro  │ active │ apple  │ 2027-05-30         │ apple_original_transaction_id, ...
  uuid    │ pro  │ active │ google │ 2027-05-30         │ google_purchase_token, ...
```

The `source` column says where the subscription came from. Plan-gating logic (`getUserSubscription`, `checkAndIncrementGeneration`, etc.) reads the same row regardless — they don't care about source.

### Pricing matches across platforms

| Plan | Stripe (web) | Apple IAP (iOS) | Google Play (Android) |
|---|---|---|---|
| Starter Monthly | $9.99 | $9.99 (`io.railory.starter.monthly`) | same |
| Starter Yearly | $95 | $95 (`io.railory.starter.yearly`) | same |
| Pro Monthly | $24.99 | $24.99 (`io.railory.pro.monthly`) | same |
| Pro Yearly | $239 | $239 (`io.railory.pro.yearly`) | same |

Pricing tiers may be ±1 cent in non-US storefronts due to Apple/Google's fixed-tier pricing systems. This is expected.

### What each source uses

| Source | Subscribe via | Manage via | Webhook handler |
|---|---|---|---|
| `stripe` | Stripe Checkout (`create-checkout-session`) | Stripe Customer Portal (`create-portal-session`) | `stripe-webhook` |
| `apple` | StoreKit 2 in iOS app → `apple-subscription-verify` | iOS Settings → Subscriptions | `apple-webhook` (App Store Server Notifications V2) |
| `google` | Play Billing Library in Android app → `google-subscription-verify` (Phase 2) | Google Play Store → Subscriptions | `google-webhook` (Real-time Developer Notifications, Phase 2) |

### Plan-gating works the same regardless of source

Every consuming function (`generate`, `try-on`, `try-on-async`, `profile` for avatar uploads, etc.) calls helpers from `_shared/subscription.ts`:

- `getUserSubscription(db, userId)` — returns the subscription row, applies grace period
- `checkAndIncrementGeneration(...)` / `checkAndIncrementTryOn(...)` — atomic limit check + decrement
- `checkSavedLimit(...)` — total saved looks cap
- `checkCustomAvatarAllowed(...)` — Pro-only feature gate
- `getAllowedAngles(...)` — try-on angle restriction by plan

These never read `subscription.source` — they only read `subscription.plan`. So iOS-subscribed Pro users get the exact same Pro experience as web-subscribed Pro users.

### Per-platform subscription rules to know

1. **iOS:** App Store guideline 3.1.1 forbids mentioning external payment in the iOS app. The iOS subscription UI must say "Manage in App Store" not "Manage at railory.io".
2. **Android:** Google Play has similar rules but slightly more permissive (you can mention web payment for cross-platform users since the 2023 Epic v. Google ruling, but only in non-purchase flows).
3. **Web:** the existing Stripe flow is fine — no restrictions on mentioning Stripe.

### Edge cases (designed but not yet UI'd)

- **User subscribed via web tries to subscribe via iOS:** the Apple webhook would overwrite the Stripe row, orphaning the Stripe sub (it'd keep billing until canceled at Stripe). Recommended UX: detect existing Stripe sub on iOS launch, show "You're already subscribed via web. Cancel there first" message.
- **User cancels Apple sub, doesn't resubscribe on web:** Apple webhook fires `EXPIRED` → row reverts to `plan='free'`. Works correctly.

Full Apple IAP setup walkthrough: [APPLE_IAP_SETUP.md](APPLE_IAP_SETUP.md).

---

## 6. Database (high-level)

10 tables in the `public` schema. Full column-by-column reference in [BACKEND.md §2](BACKEND.md).

| Table | Purpose | RLS |
|---|---|---|
| `users` | App-level user (extends `auth.users`); body profile fields | User reads/writes own |
| `brands`, `categories` | Product catalog metadata | Read-all |
| `products` | Product catalog + vector embeddings | Read-all |
| `outfit_sessions` | One per user "generate" event | User reads own |
| `outfits` | Individual outfit combos within a session | User reads own (via session join) |
| `outfit_items` | Products assigned to outfits with role | Through outfit |
| `saved_outfits` | User bookmarks | User reads/writes own |
| `subscriptions` | One per user, multi-source (Stripe/Apple/Google) | User reads own; webhooks write via service role |
| `usage` | Per-period counters (generations, try-ons) | User reads own; edge functions write via service role |
| `try_on_jobs` | Async try-on queue (status, output URL, error) | User reads own; edge functions write |
| `generate_jobs` | Async generate queue (Phase 2 scaffold, not yet active) | User reads own |

### RPCs

| Function | Purpose |
|---|---|
| `check_and_increment_usage(user_id, period, field, limit)` | Atomic limit check + decrement (row lock) |
| `increment_usage(user_id, period, field, amount)` | Simple atomic upsert (used for rollback) |
| `match_products(query_vector, count, price_max, price_min, gender)` | Vector similarity search |
| `reclaim_stuck_jobs()` | Find async jobs stuck >5min, mark failed, refund credits. Scheduled via pg_cron. |

---

## 7. Storage Buckets

| Bucket | Public | Used by |
|---|---|---|
| `avatars` | ✅ | 12 predefined avatar images |
| `user-avatars` | ❌ (signed URL) | Custom uploaded avatars (Pro feature) |
| `product-images` | ✅ | Product catalog images |
| `outfit-previews` | ✅ | Persisted watermarked try-on results |
| `generated-outfits` | ❌ | Reserved for future |
| `brand` | ✅ | Brand assets — email logo, try-on watermark |

URL pattern: `https://rkbljmsalughhsuspwoi.supabase.co/storage/v1/object/public/{bucket}/{path}`

---

## 8. Edge Functions (current inventory)

14 functions deployed. All require JWT auth unless noted.

### Core / user-facing

| Function | Method | Purpose |
|---|---|---|
| `generate` | POST | Full outfit generation pipeline (sync, ~5-30s) |
| `try-on` | POST | Virtual try-on, **synchronous** — web primary, native NOT recommended (timeout risk) |
| `try-on-async` | POST | **Async** try-on for native — returns `job_id` in <1s, native subscribes to `try_on_jobs` row via Realtime |
| `save-outfit` | POST / DELETE | Save / unsave an outfit |
| `profile` | GET / PATCH / POST | Fetch / update / upload-avatar |
| `get-usage` | GET | Plan + limits + current-period usage |

### Billing

| Function | Method | Purpose |
|---|---|---|
| `create-checkout-session` | POST | Stripe Checkout URL (web only) |
| `create-portal-session` | POST | Stripe Customer Portal URL (web only) |
| `stripe-webhook` | POST | Stripe events (signature-verified, no JWT) |
| `apple-subscription-verify` | POST | iOS calls after StoreKit 2 purchase — verifies signed transaction |
| `apple-webhook` | POST | App Store Server Notifications V2 (JWS-verified, no JWT) |

### Public / share

| Function | Method | Purpose |
|---|---|---|
| `get-outfit-preview` | GET | Public outfit data by UUID — used by marketing share page + native Universal/App Links (no JWT) |

Full request/response shapes, error codes, and code samples: [BACKEND.md §6](BACKEND.md).

### Shared helpers (`_shared/`)

| File | What's in it |
|---|---|
| `auth.ts` | JWT validation, rate limit, body size limits, CORS |
| `subscription.ts` | Plan helpers, atomic usage check, period-anchor logic |
| `plans.ts` | `PLAN_LIMITS`, Stripe price ID resolver |
| `try-on.ts` | AI provider strategy (Gemini → OpenAI fallback), prompt builder, angle definitions |
| `watermark.ts` | imagescript-based bottom-right mark compositor, fail-open |
| `apple-iap.ts` | Apple JWS verification, product mapping, App Store Server API client |
| `currency.ts` | Price conversion, brand shipping scoring |

---

## 9. Stickiness & Sharing (platform-wide rules)

Three design decisions all clients must honor consistently:

### a) No "save image" affordance

- **Web:** removed Download buttons from try-on lightbox and modal
- **iOS:** native apps must NOT add UIActivityViewController "Save to Photos" action
- **Android:** native apps must NOT add a Save to Gallery affordance

OS-level long-press → Save Image still works (can't be prevented without hostile UX). But no client should add its own button.

### b) Share button uses marketing-page URL

When user shares a try-on:

- **All clients:** share `https://railory.io/o/{outfit_id}` (the marketing share page)
- **NEVER share** `outfit.preview_image` (the raw bucket URL)

This way:
- Recipient lands on a branded page with "Try Railory free" CTA
- OpenGraph meta tags make Twitter/iMessage unfurl beautifully
- The image URL doesn't spread without a path back to the brand

### c) Watermark on every try-on

- Applied **server-side** in the try-on edge function (sync + async)
- Pure-Deno via `imagescript` library
- Bottom-right corner, ~10% of width, 45% opacity
- Fail-open at every step — if watermarking errors, original AI image is returned
- Clients render the image as-is. No client-side overlay.

---

## 10. Async Job Pattern (for native)

Native clients hit HTTP timeout on the sync `try-on` endpoint (~30s default on iOS URLSession / Android OkHttp). Solution: async pattern.

### Flow

```
1. Client POST /try-on-async with idempotency_key (UUID)
   → returns { job_id, status: "pending" } in <1s
   → credit deducted atomically at this point

2. Client subscribes to public.try_on_jobs row via Realtime
   OR polls the row every 3-5s

3. Background:
   - Job marked 'processing'
   - AI provider call (Gemini → OpenAI fallback)
   - Watermark applied (fail-open)
   - Persisted to outfit-previews bucket
   - Row updated: status='completed', output_url=<url>

4. Client receives update via Realtime → renders image
   On failure: status='failed', credit auto-refunded
```

### Cost protections specific to async

| Protection | What it stops |
|---|---|
| **Idempotency key** (5-min window) | Double-tap submission, retry storms — same UUID returns existing job |
| **Max 3 concurrent jobs per user** | Buggy client / malicious actor spamming parallel AI calls |
| **`reclaim_stuck_jobs()` pg_cron** | Function instance killed mid-AI-call — finds stuck jobs >5min, marks failed, refunds credit |
| **Atomic credit deduction (row lock)** | Two concurrent requests both squeaking past the limit |

### Sync vs async per platform

| Endpoint | Web | iOS | Android |
|---|---|---|---|
| `try-on` (sync) | ✅ primary | not recommended | not recommended |
| `try-on-async` (async) | optional | ✅ primary | ✅ primary |
| `generate` (sync) | ✅ primary | ✅ (typically <30s) | ✅ (typically <30s) |
| `generate-async` (Phase 2) | — | future | future |

---

## 11. Cost Protection Layers

Defense in depth — multiple layers prevent runaway API costs from abuse:

| Layer | Where | What it catches |
|---|---|---|
| Plan-based monthly caps | `check_and_increment_usage` (atomic SQL) | User can't exceed their plan's monthly limit |
| Per-user rate limits | `_shared/auth.ts` (in-memory per isolate) | Burst spam: 6/min generate, 10/min try-on, etc. |
| Idempotency keys | `try-on-async` | Double-tap from same user action |
| Max concurrent jobs | `try-on-async` | Retry storms |
| Atomic refund on AI failure | All consuming endpoints | User doesn't lose credit if Gemini/OpenAI fails |
| Stuck job reclaimer | `reclaim_stuck_jobs()` via pg_cron | Function killed mid-AI-call — refund + mark failed |
| Body size limits | `_shared/auth.ts` (50KB JSON, 1000 char prompt, 6 garments) | Oversized payloads |
| Disposable email block | `lib/auth-validation.ts` | Free-tier farming via temp emails |
| Captcha on signup | env-gated (Cloudflare Turnstile) | Bot signup farming |
| Stripe webhook signature | `stripe-webhook` | Forged subscription updates |
| Apple JWS verification | `apple-subscription-verify` + `apple-webhook` | Forged StoreKit transactions / notifications |
| Apple appAccountToken cross-check | `apple-subscription-verify` | User A claiming User B's purchase |
| Email verification required | Supabase Auth setting | Accounts without verified ownership |
| HaveIBeenPwned password check | Supabase Auth setting | Compromised-password reuse |

Most protections are server-side and apply identically across clients.

---

## 12. Security Model

### Authentication

- Supabase gateway enforces `verify_jwt: true` on all auth-required endpoints — invalid tokens get 401'd before reaching our code
- `_shared/auth.ts` extracts the verified user via `supabase.auth.getUser(token)`
- Service-role client used inside edge functions for privileged DB/storage operations — never exposed to clients

### RLS (Row-Level Security)

Enabled on all user-scoped tables. Users can only `SELECT/INSERT/UPDATE/DELETE` rows they own. Direct DB queries (via Supabase JS / Swift / Kotlin SDK) respect this automatically.

### What clients never see

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`, `GEMINI_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `APPLE_APP_STORE_PRIVATE_KEY`, `APPLE_IAP_SHARED_SECRET`
- Raw product embeddings
- Other users' data

### Open redirect defense

`/auth/callback` validates the `next` param: must start with `/` and not `//`. Falls back to `/post-auth` otherwise.

### CORS

Edge functions check `Origin` against `ALLOWED_ORIGINS` (set to `https://app.railory.io,https://railory.io`). Native apps don't send Origin and bypass CORS by design — JWT auth is the actual gate.

### App Store / Play Store rules

- iOS app must NOT mention Stripe, external payment links, or web subscription
- Android more permissive but still recommend in-app billing as primary
- Both: "Restore Purchases" must be visible (Apple) / supported (Google)

---

## 13. Deployment Topology

### Domains + Vercel projects

| Domain | Vercel project | Repo |
|---|---|---|
| `railory.io` | `railory-marketing` | `railory-marketing` |
| `app.railory.io` | `railory-application` | `railory-application` (this repo) |

### Backend

- **Supabase project:** `rkbljmsalughhsuspwoi`
- **Region:** Oceania (Sydney)
- **Plan:** Pro (recommended for production — 400s edge function timeout, daily backups, no project pausing)

### DNS (Namecheap)

| Type | Host | Value |
|---|---|---|
| A | `@` | `76.76.21.21` (Vercel apex) |
| CNAME | `www` | `cname.vercel-dns.com` |
| CNAME | `app` | `cname.vercel-dns.com` |

### Universal Links / App Links (Phase 2)

Files to add to `railory-marketing` repo's `public/.well-known/`:
- `apple-app-site-association` (iOS)
- `assetlinks.json` (Android)

So shared `/o/{id}` URLs open inside the native app when installed.

### Edge function secrets (current count: 16)

```
Supabase auto-set:
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

AI providers:
  OPENAI_API_KEY, GEMINI_API_KEY

Stripe (web subscriptions):
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_STARTER_MONTHLY, STRIPE_PRICE_STARTER_YEARLY
  STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY
  APP_URL, ALLOWED_ORIGINS

Apple IAP (iOS subscriptions, set when iOS launches):
  APPLE_BUNDLE_ID, APPLE_TEAM_ID, APPLE_IAP_SHARED_SECRET
  APPLE_APP_STORE_KEY_ID, APPLE_APP_STORE_ISSUER_ID
  APPLE_APP_STORE_PRIVATE_KEY
```

---

## 14. Native App Recommendations (high-level)

For full code samples + endpoint contracts: [BACKEND.md §11–§13](BACKEND.md). For Apple-specific setup: [APPLE_IAP_SETUP.md](APPLE_IAP_SETUP.md).

### iOS (Swift / SwiftUI)

Recommended architecture:
- **State management:** Observable + SwiftUI environment
- **HTTP:** `supabase-swift` SDK — handles JWT refresh, Realtime, Storage, Functions
- **Subscriptions:** StoreKit 2 with `appAccountToken(userIdUUID)` for fraud prevention
- **Async try-on:** `try-on-async` + Realtime subscription on `try_on_jobs` table
- **Deep linking:** Universal Links for `railory.io/o/{id}` + custom URL scheme `railory://` for auth callbacks
- **Image caching:** Kingfisher or NukeUI with disk cache
- **Auth:** SwiftUI app receives `Session` from Supabase SDK, persists to Keychain automatically

### Android (Kotlin / Compose)

Recommended architecture:
- **State management:** ViewModel + StateFlow
- **HTTP:** `supabase-kt` SDK — same capabilities as Swift counterpart
- **Subscriptions:** Google Play Billing Library 7+ (Phase 2 — webhook scaffold pending)
- **Async try-on:** same pattern as iOS
- **Deep linking:** App Links via intent-filter with `autoVerify="true"`
- **Image caching:** Coil with disk cache
- **Auth:** Supabase SDK persists to EncryptedSharedPreferences

### Push notifications (Phase 2 for both)

Not implemented in v1. When added:
- New `device_tokens(user_id, platform, token, created_at)` table
- Trigger candidates: subscription renewing soon, "near limit" reminder, new outfit collection, friend's outfit shared with you
- iOS: APNs via Apple Push Notification service
- Android: FCM (Firebase Cloud Messaging)

---

## 15. Documentation Map

| Want to... | Read |
|---|---|
| Understand the architecture (you are here) | [SYSTEM.md](SYSTEM.md) |
| Implement against the API — exact types, examples, error codes | [BACKEND.md](BACKEND.md) |
| Set up Apple In-App Purchase | [APPLE_IAP_SETUP.md](APPLE_IAP_SETUP.md) |
| Harden the platform before launch (dashboard checklist) | [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) |
| Deploy / re-deploy / DNS | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Set up local dev | [README.md](README.md) |
| Add the marketing share page | [marketing-share-page/README.md](marketing-share-page/README.md) |
| Look at an SQL migration | `supabase/migrations/*.sql` |

---

## 16. Allowed Values Quick Reference

For form pickers — same across all clients.

| Field | Values |
|---|---|
| `body_type` | `slim` `athletic` `medium` `curvy` `plus` |
| `gender_presentation` | `female` `male` `androgynous` |
| `skin_tone` | `light` `fair` `medium` `olive` `brown` `dark` |
| `hair_length` | `bald` `short` `medium` `long` |
| `age_range` | `18-24` `25-34` `35-44` `45-54` `55+` |
| Outfit gender filter | `mens` `womens` `unisex` |
| Outfit item `role` | `top` `bottom` `shoe` `jacket` `boots` |
| Try-on `angle` | `front` `back` `left-side` `right-side` `three-quarter` `close-up-top` `close-up-bottom` |
| Country | ISO 3166-1 alpha-2 (`US` `GB` `PK` `AE` `SA` `IN` `DE` `FR` `CA` `AU` `TR`) |
| Currency | ISO 4217 (`USD` `GBP` `EUR` `PKR` `AED` `SAR` `INR` `CAD` `AUD` `TRY`) |
| Subscription source | `free` `stripe` `apple` `google` |
| Subscription status | `active` `past_due` `canceled` `trialing` |

---

## 17. Status as of this writing

| Surface | Status |
|---|---|
| Marketing site live at `railory.io` | ✅ |
| Web app live at `app.railory.io` | ✅ |
| Stripe live mode with all 4 plans wired | ✅ |
| Full billing test suite (sub, upgrade, downgrade, cancel) | ✅ verified |
| Server-side watermark on try-ons | ✅ |
| Marketing share page `/o/{id}` | ✅ deployed to railory.io |
| Async try-on endpoint for native | ✅ deployed |
| Apple IAP backend scaffold | ✅ deployed, awaiting App Store Connect config |
| Pre-launch dashboard hardening (captcha, HIBP, etc.) | ⬜ pending in Supabase dashboard |
| iOS app | ⬜ in development |
| Android app | ⬜ in development |
| Google Play Billing backend | ⬜ Phase 2 |
| Push notifications | ⬜ Phase 2 |
