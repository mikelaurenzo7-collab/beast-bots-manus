import { z } from "zod";
import { registerTool } from "../../registry";

const POLYMARKET_GAMMA = "https://gamma-api.polymarket.com";

/**
 * Polymarket (read-only).
 *
 * Gamma API is public, no auth. We intentionally don't wire the trading
 * endpoint here — Polymarket trades go through on-chain signed orders and
 * that belongs in a dedicated "wallet connect" flow, not a server API key.
 */

registerTool({
  name: "polymarket.search_markets",
  label: "Search Polymarket",
  provider: "builtin",
  description:
    "Search Polymarket prediction markets by keyword. Returns question, current probability, 24h volume, end date. Read-only.",
  input: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional(),
    active: z.boolean().optional(),
  }),
  async run({ input }) {
    const params = new URLSearchParams({
      limit: String(input.limit ?? 20),
      active: String(input.active ?? true),
      closed: "false",
    });
    const res = await fetch(`${POLYMARKET_GAMMA}/markets?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, summary: `Polymarket ${res.status}` };
    const data = (await res.json()) as PolymarketMarket[];
    const q = input.query.toLowerCase();
    const filtered = data
      .filter((m) => (m.question + " " + (m.description ?? "")).toLowerCase().includes(q))
      .slice(0, input.limit ?? 20);
    return {
      ok: true,
      summary: `Found ${filtered.length} Polymarket markets for "${input.query}"`,
      data: filtered.map((m) => ({
        id: m.id,
        question: m.question,
        probability: m.lastTradePrice ?? m.outcomePrices?.[0],
        volume24h: m.volume24hr,
        endsAt: m.endDate,
        slug: m.slug,
      })),
    };
  },
});

registerTool({
  name: "polymarket.trending",
  label: "Polymarket trending",
  provider: "builtin",
  description:
    "Get the most-traded Polymarket markets in the last 24h. Useful for 'what is the market paying attention to today?'",
  input: z.object({ limit: z.number().int().min(1).max(20).optional() }),
  async run({ input }) {
    const params = new URLSearchParams({
      limit: String(input.limit ?? 10),
      active: "true",
      closed: "false",
      order: "volume24hr",
      ascending: "false",
    });
    const res = await fetch(`${POLYMARKET_GAMMA}/markets?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, summary: `Polymarket ${res.status}` };
    const data = (await res.json()) as PolymarketMarket[];
    return {
      ok: true,
      summary: `Top ${data.length} Polymarket markets by 24h volume`,
      data: data.map((m) => ({
        question: m.question,
        probability: m.lastTradePrice,
        volume24h: m.volume24hr,
        endsAt: m.endDate,
      })),
    };
  },
});

type PolymarketMarket = {
  id: string;
  slug: string;
  question: string;
  description?: string;
  lastTradePrice?: number;
  outcomePrices?: number[];
  volume24hr?: number;
  endDate?: string;
};
