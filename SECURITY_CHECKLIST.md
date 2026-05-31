# Pre-launch Security Checklist

The code changes for signup hardening are already in place — but several settings only live in the **Supabase dashboard** and need to be enabled by you before launch. Each item has direct dashboard links, why it matters, and the order things must be done in.

> ⚠️ **Critical ordering for captcha** — if you enable captcha in Supabase Auth **before** the `NEXT_PUBLIC_TURNSTILE_SITE_KEY` env var is set on Vercel, every signup will fail with "captcha protection required". See § 4 for the safe order.

---

## 1. Confirm email verification is required *(should already be on — verify)*

**Dashboard:** Authentication → Sign In / Providers → Email
**Setting:** `Confirm email` toggle = **ON**

When ON: new users get a confirmation email after `signUp`, and can't log in until they click the link. When OFF: anyone can sign up with any email and immediately use the platform — disposable email defense and captcha are useless without this.

Direct URL: https://supabase.com/dashboard/project/rkbljmsalughhsuspwoi/auth/providers

✓ verify the toggle, no other change needed.

---

## 2. Enable HaveIBeenPwned password check *(free, instant)*

**Dashboard:** Authentication → Sign In / Providers → Email → Password requirements
**Setting:** Enable `Prevent use of compromised passwords`

Rejects passwords that appear in known data-breach corpora (e.g. `password123`, `qwerty`, etc.). Uses k-anonymity — Supabase only sends a 5-char hash prefix to HaveIBeenPwned, never the password itself.

Zero cost, zero performance impact. Stops the laziest credential-stuffing attacks instantly.

✓ flip the toggle.

---

## 3. Tighten password complexity *(2 min)*

**Dashboard:** Authentication → Sign In / Providers → Email → Password requirements

Recommended:
- **Minimum length**: `8` (matches the client-side validation already in `lib/auth-validation.ts`)
- **Required characters**: `Letters and digits` (most balanced — bans pure-numeric like `12345678`)

Do not go stricter than "Letters and digits" — `Letters, digits, and symbols` causes too much UX friction for marginal security gain.

✓ set min length 8, character requirement to "Letters and digits".

---

## 4. Enable Cloudflare Turnstile captcha on signup *(15 min — biggest single defense)*

This is the highest-leverage anti-abuse control. Stops scripted bot signups that would otherwise farm the free tier.

### a) Get Turnstile site key + secret key

1. Create a Cloudflare account (free) if you don't have one: https://dash.cloudflare.com/sign-up
2. Go to **Turnstile** (left sidebar) → **Add site**
3. Site name: `Railory`
4. Hostnames: `app.railory.io` (and `localhost` for dev — Turnstile auto-allows localhost when configured)
5. Widget mode: `Managed` (recommended — Cloudflare decides difficulty per request)
6. After creation, copy two values:
   - **Site key** — public, goes in Vercel env
   - **Secret key** — private, goes in Supabase only

### b) Add the secret key to Supabase BEFORE the site key to Vercel

> 🛑 **Order matters**: Supabase configured + Vercel not = signup BREAKS (Supabase requires a token, client doesn't send one). Vercel configured + Supabase not = harmless (client sends a token, Supabase ignores it).
>
> **Do step (c) first, then step (b).**

### c) Set the public site key in Vercel  *(do this FIRST)*

1. Vercel dashboard → `railory-application` project → **Settings → Environment Variables**
2. Add: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = `<your site key>`
3. Apply to: `Production`, `Preview`, `Development`
4. Click **Save**
5. Trigger a redeploy (Deployments tab → ⋯ → Redeploy on latest production) — env vars only apply to new deployments

After this, the signup page renders the Turnstile widget but Supabase still doesn't enforce it. Signup keeps working.

### d) Enable in Supabase  *(do this AFTER c)*

1. Supabase dashboard → **Authentication → Settings → Bot and Abuse Protection**
2. Enable captcha
3. **Captcha provider**: `Turnstile`
4. **Captcha secret key**: paste the Turnstile **secret** (NOT site key)
5. Save

Direct URL: https://supabase.com/dashboard/project/rkbljmsalughhsuspwoi/auth/protection

After saving, Supabase will require a captcha token on `signUp` calls. Our signup form sends it. Bot signups will fail.

### e) Test

- Open `app.railory.io/signup` in an incognito tab
- The Turnstile widget should render below the password field
- Try signing up — should work normally for you (Turnstile decides you're human in ~1 sec, often without UI interaction)
- Try in a different browser / tor to verify the harder cases also pass

---

## 5. (Optional) Rate-limit signup at the Supabase level

**Dashboard:** Authentication → Rate Limits

Supabase has built-in rate limits per IP for sign-up / sign-in / password reset. Default values are sensible (around 30 signups per hour per IP). Worth verifying:

- **Sign-up**: `30 / hr` per IP is reasonable
- **Sign-in**: `30 / hr` per IP is reasonable
- **Password reset**: `5 / hr` per email is reasonable

Direct URL: https://supabase.com/dashboard/project/rkbljmsalughhsuspwoi/auth/rate-limits

✓ glance over, only change if you see signup-heavy abuse later.

---

## What the code side has *already* done (no action needed)

You don't need to do anything for these — they're in the deployed code:

| Defense | Where it lives | What it does |
|---|---|---|
| Disposable email blocklist | `lib/auth-validation.ts` — ~30 known disposable domains | Rejects mailinator / temp-mail / yopmail etc. before submit |
| Password validator | `lib/auth-validation.ts` — min 8 / max 72 char | Catches client-side before round trip |
| Captcha integration | `app/(auth)/signup/page.tsx` — env-gated Turnstile widget | Renders when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, otherwise inert |
| Captcha token forwarding | Same — passed via `signUp({..., options: { captchaToken }})` | Supabase validates server-side |
| Per-user rate limits | `_shared/auth.ts` — every edge function | 6/min on generate, 10/min on try-on, etc. |
| Atomic usage caps | `check_and_increment_usage` RPC | Row lock prevents race-around-the-limit |
| RLS on user data | DB policies | Direct DB reads scope to `auth.uid()` |
| Stripe webhook signature | `stripe-webhook` edge function | Validates `STRIPE_WEBHOOK_SECRET` |

---

## Order of operations when you do this

1. **Now (1 min)** — Turn on item 1 (verify email confirmation is required)
2. **Now (1 min)** — Turn on item 2 (HaveIBeenPwned check)
3. **Now (2 min)** — Set item 3 (password complexity min length 8)
4. **Now (15 min)** — Set up item 4 (Turnstile), strictly in order: c → d → e
5. **Optional (2 min)** — Verify item 5 (signup rate limits)

Total: ~20 minutes. After this, the platform is hardened against the realistic abuse vectors documented in BACKEND.md § 13.

## Things NOT covered here (later, if scale demands)

- IP-based rate limiting beyond Supabase's built-in (would need Cloudflare in front of edge functions)
- Phone verification for high-value accounts
- Per-user spend kill-switch (cap $ before plan limits hit)
- Audit log table for subscription / billing events (dispute defense)
- Real-time anomaly detection on usage patterns

None are critical for launch. They become valuable once you have >1000 users.
