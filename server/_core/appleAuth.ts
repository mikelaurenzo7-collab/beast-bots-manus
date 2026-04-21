import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { ENV } from "./env";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = new URL("https://appleid.apple.com/auth/keys");

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function jwks() {
  if (!cachedJwks) cachedJwks = createRemoteJWKSet(APPLE_JWKS_URL);
  return cachedJwks;
}

export type AppleIdentity = {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  isPrivateEmail?: boolean;
};

/**
 * Verify an Apple identity token from `ASAuthorizationAppleIDCredential.identityToken`.
 *
 * Checks: signature against Apple's JWKS, iss == appleid.apple.com, aud == our bundle id.
 * Throws on any failure.
 */
export async function verifyAppleIdentityToken(
  identityToken: string
): Promise<AppleIdentity> {
  if (!ENV.appleClientId) {
    throw new Error("APPLE_CLIENT_ID is not configured");
  }
  const { payload } = await jwtVerify(identityToken, jwks(), {
    issuer: APPLE_ISSUER,
    audience: ENV.appleClientId,
  });

  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error("Apple token missing sub claim");
  }

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    emailVerified:
      typeof payload.email_verified === "boolean"
        ? payload.email_verified
        : payload.email_verified === "true",
    isPrivateEmail:
      typeof payload.is_private_email === "boolean"
        ? payload.is_private_email
        : payload.is_private_email === "true",
  };
}

export type SessionClaims = {
  sub: string;
  uid: number;
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function secretKey() {
  if (!ENV.jwtSecret || ENV.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 chars");
  }
  return new TextEncoder().encode(ENV.jwtSecret);
}

/** Mint a bearer JWT the iOS app stores in Keychain and sends as Authorization. */
export async function signSession(claims: SessionClaims): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ uid: claims.uid })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ONE_YEAR_SECONDS)
    .sign(secretKey());
}

/** Verify a bearer token issued by signSession. */
export async function verifySession(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: ["HS256"],
  });
  if (typeof payload.sub !== "string" || typeof payload.uid !== "number") {
    throw new Error("Malformed session token");
  }
  return { sub: payload.sub, uid: payload.uid };
}
