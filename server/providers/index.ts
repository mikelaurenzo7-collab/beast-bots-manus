/**
 * OAuth provider registry. Each Money Bot that needs an external account
 * declares its provider here. Generic OAuth machinery lives in
 * server/_core/oauth.ts; this file is just configuration.
 *
 * To add a new provider:
 *   1. Add a config object below.
 *   2. Add its client_id / client_secret to .env and server/_core/env.ts.
 *   3. Register the bot + its tools in shared/bots.ts and server/runtime/tools/.
 */

export type AuthorizeUrlParams = {
  state: string;
  redirectUri: string;
  codeChallenge?: string;
  shop?: string;
  scopes: string[];
};

export type TokenExchangeParams = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  shop?: string;
};

export type TokenExchangeResult = {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  scopes?: string[];
};

export type IdentifyResult = {
  accountId?: string;
  accountName?: string;
};

export type PostConnectContext = {
  userId: number;
  accessToken: string;
  accountId?: string;
  shop?: string;
  publicBaseUrl: string;
};

export type ProviderConfig = {
  id: string;
  label: string;
  scopes: string[];
  /** True when the provider uses PKCE (code_verifier + code_challenge). */
  usesPKCE: boolean;
  /**
   * True for providers like Shopify where the host domain is per-merchant.
   * Start flow requires an additional `shop` parameter.
   */
  requiresShop?: boolean;
  /** Builds the provider's authorization URL for a given start request. */
  buildAuthorizeUrl: (p: AuthorizeUrlParams) => string;
  /** Exchanges the code returned by the provider for a token. */
  exchangeToken: (p: TokenExchangeParams) => Promise<TokenExchangeResult>;
  /** Optionally resolves account id / display name after token exchange. */
  identify?: (token: string, p: TokenExchangeParams) => Promise<IdentifyResult>;
  /**
   * Called after a successful connect. Use this to register webhooks or
   * pre-warm caches. Errors here are logged, not fatal.
   */
  postConnect?: (ctx: PostConnectContext) => Promise<void>;
  /**
   * Refresh the access token using a stored refresh_token. Return undefined
   * when the provider has no refresh flow (e.g. Shopify permanent tokens).
   */
  refresh?: (refreshToken: string) => Promise<TokenExchangeResult | undefined>;
};

import { shopifyProvider } from "./shopify";
import { etsyProvider } from "./etsy";
import { pinterestProvider } from "./pinterest";

const REGISTRY = new Map<string, ProviderConfig>();
REGISTRY.set(shopifyProvider.id, shopifyProvider);
REGISTRY.set(etsyProvider.id, etsyProvider);
REGISTRY.set(pinterestProvider.id, pinterestProvider);

export function getProvider(id: string): ProviderConfig | undefined {
  return REGISTRY.get(id);
}

export function listProviders(): ProviderConfig[] {
  return Array.from(REGISTRY.values());
}
