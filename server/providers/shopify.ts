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
      // Store the shop domain as accountId so we can resolve webhook → user.
      accountId: p.shop,
      accountName: data.shop?.name ?? p.shop,
    };
  },

  /**
   * Register webhooks we care about right after a successful connect.
   * Shopify de-duplicates on (address, topic), so this is safe to re-run.
   */
  async postConnect(ctx) {
    if (!ctx.shop || !ctx.publicBaseUrl) return;
    const address = `${ctx.publicBaseUrl}/v1/webhooks/shopify`;
    const topics = [
      "orders/create",
      "orders/cancelled",
      "inventory_levels/update",
      "app/uninstalled",
    ];
    for (const topic of topics) {
      const res = await fetch(
        `https://${ctx.shop}/admin/api/2024-10/webhooks.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": ctx.accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhook: { topic, address, format: "json" },
          }),
        }
      );
      // 201 on create, 422 when already registered (idempotency).
      if (!res.ok && res.status !== 422) {
        // Throwing here would prevent sign-in; caller logs+swallows instead.
        throw new Error(
          `Shopify webhook ${topic} register failed: ${res.status}`
        );
      }
    }
  },
};
