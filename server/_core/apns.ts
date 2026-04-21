import { connect as http2Connect, type ClientHttp2Session } from "node:http2";
import { SignJWT, importPKCS8 } from "jose";
import { ENV } from "./env";
import { listDeviceTokens } from "../db";
import { logger } from "./logger";

/**
 * APNs HTTP/2 client using token-based auth (ES256-signed JWT).
 *
 * Design:
 *   - One long-lived h2 session per environment (sandbox/production).
 *   - Cached provider JWT, rotated every 50 minutes (Apple says ≤ 1 hour).
 *   - sendPush() fans out to every device token for a given user.
 *
 * If APNs env isn't configured, sendPush becomes a no-op (dev-friendly).
 */

const SANDBOX_HOST = "https://api.sandbox.push.apple.com";
const PROD_HOST = "https://api.push.apple.com";
const JWT_TTL_MS = 50 * 60 * 1000;

let cachedJwt: { token: string; exp: number } | null = null;
const sessions = new Map<string, ClientHttp2Session>();

async function providerToken(): Promise<string> {
  if (cachedJwt && cachedJwt.exp > Date.now()) return cachedJwt.token;

  const { appleTeamId, appleKeyId, applePrivateKey } = ENV;
  if (!appleTeamId || !appleKeyId || !applePrivateKey) {
    throw new Error(
      "APNs not configured — set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY"
    );
  }

  const pem = applePrivateKey.includes("BEGIN PRIVATE KEY")
    ? applePrivateKey
    : `-----BEGIN PRIVATE KEY-----\n${applePrivateKey}\n-----END PRIVATE KEY-----`;
  const key = await importPKCS8(pem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ iss: appleTeamId, iat: now })
    .setProtectedHeader({ alg: "ES256", kid: appleKeyId })
    .sign(key);

  cachedJwt = { token, exp: Date.now() + JWT_TTL_MS };
  return token;
}

function getSession(environment: "sandbox" | "production"): ClientHttp2Session {
  const host = environment === "production" ? PROD_HOST : SANDBOX_HOST;
  let s = sessions.get(host);
  if (!s || s.closed || s.destroyed) {
    s = http2Connect(host);
    s.on("error", (err) => logger.warn("APNs session error", { host, err: String(err) }));
    sessions.set(host, s);
  }
  return s;
}

export type PushPayload = {
  title?: string;
  body: string;
  badge?: number;
  sound?: string;
  /** Arbitrary key/value bundle available in `userInfo` on the iOS side. */
  data?: Record<string, string | number>;
};

export function isApnsConfigured(): boolean {
  return Boolean(ENV.appleTeamId && ENV.appleKeyId && ENV.applePrivateKey);
}

/**
 * Send the same alert to every device this user has registered.
 * Returns the number of successful deliveries.
 */
export async function sendPushToUser(
  userId: number,
  payload: PushPayload
): Promise<number> {
  if (!isApnsConfigured()) {
    logger.debug("APNs not configured; skipping push", { userId });
    return 0;
  }

  const devices = await listDeviceTokens(userId);
  if (devices.length === 0) return 0;

  const jwt = await providerToken();
  const body = JSON.stringify({
    aps: {
      alert: payload.title
        ? { title: payload.title, body: payload.body }
        : payload.body,
      sound: payload.sound ?? "default",
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    },
    ...(payload.data ?? {}),
  });

  let ok = 0;
  await Promise.all(
    devices.map(async (d) => {
      try {
        const success = await sendOne({
          deviceToken: d.deviceToken,
          bundleId: d.bundleId || ENV.apnsBundleId,
          environment: d.environment,
          providerToken: jwt,
          body,
        });
        if (success) ok++;
      } catch (err) {
        logger.warn("APNs send failed", { deviceToken: d.deviceToken, err: String(err) });
      }
    })
  );
  return ok;
}

function sendOne(p: {
  deviceToken: string;
  bundleId: string;
  environment: "sandbox" | "production";
  providerToken: string;
  body: string;
}): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const session = getSession(p.environment);
    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${p.deviceToken}`,
      "apns-topic": p.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      authorization: `bearer ${p.providerToken}`,
      "content-type": "application/json",
    });

    let status = 0;
    let chunks = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"]) || 0;
    });
    req.on("data", (chunk) => (chunks += chunk));
    req.on("end", () => {
      if (status === 200) return resolve(true);
      logger.warn("APNs rejected", { status, body: chunks.slice(0, 256) });
      resolve(false);
    });
    req.on("error", reject);
    req.end(p.body);
  });
}
