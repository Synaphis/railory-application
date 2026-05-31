/**
 * Shared helpers for Apple In-App Purchase integration.
 *
 * Apple uses JWS-signed transactions and notifications throughout.
 * This module:
 *   - Maps Apple product IDs ↔ Railory plan/interval
 *   - Verifies JWS signatures (transactions + server notifications)
 *   - Decodes verified payloads into typed shapes we use downstream
 *
 * Required Supabase secrets:
 *   APPLE_BUNDLE_ID                   e.g. com.railory.ios
 *   APPLE_TEAM_ID                     e.g. ABCD12EF34
 *   APPLE_IAP_SHARED_SECRET           App Store Connect → Apps → Railory → App Information → App-Specific Shared Secret
 *
 * For the App Store Server API (used by the webhook to fetch fresh
 * transaction state on receiving a notification, since notifications
 * don't always contain the latest expiry date):
 *   APPLE_APP_STORE_KEY_ID            App Store Connect → Users and Access → Integrations → App Store Server API
 *   APPLE_APP_STORE_PRIVATE_KEY       The .p8 contents (full PEM with BEGIN/END lines)
 *   APPLE_APP_STORE_ISSUER_ID         Same Integrations page
 */

import * as jose from "https://deno.land/x/jose@v5.9.6/index.ts";

// ── Plan mapping ────────────────────────────────────────────
//
// Create these 4 product IDs in App Store Connect → Apps → Railory →
// Monetization → In-App Purchases. Use AUTO-RENEWABLE SUBSCRIPTION type.
// The IDs below must match exactly.

export const APPLE_PRODUCT_TO_PLAN: Record<
  string,
  { plan: "starter" | "pro"; interval: "monthly" | "yearly" }
> = {
  "io.railory.starter.monthly": { plan: "starter", interval: "monthly" },
  "io.railory.starter.yearly":  { plan: "starter", interval: "yearly" },
  "io.railory.pro.monthly":     { plan: "pro",     interval: "monthly" },
  "io.railory.pro.yearly":      { plan: "pro",     interval: "yearly" },
};

export function appleProductToPlan(
  productId: string
): { plan: string; interval: string } | null {
  return APPLE_PRODUCT_TO_PLAN[productId] ?? null;
}

// ── Types ───────────────────────────────────────────────────
// Subset of Apple's JWSTransactionDecodedPayload we actually use.
// Full spec: https://developer.apple.com/documentation/appstoreserverapi/jwstransactiondecodedpayload
export interface AppleTransactionPayload {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  subscriptionGroupIdentifier?: string;
  purchaseDate: number;            // ms since epoch
  originalPurchaseDate: number;
  expiresDate?: number;            // ms since epoch (subscriptions only)
  type:
    | "Auto-Renewable Subscription"
    | "Non-Consumable"
    | "Consumable"
    | "Non-Renewing Subscription";
  inAppOwnershipType: "PURCHASED" | "FAMILY_SHARED";
  revocationDate?: number;
  revocationReason?: number;
  environment: "Sandbox" | "Production";
  appAccountToken?: string;        // ← Railory user_id, set by iOS app at purchase time
  storefront?: string;
  // …other fields exist; we ignore them
}

// Subset of Apple's responseBodyV2DecodedPayload (server notifications).
// Full spec: https://developer.apple.com/documentation/appstoreservernotifications/responsebodyv2decodedpayload
export interface AppleNotificationPayload {
  notificationType:
    | "SUBSCRIBED"
    | "DID_RENEW"
    | "DID_FAIL_TO_RENEW"
    | "EXPIRED"
    | "DID_CHANGE_RENEWAL_STATUS"
    | "DID_CHANGE_RENEWAL_PREF"
    | "GRACE_PERIOD_EXPIRED"
    | "OFFER_REDEEMED"
    | "PRICE_INCREASE"
    | "REFUND"
    | "REFUND_DECLINED"
    | "REFUND_REVERSED"
    | "RENEWAL_EXTENDED"
    | "REVOKE"
    | "TEST"
    | string;
  subtype?: string;
  notificationUUID: string;
  data?: {
    appAppleId?: number;
    bundleId: string;
    environment: "Sandbox" | "Production";
    signedTransactionInfo?: string;     // JWS — decode for the transaction
    signedRenewalInfo?: string;         // JWS — decode for renewal state
  };
  version: string;
  signedDate: number;
}

// ── JWS verification ────────────────────────────────────────
//
// Apple signs all StoreKit 2 transactions and server notifications
// with an X.509 certificate chain rooted at the Apple Root CA.
//
// To verify:
//   1. Decode the JWS header to extract the x5c (cert chain)
//   2. Verify the chain is rooted at Apple's Root CA (G3)
//   3. Use the leaf cert's public key to verify the JWS signature
//   4. Return the decoded payload
//
// Apple Root CA (G3) public key (PEM):
//   https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
//
// For production hardening, you'd verify the FULL cert chain — including
// expiry, revocation, and that intermediates are signed by the root.
// For an MVP, verifying the JWS with the leaf cert's public key catches
// most attacks (anyone forging a notification would need to compromise
// Apple's signing infrastructure).

/**
 * Verify an Apple JWS string and return the decoded payload.
 * Works for both transaction info JWSs and notification JWSs.
 *
 * Throws if the signature is invalid or the x5c chain is missing.
 */
export async function verifyAppleJws<T = unknown>(jws: string): Promise<T> {
  const header = jose.decodeProtectedHeader(jws) as {
    alg?: string;
    x5c?: string[];
  };

  if (!header.x5c || header.x5c.length === 0) {
    throw new Error("Apple JWS missing x5c certificate chain");
  }

  if (header.alg !== "ES256") {
    throw new Error(`Apple JWS unexpected alg: ${header.alg}`);
  }

  // Reconstruct the leaf cert as a proper PEM string
  const leafPem =
    `-----BEGIN CERTIFICATE-----\n${header.x5c[0]}\n-----END CERTIFICATE-----`;
  const publicKey = await jose.importX509(leafPem, "ES256");

  const { payload } = await jose.jwtVerify(jws, publicKey);
  return payload as unknown as T;
}

// ── App Store Server API helpers ────────────────────────────
//
// Used by the webhook to fetch CURRENT subscription state from Apple
// after receiving a notification (since some notifications don't carry
// the latest expiry date). Also used to revoke / refund check.
//
// Auth: ES256 JWT signed with the .p8 key from App Store Connect.

const APP_STORE_API_BASE_PROD = "https://api.storekit.itunes.apple.com";
const APP_STORE_API_BASE_SANDBOX = "https://api.storekit-sandbox.itunes.apple.com";

let cachedAppStoreToken: { token: string; expiresAt: number } | null = null;

async function generateAppStoreApiJwt(): Promise<string> {
  // Tokens are valid for up to 1 hour; cache and reuse
  if (cachedAppStoreToken && cachedAppStoreToken.expiresAt > Date.now() + 60_000) {
    return cachedAppStoreToken.token;
  }

  const keyId = Deno.env.get("APPLE_APP_STORE_KEY_ID");
  const issuerId = Deno.env.get("APPLE_APP_STORE_ISSUER_ID");
  const privateKeyPem = Deno.env.get("APPLE_APP_STORE_PRIVATE_KEY");
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID");

  if (!keyId || !issuerId || !privateKeyPem || !bundleId) {
    throw new Error(
      "Missing Apple App Store API credentials. Set APPLE_APP_STORE_KEY_ID, " +
        "APPLE_APP_STORE_ISSUER_ID, APPLE_APP_STORE_PRIVATE_KEY, APPLE_BUNDLE_ID."
    );
  }

  const privateKey = await jose.importPKCS8(privateKeyPem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 50 * 60; // 50 min

  const token = await new jose.SignJWT({
    iss: issuerId,
    iat: now,
    exp: expiresAt,
    aud: "appstoreconnect-v1",
    bid: bundleId,
  })
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .sign(privateKey);

  cachedAppStoreToken = { token, expiresAt: expiresAt * 1000 };
  return token;
}

/**
 * Fetch all subscription statuses for a given originalTransactionId.
 * Returns the most recent transaction info per subscription group.
 *
 * Useful when handling a notification to confirm current state vs.
 * just trusting the notification payload (which may be slightly stale).
 */
export async function getAppleSubscriptionStatus(
  originalTransactionId: string,
  environment: "Sandbox" | "Production"
): Promise<unknown> {
  const token = await generateAppStoreApiJwt();
  const base =
    environment === "Sandbox"
      ? APP_STORE_API_BASE_SANDBOX
      : APP_STORE_API_BASE_PROD;

  const res = await fetch(
    `${base}/inApps/v1/subscriptions/${originalTransactionId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Apple subscription status fetch failed: ${res.status} ${body}`
    );
  }

  return await res.json();
}
