import { ENV } from "../_core/env";
import type { ProviderConfig } from "./index";

/**
 * Etsy OAuth 2.0 with PKCE (required). Uses the Etsy keystring as client_id.
 *
 * Docs: https://developers.etsy.com/documentation/essentials/authentication
 */
export const etsyProvider: ProviderConfig = {
  id: "etsy",
  label: "Etsy",
  scopes: [
    "listings_r",
    "shops_r",
    "transactions_r",
    "transactions_w",
    "email_r",
  ],
  usesPKCE: true,

  buildAuthorizeUrl({ state, redirectUri, codeChallenge, scopes }) {
    if (!codeChallenge) throw new Error("Etsy requires PKCE code_challenge");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: ENV.etsyKeystring,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return `https://www.etsy.com/oauth/connect?${params.toString()}`;
  },

  async exchangeToken({ code, redirectUri, codeVerifier }) {
    if (!codeVerifier) throw new Error("Etsy requires PKCE code_verifier");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ENV.etsyKeystring,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    });
    const res = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`Etsy token exchange ${res.status}: ${await res.text()}`);
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
    // Etsy's /users/me returns shop_id + login_name.
    const res = await fetch("https://openapi.etsy.com/v3/application/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": ENV.etsyKeystring,
        Accept: "application/json",
      },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { shop_id?: number; login_name?: string };
    return {
      accountId: data.shop_id ? String(data.shop_id) : undefined,
      accountName: data.login_name,
    };
  },
};
