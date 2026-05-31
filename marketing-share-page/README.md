# Marketing share-page drop-in

Drop these files into your **`railory-marketing`** Next.js (App Router) project to make `https://railory.io/o/{outfit_id}` work.

## What's in here

```
marketing-share-page/
  app/
    o/
      [id]/
        page.tsx        ← the share page itself (server component)
        not-found.tsx   ← clean 404 for invalid IDs
  README.md
```

## How to install in the marketing repo

Assuming your marketing repo uses Next.js App Router (`app/` directory):

```bash
# From the marketing repo root:
mkdir -p app/o
cp -r /path/to/this/marketing-share-page/app/o/\[id\] app/o/
```

That's it — no new dependencies needed. The page uses only:
- `next` (already there)
- `next/link`, `next/navigation` (built-in)

Tailwind classes used assume your marketing repo shares the same design system tokens as the app repo:

- `bg-canvas`, `border-hairline`, `near-black`, `ink`, `muted-slate`, `stone`, `coral`, `action-blue`
- `font-display` (Space Grotesk)
- `font-mono` (JetBrains Mono)

If your marketing repo uses different token names, search-and-replace those classes.

## Verify after deploy

1. From your app at `app.railory.io`, generate a try-on and click **Share** on the lightbox
2. The shared URL should look like `https://railory.io/o/<some-uuid>`
3. Open it in another browser — should render the page (NOT a 404)
4. Paste the URL into Twitter, iMessage, or Slack — the unfurled preview should show the outfit image, title, and description

If the preview doesn't unfurl correctly:
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/

## How it works

The page calls the public Supabase edge function:

```
GET https://rkbljmsalughhsuspwoi.supabase.co/functions/v1/get-outfit-preview?id={uuid}
```

No JWT required. The endpoint returns only public-safe fields (no user_id, no email). UUIDs are 128-bit so guessing is computationally infeasible — same security model as Google Docs link-sharing.

If the fetch returns 404 (outfit doesn't exist, or no preview image yet) the page calls `notFound()` which renders `not-found.tsx`.

The data fetch is cached for 1 hour (`revalidate: 3600`) since outfit previews are immutable once generated.

## Customizing

- **Brand bar**: edit the `<header>` at the top of `page.tsx`
- **CTA copy**: edit the "Want your own AI stylist?" section near the bottom
- **Sign-up link**: currently goes to `https://app.railory.io/signup` — change if needed
- **Footer**: edit at the bottom

## What's NOT in here

- Tailwind config — must match the app repo's tokens (or use your existing tokens with class rename)
- Global layout (`app/layout.tsx`) — assumed already present in the marketing repo
- Favicon, fonts setup — already in the marketing repo

That's it. After dropping in, push and Vercel auto-deploys. Test a share from the app.
