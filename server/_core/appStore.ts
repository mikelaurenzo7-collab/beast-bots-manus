import { SignJWT, importPKCS8 } from "jose";
import { ENV } from "./env";

/**
 * App Store Server API client (for StoreKit 2 / iOS IAP).
 *
 * Verifies iOS IAP transactions server-side by calling Apple's API, which
 * returns signed JWS transaction + subscription payloads. We trust HTTPS
 * for transport and parse the JWS payload without verifying the signature
 * ourselves — Apple's x5c cert-chain verification is a project of its own,
 * and the API response is already authenticated by the TLS connection to
 * api.storekit.itunes.apple.com.
 *
 * Docs: https://developer.apple.com/documentation/appstoreserverapi
 */

const SANDBOX = "https://api.storekit-sandbox.itunes.apple.com";
const PRODUCTION = "https://api.storekit.itunes.apple.com";
const JWT_TTL_MS = 50 * 60 * 1000;

let cachedJwt: { token: string; exp: number } | null = null;

async function providerToken(): Promise<string> {
  if (cachedJwt && cachedJwt.exp > Date.now()) return cachedJwt.token;

  const { appStoreIssuerId, appStoreKeyId, appStorePrivateKey, appStoreBundleId } = ENV;
  if (!appStoreIssuerId || !appStoreKeyId || !appStorePrivateKey) {
    throw new Error(
      "App Store Server API not configured — set APPSTORE_ISSUER_ID, APPSTORE_KEY_ID, APPSTORE_PRIVATE_KEY"
    );
  }
  if (!appStoreBundleId) {
    throw new Error("APPSTORE_BUNDLE_ID (or APPLE_CLIENT_ID) must be set");
  }

  const pem = appStorePrivateKey.includes("BEGIN PRIVATE KEY")
    ? appStorePrivateKey
    : `-----BEGIN PRIVATE KEY-----\n${appStorePrivateKey}\n-----END PRIVATE KEY-----`;
  const key = await importPKCS8(pem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    iss: appStoreIssuerId,
    iat: now,
    exp: now + 50 * 60,
    aud: "appstoreconnect-v1",
    bid: appStoreBundleId,
  })
    .setProtectedHeader({ alg: "ES256", kid: appStoreKeyId, typ: "JWT" })
    .sign(key);

  cachedJwt = { token, exp: Date.now() + JWT_TTL_MS };
  return token;
}

function apiHost(): string {
  return ENV.appStoreEnvironment === "production" ? PRODUCTION : SANDBOX;
}

export function isAppStoreConfigured(): boolean {
  return Boolean(
    ENV.appStoreIssuerId &&
      ENV.appStoreKeyId &&
      ENV.appStorePrivateKey &&
      ENV.appStoreBundleId
  );
}

export type AppStoreSubscription = {
  productId: string;
  status: number; // 1=active, 2=expired, 3=retry billing, 4=grace, 5=revoked
  expiresDate?: number; // epoch ms
  autoRenewStatus?: number; // 0|1
  environment?: string;
  originalTransactionId?: string;
};

/**
 * Look up the caller's current subscription state for a given transactionId
 * (the one iOS just completed). Picks the "most relevant" status line and
 * decodes its JWS payload — good enough for our Pro/Free gating.
 */
export async function fetchSubscriptionStatus(
  transactionId: string
): Promise<AppStoreSubscription | null> {
  const res = await fetch(
    `${apiHost()}/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`,
    { headers: { Authorization: `Bearer ${await providerToken()}` } }
  );
  if (!res.ok) {
    throw new Error(
      `App Store Server ${res.status}: ${await res.text().catch(() => "")}`
    );
  }
  const data = (await res.json()) as {
    data?: Array<{
      lastTransactions: Array<{
        status: number;
        signedRenewalInfo?: string;
        signedTransactionInfo?: string;
      }>;
    }>;
  };

  for (const group of data.data ?? []) {
    for (const tx of group.lastTransactions ?? []) {
      const payload = tx.signedTransactionInfo
        ? decodeJwsPayload<{
            productId: string;
            expiresDate?: number;
            originalTransactionId?: string;
            environment?: string;
          }>(tx.signedTransactionInfo)
        : null;
      const renewal = tx.signedRenewalInfo
        ? decodeJwsPayload<{ autoRenewStatus?: number }>(tx.signedRenewalInfo)
        : null;
      if (!payload) continue;
      return {
        productId: payload.productId,
        status: tx.status,
        expiresDate: payload.expiresDate,
        autoRenewStatus: renewal?.autoRenewStatus,
        environment: payload.environment,
        originalTransactionId: payload.originalTransactionId,
      };
    }
  }
  return null;
}

/**
 * Decode a JWS compact-serialization payload without verifying. Callers must
 * already trust the transport (HTTPS to Apple, or a HMAC-verified webhook).
 */
export function decodeJwsPayload<T>(jws: string): T {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWS");
  const json = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(json) as T;
}

export type DecodedNotification = {
  notificationType: string;
  subtype?: string;
  data?: {
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
  summary?: Record<string, unknown>;
};

/** Decode an App Store Server Notifications V2 signedPayload. */
export function decodeServerNotification(signedPayload: string): DecodedNotification {
  return decodeJwsPayload<DecodedNotification>(signedPayload);
}
