import { randomBytes, createHash } from "node:crypto";
import { ENV } from "./env";

/** State = opaque CSRF/cookie token. 24 bytes of entropy, base64url. */
export function generateState(): string {
  return randomBytes(24).toString("base64url");
}

/** PKCE code_verifier per RFC 7636 (43–128 URL-safe chars). */
export function generateCodeVerifier(): string {
  return randomBytes(48).toString("base64url");
}

/** PKCE S256 challenge = base64url(sha256(code_verifier)). */
export function codeChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Public redirect URI for a provider — must be registered with the provider. */
export function redirectUriFor(providerId: string): string {
  if (!ENV.publicBaseUrl) {
    throw new Error(
      "PUBLIC_BASE_URL must be set so providers can redirect back to us"
    );
  }
  return `${ENV.publicBaseUrl}/v1/oauth/${providerId}/callback`;
}
