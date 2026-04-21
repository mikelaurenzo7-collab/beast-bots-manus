import { ENV } from "../_core/env";
import type { ProviderConfig } from "./index";

/**
 * Shopify OAuth is per-shop. The authorize/token endpoints are on the
 * merchant's own myshopify.com host, so the `shop` parameter must be
 * validated (prevent open-redirect / SSRF).
 *
 * Docs: https://shopify.dev/docs/apps/build/authentication-authorization
 */
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

function assertShop(shop: string | undefined): asserts shop is string {
  if (!shop || !SHOP_DOMAIN.test(shop)) {
    throw new Error("Invalid Shopify shop domain");
  }
}

export const shopifyProvider: ProviderConfig = {
  id: "shopify",
  label: "Shopify",
  scopes: [
    "read_orders",
    "read_products",
    "read_inventory",
    "read_customers",
  ],
  usesPKCE: false,
  requiresShop: true,

  buildAuthorizeUrl({ state, redirectUri, shop, scopes }) {
    assertShop(shop);
    const params = new URLSearchParams({
      client_id: ENV.shopifyClientId,
      scope: scopes.join(","),
      redirect_uri: redirectUri,
      state,
      "grant_options[]": "",
    });
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  },

  async exchangeToken({ code, shop }) {
    assertShop(shop);
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: ENV.shopifyClientId,
        client_secret: ENV.shopifyClientSecret,
        code,
      }),
    });
    if (!res.ok) {
      throw new Error(`Shopify token exchange ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token: string; scope?: string };
    return {
      accessToken: data.access_token,
      scopes: data.scope ? data.scope.split(",") : undefined,
    };
  },

  async identify(token, p) {
    assertShop(p.shop);
    const res = await fetch(`https://${p.shop}/admin/api/2024-10/shop.json`, {
      headers: { "X-Shopify-Access-Token": token, Accept: "application/json" },
    });
    if (!res.ok) return { accountId: p.shop };
    const data = (await res.json()) as { shop?: { id?: number; name?: string } };
    return {
      accountId: data.shop?.id ? String(data.shop.id) : p.shop,
      accountName: data.shop?.name ?? p.shop,
    };
  },
};
