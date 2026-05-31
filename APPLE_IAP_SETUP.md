# Apple In-App Purchase Setup

End-to-end checklist for taking Railory's iOS subscriptions live. The **backend code is already shipped** (`/apple-subscription-verify` and `/apple-webhook` edge functions, schema columns on `subscriptions`, plan-mapping helper). What's left is the work that can only happen in **App Store Connect** and inside the **iOS app codebase**.

Do these in order — skipping ahead breaks sandbox testing.

---

## 1. Create the 4 subscription products in App Store Connect

App Store Connect → My Apps → **Railory** → Monetization → **In-App Purchases** → **+**

For each of the 4 products below, choose type **Auto-Renewable Subscription**. They must all live inside the **same Subscription Group** (e.g., "Railory") so users can upgrade/downgrade between them.

| Product Reference Name | Product ID (must match `APPLE_PRODUCT_TO_PLAN`) | Subscription Duration | Price |
|---|---|---|---|
| Starter Monthly | `io.railory.starter.monthly` | 1 month | $9.99 |
| Starter Yearly  | `io.railory.starter.yearly`  | 1 year  | $95   |
| Pro Monthly     | `io.railory.pro.monthly`     | 1 month | $24.99 |
| Pro Yearly      | `io.railory.pro.yearly`      | 1 year  | $239  |

The **Product IDs** are case-sensitive and must match exactly what's in [`supabase/functions/_shared/apple-iap.ts`](supabase/functions/_shared/apple-iap.ts) `APPLE_PRODUCT_TO_PLAN`. If you change the IDs in App Store Connect, change them in the code too.

For each product:
- **Subscription Group**: same one (e.g., "Railory")
- **Localization**: English (and any other languages you support) — `Display Name`, `Description`
- **Review Information**: screenshot of the paywall + a note explaining what users get
- **Pricing**: choose Apple's pricing tier closest to your target (Apple has fixed tiers per country). You said pricing parity with Stripe — Apple's tiers may be cents-off in some countries; that's expected.

After creating all 4, hit **Submit for Review** for each. You can test in sandbox before the product is "Approved" — but for production launch they need to be in **Ready for Sale** status.

---

## 2. Generate App Store Server API credentials

The webhook uses Apple's **App Store Server API** to fetch fresh subscription state when needed. Auth is via an ES256 JWT signed with a `.p8` key.

App Store Connect → Users and Access → **Integrations** → **App Store Server API** → **Generate API Key**

- **Name**: `Railory webhook`
- **Access**: `App Manager` (or stricter `Customer Support` — minimum needed)
- Download the `.p8` file when prompted — **you can only download it once.** Save it somewhere safe.

Note these values (you'll paste them into Supabase secrets):
- **Key ID** — shown in the table next to your new key
- **Issuer ID** — at the top of the API Keys page
- The full contents of the `.p8` file (open in any text editor — should look like `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----`)

---

## 3. Get the App Store Shared Secret

App Store Connect → My Apps → **Railory** → App Information → **App-Specific Shared Secret** → **Generate** (or **Manage** if one exists)

Copy the 32-character hex string. This is `APPLE_IAP_SHARED_SECRET`.

---

## 4. Set the 5 Supabase secrets

Run this on your machine (replace the placeholders):

```bash
npx supabase secrets set \
  APPLE_BUNDLE_ID="io.railory.ios" \
  APPLE_TEAM_ID="YOUR_TEAM_ID" \
  APPLE_IAP_SHARED_SECRET="32chars..." \
  APPLE_APP_STORE_KEY_ID="XXXXXXXX" \
  APPLE_APP_STORE_ISSUER_ID="UUID-FROM-INTEGRATIONS-PAGE"

# The .p8 contents have to go in via the dashboard (multiline strings
# are awkward via CLI). Supabase Dashboard → Project Settings →
# Edge Functions → Manage secrets → Add:
#   Name:  APPLE_APP_STORE_PRIVATE_KEY
#   Value: <paste the entire .p8 file content including BEGIN/END lines>
```

Then redeploy the two Apple functions so they pick up the new secrets:

```bash
for fn in apple-subscription-verify apple-webhook; do
  npx supabase functions deploy "$fn" --no-verify-jwt
done
```

---

## 5. Register the webhook URL in App Store Connect

App Store Connect → My Apps → **Railory** → App Information → **App Store Server Notifications**

**Production URL:**
```
https://rkbljmsalughhsuspwoi.supabase.co/functions/v1/apple-webhook
```

**Sandbox URL** (same — our code checks `payload.data.environment` to know which):
```
https://rkbljmsalughhsuspwoi.supabase.co/functions/v1/apple-webhook
```

**Version**: Version 2 (V2 is required — V1 is deprecated)

**Authorization Token**: Apple doesn't use one for V2 — verification is via JWS signature, which our code already handles.

Click **Save**.

### Test the webhook hookup

App Store Connect → App Store Server Notifications → click **Request a Test Notification** for your sandbox URL. Apple POSTs a `TEST` notification to your endpoint within ~30 seconds.

Check Supabase logs:
```bash
npx supabase functions logs apple-webhook
```

You should see:
```
[apple-webhook] event=TEST env=Sandbox uuid=...
```

If you do — webhook hookup is verified. If not, check that:
- The URL is correctly entered (no trailing slash)
- The function is deployed (it is — we did this above)
- `APPLE_BUNDLE_ID` is set correctly

---

## 6. Add the StoreKit 2 client code to the iOS app

In the iOS app (not this repo — your `railory-ios` project), use StoreKit 2:

```swift
import StoreKit

// 1. Fetch products
let products = try await Product.products(for: [
  "io.railory.starter.monthly",
  "io.railory.starter.yearly",
  "io.railory.pro.monthly",
  "io.railory.pro.yearly",
])

// 2. Initiate purchase, attaching the Supabase user ID as appAccountToken
//    (this is critical — it's how the backend verifies the buyer is the
//    authenticated user, not someone with a stolen JWT)
let userIdUUID = UUID(uuidString: supabase.auth.session.user.id)!
let result = try await selectedProduct.purchase(options: [
  .appAccountToken(userIdUUID)
])

// 3. Handle the verification result
switch result {
case .success(let verification):
  switch verification {
  case .verified(let transaction):
    // 4. Send the signed transaction to our backend
    let jws = transaction.jwsRepresentation
    let response = try await supabase.functions.invoke(
      "apple-subscription-verify",
      options: .init(body: ["signed_transaction_info": jws])
    )
    // Show success UI

    // 5. CRITICAL: tell Apple we've successfully processed this
    await transaction.finish()

  case .unverified(_, let error):
    // Apple's local verification failed — show error
    throw error
  }
case .userCancelled:
  return
case .pending:
  // Awaiting approval (e.g., Ask to Buy for kids)
  break
@unknown default:
  break
}
```

### Restore Purchases button

iOS users expect a "Restore Purchases" option (Apple requires it for App Review):

```swift
for await result in Transaction.currentEntitlements {
  guard case .verified(let transaction) = result else { continue }
  let jws = transaction.jwsRepresentation
  // Re-call /apple-subscription-verify with this JWS — server will
  // upsert (no double-charge, just re-attaches the subscription to this
  // user_id if needed)
  try await supabase.functions.invoke(
    "apple-subscription-verify",
    options: .init(body: ["signed_transaction_info": jws])
  )
}
```

---

## 7. Test in sandbox before going to production

App Store Connect → Users and Access → **Sandbox Testers** → **+**

Create a sandbox tester account (a non-real Apple ID — use any email you control, doesn't need to be a real Apple account). Use this account in iOS Settings → Developer → Sandbox Account on a test device.

Then in the app, run through the purchase flow. Apple processes the "purchase" against the sandbox — no real money. Notifications fire to your webhook with `environment: "Sandbox"`.

Things to verify in sandbox:
- ✅ Initial subscribe → DB row created with `source='apple'`, correct plan
- ✅ Auto-renewal — sandbox renews every 5 min for monthly, 1 hour for yearly. Watch your `current_period_end` extend automatically.
- ✅ Cancel → after current period, `EXPIRED` fires → DB downgrades to `free`
- ✅ Refund via App Store Connect → `REVOKE` fires → DB downgrades immediately

Once sandbox works end-to-end, you're cleared to submit your iOS app for review.

---

## 8. App Store Review notes

Apple is strict about subscription apps. When submitting the iOS app:

- **App Privacy** section: declare you collect user-purchase data
- **App Review Information**: include a tester account (sandbox tester from step 7)
- **Restore Purchases**: must be visible somewhere in the app (typically Settings or Account screen)
- **Subscription Terms**: must be linked from your paywall — Privacy Policy + Terms of Service URLs. You have these at `railory.io/privacy` and `railory.io/terms`.
- **Auto-renew disclosure**: Apple requires specific language near the subscribe button:
  > Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period. Manage in iTunes Account Settings.
- Do **NOT** mention Stripe, Web payment, or any external billing in the iOS app — App Store guideline 3.1.1 forbids it. iOS users always pay via Apple.

---

## What the backend handles automatically once you've done all this

- ✅ Verifies signed transactions on every subscribe attempt
- ✅ Cross-checks `appAccountToken` against the authenticated user_id (anti-fraud)
- ✅ Maps Apple product IDs to internal plan/interval
- ✅ Upserts the `subscriptions` row with `source='apple'`
- ✅ Receives ongoing notifications (renewals, cancels, refunds) via `/apple-webhook`
- ✅ Updates `current_period_end` on renewal automatically
- ✅ Downgrades to free on expiration / revocation
- ✅ `getUserSubscription()` reads the same row regardless of source — your plan-gating logic works identically for Apple users

---

## Known edge cases (worth designing UX around later)

| Scenario | Current behavior | Recommendation |
|---|---|---|
| User has active Stripe sub, tries to subscribe again via iOS | iOS purchase replaces the row (Stripe sub left orphaned in Stripe) | Show "You're already subscribed via web. Cancel there first" message before initiating IAP |
| User has active Apple sub, tries to subscribe via web | Stripe webhook overwrites the row (Apple sub orphaned) | Same — detect & warn before checkout |
| User uses Family Sharing | `inAppOwnershipType: "FAMILY_SHARED"` — Apple may not bill them | We currently accept it; mark `is_family_shared` if you want to differentiate later |
| Subscription paused (Apple allows users to pause) | Status stays active until pause begins, then `DID_FAIL_TO_RENEW` fires | Treat past_due as free in app, document for support team |

These don't block launch — just be aware.

---

## Status of pieces

| Piece | Status |
|---|---|
| Schema columns for Apple IAP | ✅ Migrated to live DB |
| `apple-subscription-verify` edge function | ✅ Deployed |
| `apple-webhook` edge function | ✅ Deployed |
| JWS signature verification | ✅ In code, uses `jose` library |
| App Store Server API JWT auth | ✅ In code, waits for secrets |
| App Store Connect products created | ⬜ You do this (step 1) |
| Apple secrets set in Supabase | ⬜ You do this (step 4) |
| Webhook URL registered in App Store Connect | ⬜ You do this (step 5) |
| Test notification verified | ⬜ You do this (step 5) |
| iOS app StoreKit 2 code | ⬜ Your iOS team (step 6) |
| Sandbox tests | ⬜ You do this (step 7) |
| App Store submission | ⬜ You do this (step 8) |
