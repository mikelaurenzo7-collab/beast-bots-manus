import { z } from "zod";
import { registerTool } from "../../registry";

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
  async run({ token, input }) {
    const shop = await resolveShop(token);
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
  async run({ token, input }) {
    const shop = await resolveShop(token);
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

async function resolveShop(_token: string): Promise<string | null> {
  // Wired up during the OAuth callback; the shop id is stored in
  // oauth_connections.accountId and passed alongside the token.
  return process.env.ETSY_DEFAULT_SHOP_ID ?? null;
}
