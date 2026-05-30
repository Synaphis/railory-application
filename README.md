# Railory — Application

The authenticated app surface for Railory: prompt-driven outfit generation and AI virtual try-on. Lives at `app.railory.io`. The marketing/landing site is a separate project at `railory.io`.

## Stack

- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
- **Styling:** Tailwind CSS, Framer Motion, Lenis (smooth scroll)
- **Auth + DB + Storage:** Supabase (`@supabase/ssr` for cookie-based sessions)
- **Backend logic:** Supabase Edge Functions (Deno) — no Next.js API routes
- **AI:** OpenAI GPT-4o (outfit assembly), Gemini 2.5 Flash Image / GPT-image-1 (try-on)
- **Billing:** Stripe (Checkout + Customer Portal, webhook-driven plan sync)

## Local development

```bash
npm install
# create .env.local with the values listed below
npm run dev
```

App runs on http://localhost:3000.

### Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Privileged DB access (SSR pages only) |
| `OPENAI_API_KEY` | server | Reserved for server-side use |
| `GEMINI_API_KEY` | server | Reserved for server-side use |
| `NEXT_PUBLIC_MARKETING_URL` | client | Link target for marketing site (prod: `https://railory.io`) |

All other secrets (Stripe, model keys actually used at request time) live on Supabase as edge function secrets, not in the Next app.

## Repo layout

```
app/
  (auth)/login, signup        unauth pages
  (app)/                      auth-gated app shell (sidebar layout)
    generate/                 prompt to outfit
    try-ons/                  virtual try-on gallery
    saved/                    saved outfits
    history/                  generation history
    profile/                  body profile + avatar
    billing/                  plan + usage + portal
  auth/callback/              Supabase OAuth callback
  post-auth/                  post-signup routing (Stripe handoff)
components/                   shared UI
lib/
  api.ts                      callEdgeFunction() helper
  supabase/                   server + client SSR helpers
  billing.ts, avatars.ts      domain helpers
supabase/functions/           Deno edge functions (deployed separately)
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full Vercel + Namecheap + Supabase + Stripe go-live runbook.
