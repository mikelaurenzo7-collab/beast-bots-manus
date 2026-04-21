import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { registerTool } from "../../registry";
import { getDb } from "../../../db";
import { oauthConnections } from "../../../../drizzle/schema";

/**
 * Etsy Open API v3. User connects via OAuth (scopes: listings_r, shops_r,
 * transactions_r, transactions_w, email_r). The user's internal `shop_id`
 * is stored in `oauth_connections.accountId` during the callback.
 *
 * Docs: https://developers.etsy.com/documentation/
 */
const BASE = "https://openapi.etsy.com/v3/application";

registerTool({
  name: "etsy.recent_receipts",
  label: "Etsy receipts",
  provider: "etsy",
  description:
    "List recent Etsy receipts (sales). Returns grandtotal, buyer, items, tracking status. Use for daily sales digests.",
  input: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    wasPaid: z.boolean().optional(),
    wasShipped: z.boolean().optional(),
  }),
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
    if (!shop) return { ok: false, summary: "Missing Etsy shop id" };
    const params = new URLSearchParams({ limit: String(input.limit ?? 25) });
    if (input.wasPaid !== undefined) params.set("was_paid", String(input.wasPaid));
    if (input.wasShipped !== undefined) params.set("was_shipped", String(input.wasShipped));

    const res = await fetch(`${BASE}/shops/${shop}/receipts?${params}`, {
      headers: etsyHeaders(token),
    });
    if (!res.ok) return etsyError(res);
    const data = (await res.json()) as { count: number; results: EtsyReceipt[] };
    return {
      ok: true,
      summary: `${data.results.length} Etsy receipts`,
      data: data.results.map((r) => ({
        receiptId: r.receipt_id,
        buyer: r.name,
        grandTotal: r.grandtotal?.amount
          ? `${(r.grandtotal.amount / r.grandtotal.divisor).toFixed(2)} ${r.grandtotal.currency_code}`
          : null,
        wasPaid: r.is_paid,
        wasShipped: r.is_shipped,
        createdAt: r.create_timestamp
          ? new Date(r.create_timestamp * 1000).toISOString()
          : null,
      })),
    };
  },
});

registerTool({
  name: "etsy.listings_need_attention",
  label: "Listings needing attention",
  provider: "etsy",
  description:
    "Find Etsy listings that are either about to expire (within 30 days) or out of stock. Perfect for renewal / restock recipes.",
  input: z.object({
    expiresInDays: z.number().int().min(1).max(90).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
    if (!shop) return { ok: false, summary: "Missing Etsy shop id" };
    const res = await fetch(
      `${BASE}/shops/${shop}/listings/active?limit=${input.limit ?? 100}`,
      { headers: etsyHeaders(token) }
    );
    if (!res.ok) return etsyError(res);
    const data = (await res.json()) as { results: EtsyListing[] };
    const cutoff = Date.now() + (input.expiresInDays ?? 30) * 86_400_000;
    const flagged = data.results
      .filter(
        (l) =>
          (l.quantity ?? 0) === 0 ||
          (l.ending_timestamp && l.ending_timestamp * 1000 <= cutoff)
      )
      .map((l) => ({
        listingId: l.listing_id,
        title: l.title,
        quantity: l.quantity,
        state: l.state,
        endsAt: l.ending_timestamp
          ? new Date(l.ending_timestamp * 1000).toISOString()
          : null,
        url: l.url,
      }));
    return {
      ok: true,
      summary: `${flagged.length} listings need attention`,
      data: flagged,
    };
  },
});

// ─── Expanded capabilities ─────────────────────────────────────────────────

registerTool({
  name: "etsy.renew_listing",
  label: "Renew Etsy listing",
  provider: "etsy",
  description:
    "Renew an Etsy listing before it expires. Costs $0.20 per renewal. ALWAYS confirm the listingId and cost with the user first.",
  input: z.object({ listingId: z.number().int() }),
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
    if (!shop) return { ok: false, summary: "Missing Etsy shop id" };
    const res = await fetch(
      `${BASE}/shops/${shop}/listings/${input.listingId}`,
      {
        method: "PUT",
        headers: { ...etsyHeaders(token), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ state: "active" }),
      }
    );
    if (!res.ok) return etsyError(res);
    return {
      ok: true,
      summary: `Renewed listing ${input.listingId} (charges $0.20)`,
    };
  },
});

registerTool({
  name: "etsy.list_reviews",
  label: "Recent reviews",
  provider: "etsy",
  description:
    "List recent reviews on the user's Etsy shop. Returns rating + text so the agent can triage and draft replies.",
  input: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    minRating: z.number().int().min(1).max(5).optional(),
    maxRating: z.number().int().min(1).max(5).optional(),
  }),
  async run({ userId, token, input }) {
    const shop = await resolveShop(userId);
    if (!shop) return { ok: false, summary: "Missing Etsy shop id" };
    const params = new URLSearchParams({ limit: String(input.limit ?? 25) });
    if (input.minRating) params.set("min_created", "0");
    const res = await fetch(`${BASE}/shops/${shop}/reviews?${params}`, {
      headers: etsyHeaders(token),
    });
    if (!res.ok) return etsyError(res);
    const data = (await res.json()) as {
      results: {
        rating: number;
        review?: string;
        buyer_user_id: number;
        transaction_id: number;
        create_timestamp?: number;
      }[];
    };
    let rows = data.results;
    if (input.minRating) rows = rows.filter((r) => r.rating >= input.minRating!);
    if (input.maxRating) rows = rows.filter((r) => r.rating <= input.maxRating!);
    return {
      ok: true,
      summary: `${rows.length} reviews` +
        (input.maxRating && input.maxRating < 4 ? ` (at-risk: ≤${input.maxRating}★)` : ""),
      data: rows.map((r) => ({
        rating: r.rating,
        text: r.review,
        transactionId: r.transaction_id,
        createdAt: r.create_timestamp
          ? new Date(r.create_timestamp * 1000).toISOString()
          : null,
      })),
    };
  },
});

registerTool({
  name: "etsy.shop_stats",
  label: "Shop stats",
  provider: "etsy",
  description:
    "Key metrics for the user's Etsy shop: active listings count, num_favorers, url. Good for a weekly digest header.",
  input: z.object({}),
  async run({ userId, token }) {
    const shop = await resolveShop(userId);
    if (!shop) return { ok: false, summary: "Missing Etsy shop id" };
    const res = await fetch(`${BASE}/shops/${shop}`, { headers: etsyHeaders(token) });
    if (!res.ok) return etsyError(res);
    const data = (await res.json()) as {
      shop_name?: string;
      listing_active_count?: number;
      num_favorers?: number;
      url?: string;
      currency_code?: string;
      transaction_sold_count?: number;
      review_count?: number;
      review_average?: number;
    };
    return {
      ok: true,
      summary: `${data.shop_name ?? shop}: ${data.listing_active_count ?? 0} active listings, ${data.num_favorers ?? 0} favorers, ${data.review_average?.toFixed(2) ?? "—"}★`,
      data: {
        name: data.shop_name,
        activeListings: data.listing_active_count,
        favorers: data.num_favorers,
        soldTotal: data.transaction_sold_count,
        reviewCount: data.review_count,
        reviewAverage: data.review_average,
        url: data.url,
      },
    };
  },
});

type EtsyReceipt = {
  receipt_id: number;
  name: string;
  is_paid: boolean;
  is_shipped: boolean;
  create_timestamp?: number;
  grandtotal?: { amount: number; divisor: number; currency_code: string };
};

type EtsyListing = {
  listing_id: number;
  title: string;
  quantity?: number;
  state?: string;
  ending_timestamp?: number;
  url?: string;
};

function etsyHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "x-api-key": process.env.ETSY_KEYSTRING ?? "",
    Accept: "application/json",
  };
}

async function etsyError(res: Response) {
  return { ok: false, summary: `Etsy ${res.status}`, error: (await res.text()).slice(0, 256) };
}

/**
 * Resolve the shop_id from the user's Etsy connection. Populated during
 * OAuth in etsyProvider.identify() — stored as oauth_connections.accountId.
 */
const shopCache = new Map<number, { id: string; at: number }>();
const SHOP_TTL_MS = 5 * 60 * 1000;

async function resolveShop(userId: number): Promise<string | null> {
  const cached = shopCache.get(userId);
  if (cached && Date.now() - cached.at < SHOP_TTL_MS) return cached.id;
  const [row] = await getDb()
    .select({ accountId: oauthConnections.accountId })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, "etsy")
      )
    )
    .limit(1);
  if (!row?.accountId) return null;
  shopCache.set(userId, { id: row.accountId, at: Date.now() });
  return row.accountId;
}
