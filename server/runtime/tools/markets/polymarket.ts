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

registerTool({
  name: "polymarket.market_by_slug",
  label: "Polymarket market detail",
  provider: "builtin",
  description:
    "Fetch full details for a Polymarket market by its slug (the tail of its URL). Returns description, outcome prices, end date, volume.",
  input: z.object({ slug: z.string().min(1) }),
  async run({ input }) {
    const res = await fetch(
      `${POLYMARKET_GAMMA}/markets?slug=${encodeURIComponent(input.slug)}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) return { ok: false, summary: `Polymarket ${res.status}` };
    const list = (await res.json()) as PolymarketMarket[];
    const m = list[0];
    if (!m) return { ok: false, summary: `No market for slug "${input.slug}"` };
    return {
      ok: true,
      summary: `${m.question} — p=${m.lastTradePrice ?? "?"}`,
      data: {
        id: m.id,
        slug: m.slug,
        question: m.question,
        description: m.description,
        probability: m.lastTradePrice,
        outcomePrices: m.outcomePrices,
        volume24h: m.volume24hr,
        endsAt: m.endDate,
      },
    };
  },
});

registerTool({
  name: "polymarket.list_events",
  label: "Polymarket event categories",
  provider: "builtin",
  description:
    "Browse active Polymarket events grouped by category (politics, sports, culture, etc.). Good for discovering what's tradeable right now.",
  input: z.object({
    tag: z.string().optional().describe("Filter by tag slug, e.g. 'politics', 'sports'"),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  async run({ input }) {
    const params = new URLSearchParams({
      limit: String(input.limit ?? 25),
      active: "true",
      closed: "false",
      order: "volume24hr",
      ascending: "false",
    });
    if (input.tag) params.set("tag_slug", input.tag);
    const res = await fetch(`${POLYMARKET_GAMMA}/events?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, summary: `Polymarket ${res.status}` };
    const data = (await res.json()) as {
      id: string;
      slug: string;
      title: string;
      volume24hr?: number;
      endDate?: string;
      tags?: { slug: string; label: string }[];
    }[];
    return {
      ok: true,
      summary: `${data.length} active events${input.tag ? ` in ${input.tag}` : ""}`,
      data: data.map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        volume24h: e.volume24hr,
        endsAt: e.endDate,
        tags: e.tags?.map((t) => t.slug),
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
