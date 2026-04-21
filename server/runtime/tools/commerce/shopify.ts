import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { registerTool } from "../../registry";
import { getDb } from "../../../db";
import { oauthConnections } from "../../../../drizzle/schema";

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
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
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
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
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
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
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

// ─── Expanded capabilities ─────────────────────────────────────────────────

registerTool({
  name: "shopify.abandoned_checkouts",
  label: "Abandoned checkouts",
  provider: "shopify",
  description:
    "List checkouts the buyer started but didn't complete. Use for cart-recovery drafts (propose an email / discount code).",
  input: z.object({
    limit: z.number().int().min(1).max(250).optional(),
  }),
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
    if (!shop) return { ok: false, summary: "Missing Shopify shop domain" };
    const params = new URLSearchParams({ limit: String(input.limit ?? 25) });
    const res = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/checkouts.json?${params}`,
      { headers: shopifyHeaders(token) }
    );
    if (!res.ok) return shopifyError(res);
    const data = (await res.json()) as {
      checkouts: {
        id: number;
        email?: string;
        total_price?: string;
        currency?: string;
        line_items?: { title: string; quantity: number }[];
        abandoned_checkout_url?: string;
        created_at?: string;
      }[];
    };
    return {
      ok: true,
      summary: `${data.checkouts.length} abandoned checkouts`,
      data: data.checkouts.map((c) => ({
        id: c.id,
        email: c.email,
        totalPrice: c.total_price,
        currency: c.currency,
        recoveryUrl: c.abandoned_checkout_url,
        itemCount: c.line_items?.length ?? 0,
        createdAt: c.created_at,
      })),
    };
  },
});

registerTool({
  name: "shopify.get_customer",
  label: "Get customer",
  provider: "shopify",
  description:
    "Look up a customer by email or id. Returns purchase count, lifetime value, tags, state. Use before drafting outreach or support replies.",
  input: z.object({
    email: z.string().email().optional(),
    customerId: z.number().int().optional(),
  }),
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
    if (!shop) return { ok: false, summary: "Missing Shopify shop domain" };
    if (!input.email && !input.customerId) {
      return { ok: false, summary: "Provide email or customerId" };
    }
    const url = input.customerId
      ? `https://${shop}/admin/api/${API_VERSION}/customers/${input.customerId}.json`
      : `https://${shop}/admin/api/${API_VERSION}/customers/search.json?query=${encodeURIComponent(
          "email:" + input.email
        )}`;
    const res = await fetch(url, { headers: shopifyHeaders(token) });
    if (!res.ok) return shopifyError(res);
    const data = (await res.json()) as {
      customer?: ShopifyCustomer;
      customers?: ShopifyCustomer[];
    };
    const c = data.customer ?? data.customers?.[0];
    if (!c) return { ok: false, summary: "Customer not found" };
    return {
      ok: true,
      summary: `${c.email ?? c.id} — ${c.orders_count ?? 0} orders, ${c.currency ?? ""}${c.total_spent ?? "0"}`,
      data: {
        id: c.id,
        email: c.email,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
        ordersCount: c.orders_count,
        totalSpent: c.total_spent,
        currency: c.currency,
        tags: c.tags,
        state: c.state,
      },
    };
  },
});

registerTool({
  name: "shopify.create_discount_code",
  label: "Create discount code",
  provider: "shopify",
  description:
    "Create a percentage-off discount code (e.g. 'COMEBACK10' for 10% off). ALWAYS confirm code, percent, and usage cap with the user before calling.",
  input: z.object({
    code: z.string().min(3).max(64),
    percentage: z.number().int().min(1).max(90),
    usageLimit: z.number().int().min(1).max(100000).optional(),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  }),
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
    if (!shop) return { ok: false, summary: "Missing Shopify shop domain" };

    const endsAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : undefined;
    const ruleRes = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/price_rules.json`,
      {
        method: "POST",
        headers: shopifyHeaders(token),
        body: JSON.stringify({
          price_rule: {
            title: input.code,
            target_type: "line_item",
            target_selection: "all",
            allocation_method: "across",
            value_type: "percentage",
            value: `-${input.percentage}`,
            customer_selection: "all",
            starts_at: new Date().toISOString(),
            ends_at: endsAt,
            usage_limit: input.usageLimit,
          },
        }),
      }
    );
    if (!ruleRes.ok) return shopifyError(ruleRes);
    const rule = (await ruleRes.json()) as { price_rule: { id: number } };

    const codeRes = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/price_rules/${rule.price_rule.id}/discount_codes.json`,
      {
        method: "POST",
        headers: shopifyHeaders(token),
        body: JSON.stringify({ discount_code: { code: input.code } }),
      }
    );
    if (!codeRes.ok) return shopifyError(codeRes);
    return {
      ok: true,
      summary: `Created code ${input.code} — ${input.percentage}% off${
        input.usageLimit ? ` (max ${input.usageLimit} uses)` : ""
      }`,
      data: { code: input.code, priceRuleId: rule.price_rule.id },
    };
  },
});

registerTool({
  name: "shopify.create_fulfillment",
  label: "Fulfill order",
  provider: "shopify",
  description:
    "Mark a Shopify order as shipped. Optionally include tracking number + carrier. ALWAYS confirm orderId + tracking info before calling.",
  input: z.object({
    orderId: z.number().int(),
    trackingNumber: z.string().optional(),
    trackingCompany: z.string().optional(),
    notifyCustomer: z.boolean().optional(),
  }),
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
    if (!shop) return { ok: false, summary: "Missing Shopify shop domain" };

    const foRes = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/orders/${input.orderId}/fulfillment_orders.json`,
      { headers: shopifyHeaders(token) }
    );
    if (!foRes.ok) return shopifyError(foRes);
    const { fulfillment_orders } = (await foRes.json()) as {
      fulfillment_orders: { id: number }[];
    };
    if (fulfillment_orders.length === 0) {
      return { ok: false, summary: "No fulfillable line items on this order" };
    }

    const body = {
      fulfillment: {
        line_items_by_fulfillment_order: fulfillment_orders.map((fo) => ({
          fulfillment_order_id: fo.id,
        })),
        notify_customer: input.notifyCustomer ?? true,
        ...(input.trackingNumber
          ? {
              tracking_info: {
                number: input.trackingNumber,
                company: input.trackingCompany,
              },
            }
          : {}),
      },
    };

    const res = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/fulfillments.json`,
      {
        method: "POST",
        headers: shopifyHeaders(token),
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) return shopifyError(res);
    return {
      ok: true,
      summary: `Fulfilled order #${input.orderId}${
        input.trackingNumber ? ` — tracking ${input.trackingNumber}` : ""
      }`,
    };
  },
});

registerTool({
  name: "shopify.list_products",
  label: "List products",
  provider: "shopify",
  description:
    "Browse the catalog. Returns title, vendor, inventory, min/max price. Use before drafting marketing or surfacing what's in stock.",
  input: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    title: z.string().optional().describe("Optional fuzzy title filter"),
  }),
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
    if (!shop) return { ok: false, summary: "Missing Shopify shop domain" };
    const params = new URLSearchParams({
      limit: String(input.limit ?? 25),
      ...(input.title ? { title: input.title } : {}),
    });
    const res = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/products.json?${params}`,
      { headers: shopifyHeaders(token) }
    );
    if (!res.ok) return shopifyError(res);
    const data = (await res.json()) as { products: ShopifyProduct[] };
    return {
      ok: true,
      summary: `${data.products.length} products`,
      data: data.products.map((p) => {
        const prices = (p.variants ?? [])
          .map((v) => Number(v.price ?? 0))
          .filter((n) => Number.isFinite(n) && n > 0);
        const inventory = (p.variants ?? []).reduce(
          (sum, v) => sum + (v.inventory_quantity ?? 0),
          0
        );
        return {
          title: p.title,
          vendor: p.vendor,
          inventory,
          minPrice: prices.length ? Math.min(...prices) : null,
          maxPrice: prices.length ? Math.max(...prices) : null,
          variantCount: p.variants?.length ?? 0,
        };
      }),
    };
  },
});

// ─── Types ────────────────────────────────────────────────────────────────

type ShopifyCustomer = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  orders_count?: number;
  total_spent?: string;
  currency?: string;
  tags?: string;
  state?: string;
};

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
  vendor?: string;
  variants?: {
    title: string;
    sku?: string;
    price?: string;
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
 * Resolve the shop domain for this user's Shopify connection. Populated by
 * `shopifyProvider.identify()` during OAuth — we store the shop as
 * `oauth_connections.accountId`. Cached per-process to cut DB chatter.
 */
const shopCache = new Map<number, { shop: string; at: number }>();
const SHOP_TTL_MS = 5 * 60 * 1000;

async function resolveShop(userId: number): Promise<string | null> {
  const cached = shopCache.get(userId);
  if (cached && Date.now() - cached.at < SHOP_TTL_MS) return cached.shop;

  const [row] = await getDb()
    .select({ accountId: oauthConnections.accountId })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, "shopify")
      )
    )
    .limit(1);

  if (!row?.accountId) return null;
  shopCache.set(userId, { shop: row.accountId, at: Date.now() });
  return row.accountId;
}
