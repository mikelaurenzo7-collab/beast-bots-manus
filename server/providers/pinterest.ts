import { ENV } from "../_core/env";
import type { ProviderConfig } from "./index";

/**
 * Pinterest OAuth 2.0. PKCE is supported but not required; we use it because
 * there's no reason not to.
 *
 * Docs: https://developers.pinterest.com/docs/api/v5/authentication
 */
export const pinterestProvider: ProviderConfig = {
  id: "pinterest",
  label: "Pinterest",
  scopes: [
    "boards:read",
    "pins:read",
    "pins:write",
    "user_accounts:read",
  ],
  usesPKCE: true,

  buildAuthorizeUrl({ state, redirectUri, codeChallenge, scopes }) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: ENV.pinterestClientId,
      redirect_uri: redirectUri,
      scope: scopes.join(","),
      state,
      ...(codeChallenge
        ? { code_challenge: codeChallenge, code_challenge_method: "S256" }
        : {}),
    });
    return `https://www.pinterest.com/oauth/?${params.toString()}`;
  },

  async exchangeToken({ code, redirectUri, codeVerifier }) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });
    const basic = Buffer.from(
      `${ENV.pinterestClientId}:${ENV.pinterestClientSecret}`
    ).toString("base64");
    const res = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`Pinterest token exchange ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: data.expires_in,
      scopes: data.scope ? data.scope.split(" ") : undefined,
    };
  },

  async identify(token) {
    const res = await fetch("https://api.pinterest.com/v5/user_account", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { username?: string };
    return { accountName: data.username };
  },
};
