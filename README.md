# Railory — Application

This repo is the **authenticated web app** for Railory, deployed at [app.railory.io](https://app.railory.io). It's one of three clients that share a single Supabase backend — the others being the marketing site (separate repo, `railory.io`) and the iOS + Android apps (in development).

Railory is a prompt-driven AI personal stylist: users describe a vibe → the system assembles outfits from a curated catalog → renders virtual try-ons on user avatars.

---

## Where to find what

The docs in this repo are organized by question:

| You want to... | Read |
|---|---|
| Understand how everything fits together (web + iOS + Android + backend) | **[SYSTEM.md](SYSTEM.md)** |
| Implement against the API — endpoints, types, examples, errors | **[BACKEND.md](BACKEND.md)** |
| Set up Apple In-App Purchase for the iOS app | **[APPLE_IAP_SETUP.md](APPLE_IAP_SETUP.md)** |
| Harden the platform before launch (Supabase dashboard tasks) | **[SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md)** |
| Deploy / re-deploy / DNS / domain setup | **[DEPLOYMENT.md](DEPLOYMENT.md)** |
| Add the marketing share page (`railory.io/o/{id}`) | **[marketing-share-page/README.md](marketing-share-page/README.md)** |
| Run the web app locally | This file, below |

Reading order if you're new: **SYSTEM.md → BACKEND.md** is enough to understand the whole stack.

---

## Stack (this repo specifically)

| Layer | Tech |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS (custom token palette), Framer Motion, Lenis |
| Auth | `@supabase/ssr` (cookie-based sessions) |
| Backend SDK | `@supabase/supabase-js` |
| Hosting | Vercel |

All business logic lives in **Supabase Edge Functions** (`supabase/functions/`). The Next app has zero `/api` routes — it's purely a UI client.

---

## Local development

```bash
npm install
# create .env.local — see Environment Variables below
npm run dev
```

Runs at http://localhost:3000.

### Environment variables

Create `.env.local` with:

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL (`https://rkbljmsalughhsuspwoi.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase anon key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Privileged DB access (only SSR pages use this) |
| `NEXT_PUBLIC_MARKETING_URL` | client | `https://railory.io` for prod, `http://localhost:3001` for marketing-repo dev |
| `OPENAI_API_KEY` | server | Reserved (not used at runtime in this repo) |
| `GEMINI_API_KEY` | server | Reserved (not used at runtime in this repo) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | client | Optional. When set, signup renders Cloudflare Turnstile captcha. Leave unset for dev. |

All other secrets (Stripe live keys, Apple IAP keys, model API keys actually used at request time) live as **Supabase Edge Function secrets** — they're never deployed to Vercel and never exposed to the web client.

For the full secret inventory: [SYSTEM.md § 13](SYSTEM.md).

---

## Repo layout

```
app/
  (auth)/                       — unauth pages (no app shell)
    login/                      — email + password sign-in, "Forgot password?" link
    signup/                     — registration (with optional captcha + email blocklist + 8-char password rule)
    forgot-password/            — request password reset
    reset-password/             — set new password after clicking email link
  (app)/                        — authenticated pages, TopBar layout
    generate/                   — prompt input + outfit carousel
    try-ons/                    — virtual try-on gallery
    saved/                      — saved outfits grid
    history/                    — session history with expandable cards
    profile/                    — body profile, avatar (Pro), change email
    billing/                    — plan, usage meters, upgrade, manage subscription
  auth/callback/                — Supabase auth code exchange + redirect
  post-auth/                    — post-signup router (handles Stripe handoff for marketing→app flow)
  page.tsx                      — root: redirects to /generate (auth) or /login

components/
  TopBar.tsx                    — fixed top nav with brand + page tabs
  OutfitCard.tsx                — preview-first card with image cycling
  OutfitCarousel.tsx            — horizontal scroll wrapper on /generate
  TryOnModal.tsx                — avatar picker + garment selector + angle controls
  ProfileForm.tsx               — body details form + avatar upload + change email
  UpgradeBanner.tsx             — inline upgrade prompt when plan limit hit
  PromptInput.tsx, FilterBar.tsx, etc.

lib/
  api.ts                        — callEdgeFunction() helper (attaches Bearer token)
  auth-validation.ts            — signup-side email blocklist, password rules, Turnstile flag
  billing.ts                    — plan helpers, formatPrice
  utils.ts                      — MARKETING_URL, formatPrice, formatDate, etc.
  supabase/                     — server.ts + client.ts + middleware.ts SSR helpers
  avatars.ts                    — predefined avatar list

middleware.ts                   — auth guards (which routes need login / which redirect away)

supabase/
  functions/                    — Deno edge functions (deployed separately, not bundled with Next)
    _shared/                    — auth, subscription, plans, try-on, watermark, apple-iap helpers
    generate/                   — outfit generation pipeline (sync)
    try-on/                     — virtual try-on (sync, web primary)
    try-on-async/               — virtual try-on (async, native primary)
    save-outfit/                — save / unsave
    profile/                    — GET / PATCH / POST avatar
    get-usage/                  — plan + limits + current usage
    create-checkout-session/    — Stripe Checkout URL
    create-portal-session/      — Stripe Customer Portal URL
    stripe-webhook/             — Stripe events
    get-outfit-preview/         — public share-page data
    apple-subscription-verify/  — iOS StoreKit purchase verification
    apple-webhook/              — App Store Server Notifications V2
  migrations/                   — versioned SQL (applied via supabase db push)
  email-templates/              — branded HTML for confirm signup / reset password / change email

scripts/                        — legacy / manual-run SQL migrations

public/                         — static assets (logo, favicons, watermark PNG)

marketing-share-page/           — drop-in code for the railory-marketing repo's /o/{id} route
```

---

## Common commands

```bash
# Local dev
npm run dev

# Build (validates types + lints + bundles)
npm run build

# Deploy a single edge function
npx supabase functions deploy <function-name> --no-verify-jwt

# Apply a new SQL migration to live DB
npx supabase db push --linked

# List Supabase edge function secrets
npx supabase secrets list

# Set / update Supabase secrets
npx supabase secrets set KEY="value" KEY2="value2"

# Stream edge function logs (debug)
npx supabase functions logs <function-name>
```

---

## Where things live (super quick lookup)

| Question | Answer |
|---|---|
| Where do auth flows live? | `app/(auth)/`, `lib/auth-validation.ts` |
| Where's the watermark applied? | `supabase/functions/_shared/watermark.ts`, called from `try-on/` and `try-on-async/` |
| How do I add a new edge function? | New folder under `supabase/functions/<name>/index.ts`, then `npx supabase functions deploy <name> --no-verify-jwt` |
| How do I change a plan price? | (1) Update prices in Stripe dashboard; (2) update `STRIPE_PRICE_*` Supabase secrets; (3) update hardcoded display in `app/(app)/billing/page.tsx`; (4) deploy 3 Stripe-touching functions. See [SYSTEM.md § 5](SYSTEM.md). |
| How do I add a new edge function secret? | `npx supabase secrets set KEY="value"`, then redeploy the functions that need it |
| Where does plan-gating logic live? | `supabase/functions/_shared/subscription.ts` |
| Where's the OutfitCard component? | `components/OutfitCard.tsx` |
| How do I run a SQL query against live DB? | Supabase dashboard → SQL Editor, or `psql` with the connection string |

---

## Status

Live and production-ready as of latest deploy. See [SYSTEM.md § 17](SYSTEM.md) for a status snapshot of every surface.
