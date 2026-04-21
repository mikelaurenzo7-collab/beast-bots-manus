import { z } from "zod";
import { registerTool } from "../../registry";

/**
 * Shopify Admin API (REST). The user connects via OAuth and we store the
 * shop's access token. The shop domain is stored in the connection's
 * `accountId` column so we can resolve the API host.
 *
 * Docs: https://shopify.dev/docs/api/admin-rest
 */
const API_VERSION = "2024-10";

registerTool({
  name: "shopify.recent_orders",
  label: "Shopify orders",
  provider: "shopify",
  description:
    "List recent Shopify orders. Returns order id, total, line items, customer, financial + fulfillment status. Use for 'how much did I sell this week?' or 'which SKU is moving?'",
  input: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    status: z.enum(["open", "closed", "cancelled", "any"]).optional(),
  }),
  async run({ token, input }) {
    const shop = await resolveShop(token);
    if (!shop) return { ok: false, summary: "Missing Shopify shop domain" };
    const params = new URLSearchParams({
      limit: String(input.limit ?? 25),
      status: input.status ?? "any",
    });
    const res = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/orders.json?${params}`,
      { headers: shopifyHeaders(token) }
    );
    if (!res.ok) return shopifyError(res);
    const data = (await res.json()) as { orders: ShopifyOrder[] };
    return {
      ok: true,
      summary: `${data.orders.length} Shopify orders`,
      data: data.orders.map((o) => ({
        id: o.id,
        name: o.name,
        totalPrice: o.total_price,
        currency: o.currency,
        financialStatus: o.financial_status,
        fulfillmentStatus: o.fulfillment_status,
        customer: o.customer
          ? `${o.customer.first_name ?? ""} ${o.customer.last_name ?? ""}`.trim()
          : null,
        lineItems: (o.line_items ?? []).map((li) => ({
          title: li.title,
          quantity: li.quantity,
          price: li.price,
        })),
        createdAt: o.created_at,
      })),
    };
  },
});

registerTool({
  name: "shopify.low_stock",
  label: "Low-stock inventory",
  provider: "shopify",
  description:
    "Find Shopify product variants whose inventory is at or below a threshold. Useful for reorder alert recipes.",
  input: z.object({
    threshold: z.number().int().min(0).max(1000).optional(),
    limit: z.number().int().min(1).max(250).optional(),
  }),
  async run({ token, input }) {
    const shop = await resolveShop(token);
    if (!shop) return { ok: false, summary: "Missing Shopify shop domain" };
    const params = new URLSearchParams({ limit: String(input.limit ?? 100) });
    const res = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/products.json?${params}`,
      { headers: shopifyHeaders(token) }
    );
    if (!res.ok) return shopifyError(res);
    const data = (await res.json()) as { products: ShopifyProduct[] };
    const threshold = input.threshold ?? 5;
    const low: { product: string; variant: string; sku: string; qty: number }[] = [];
    for (const p of data.products) {
      for (const v of p.variants ?? []) {
        if ((v.inventory_quantity ?? 0) <= threshold) {
          low.push({
            product: p.title,
            variant: v.title,
            sku: v.sku ?? "",
            qty: v.inventory_quantity ?? 0,
          });
        }
      }
    }
    return {
      ok: true,
      summary: `${low.length} variants at/below ${threshold}`,
      data: low,
    };
  },
});

registerTool({
  name: "shopify.sales_summary",
  label: "Sales summary",
  provider: "shopify",
  description:
    "Aggregate revenue and order count for the last N days. Fast daily-digest building block.",
  input: z.object({
    days: z.number().int().min(1).max(90).optional(),
  }),
  async run({ token, input }) {
    const shop = await resolveShop(token);
    if (!shop) return { ok: false, summary: "Missing Shopify shop domain" };
    const days = input.days ?? 7;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const params = new URLSearchParams({
      status: "any",
      created_at_min: since,
      limit: "250",
    });
    const res = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/orders.json?${params}`,
      { headers: shopifyHeaders(token) }
    );
    if (!res.ok) return shopifyError(res);
    const data = (await res.json()) as { orders: ShopifyOrder[] };
    const revenue = data.orders.reduce(
      (sum, o) => sum + Number(o.total_price ?? 0),
      0
    );
    return {
      ok: true,
      summary: `${data.orders.length} orders, $${revenue.toFixed(2)} in last ${days}d`,
      data: { orders: data.orders.length, revenue, days, currency: data.orders[0]?.currency },
    };
  },
});

type ShopifyOrder = {
  id: number;
  name: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer?: { first_name?: string; last_name?: string };
  line_items?: { title: string; quantity: number; price: string }[];
  created_at: string;
};

type ShopifyProduct = {
  title: string;
  variants?: {
    title: string;
    sku?: string;
    inventory_quantity?: number;
  }[];
};

function shopifyHeaders(token: string): Record<string, string> {
  return {
    "X-Shopify-Access-Token": token,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function shopifyError(res: Response) {
  return { ok: false, summary: `Shopify ${res.status}`, error: (await res.text()).slice(0, 256) };
}

/**
 * Shop domain is stored alongside the token. Resolving it requires a DB
 * hit, but because we only have the token here, we lean on an env-style
 * convention: callers can pre-fetch the domain and include it as part of
 * the encrypted blob during OAuth callback. Stub below returns null until
 * the OAuth callback is wired.
 */
async function resolveShop(_token: string): Promise<string | null> {
  return process.env.SHOPIFY_DEFAULT_SHOP ?? null;
}
