import { z } from "zod";
import { registerTool } from "../../registry";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

/**
 * Kalshi — CFTC-regulated event contracts.
 *
 * Auth: the user brings their Kalshi API key (Settings → Connections →
 * "Kalshi"). Tokens are encrypted at rest by the connections router, then
 * passed in here as `token`. No user-secret ever hits an LLM context.
 */

registerTool({
  name: "kalshi.search_markets",
  label: "Search Kalshi markets",
  provider: "kalshi",
  description:
    "Search Kalshi event contracts by keyword (e.g. 'election', 'fed rate', 'hurricane'). Returns market ticker, question, yes/no prices, volume.",
  input: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional(),
    status: z.enum(["open", "closed", "settled"]).optional(),
  }),
  async run({ token, input }) {
    const params = new URLSearchParams({
      limit: String(input.limit ?? 20),
      status: input.status ?? "open",
    });
    const res = await fetch(`${KALSHI_BASE}/markets?${params}`, {
      headers: kalshiHeaders(token),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return kalshiError(res);
    const data = (await res.json()) as { markets: KalshiMarket[] };
    const q = input.query.toLowerCase();
    const filtered = data.markets.filter((m) =>
      (m.title + " " + m.subtitle + " " + m.ticker).toLowerCase().includes(q)
    );
    return {
      ok: true,
      summary: `Found ${filtered.length} Kalshi markets matching "${input.query}"`,
      data: filtered.map(toSummary),
    };
  },
});

registerTool({
  name: "kalshi.get_market",
  label: "Get Kalshi market",
  provider: "kalshi",
  description:
    "Fetch the current state of a specific Kalshi market by ticker (e.g. 'FED-24DEC-T3.25'). Returns live yes/no prices, volume, close time.",
  input: z.object({ ticker: z.string().min(1) }),
  async run({ token, input }) {
    const res = await fetch(`${KALSHI_BASE}/markets/${encodeURIComponent(input.ticker)}`, {
      headers: kalshiHeaders(token),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return kalshiError(res);
    const data = (await res.json()) as { market: KalshiMarket };
    return {
      ok: true,
      summary: `${data.market.ticker}: YES ${data.market.yes_bid ?? "-"}¢ / NO ${data.market.no_bid ?? "-"}¢`,
      data: toSummary(data.market),
    };
  },
});

registerTool({
  name: "kalshi.get_balance",
  label: "Kalshi balance",
  provider: "kalshi",
  description: "Fetch the user's current Kalshi cash balance and open positions.",
  input: z.object({}),
  async run({ token }) {
    const [balanceRes, posRes] = await Promise.all([
      fetch(`${KALSHI_BASE}/portfolio/balance`, { headers: kalshiHeaders(token) }),
      fetch(`${KALSHI_BASE}/portfolio/positions`, { headers: kalshiHeaders(token) }),
    ]);
    if (!balanceRes.ok) return kalshiError(balanceRes);
    const balance = (await balanceRes.json()) as { balance: number };
    const positions = posRes.ok
      ? ((await posRes.json()) as { market_positions: unknown[] })
      : { market_positions: [] };
    return {
      ok: true,
      summary: `Balance $${(balance.balance / 100).toFixed(2)}, ${positions.market_positions.length} positions`,
      data: { balanceCents: balance.balance, positions: positions.market_positions },
    };
  },
});

registerTool({
  name: "kalshi.place_order",
  label: "Place Kalshi order",
  provider: "kalshi",
  description:
    "Place a Kalshi order. Side='yes' or 'no', action='buy' or 'sell'. Price is in cents (1–99). Count is number of contracts. ALWAYS confirm with the user before calling this.",
  input: z.object({
    ticker: z.string(),
    side: z.enum(["yes", "no"]),
    action: z.enum(["buy", "sell"]),
    count: z.number().int().positive(),
    price: z.number().int().min(1).max(99).describe("Limit price in cents (1-99)"),
  }),
  async run({ token, input, userId }) {
    const body = {
      ticker: input.ticker,
      side: input.side,
      action: input.action,
      count: input.count,
      type: "limit",
      yes_price: input.side === "yes" ? input.price : undefined,
      no_price: input.side === "no" ? input.price : undefined,
      client_order_id: `botboss-${userId}-${Date.now()}`,
    };
    const res = await fetch(`${KALSHI_BASE}/portfolio/orders`, {
      method: "POST",
      headers: { ...kalshiHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return kalshiError(res);
    const data = await res.json();
    return {
      ok: true,
      summary: `Placed ${input.action} ${input.count} ${input.side.toUpperCase()} on ${input.ticker} @ ${input.price}¢`,
      data,
    };
  },
});

type KalshiMarket = {
  ticker: string;
  title: string;
  subtitle: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  volume?: number;
  close_time?: string;
  status?: string;
};

function toSummary(m: KalshiMarket) {
  return {
    ticker: m.ticker,
    title: m.title,
    subtitle: m.subtitle,
    yesPriceCents: m.yes_bid,
    noPriceCents: m.no_bid,
    volume: m.volume,
    closesAt: m.close_time,
    status: m.status,
  };
}

function kalshiHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

async function kalshiError(res: Response) {
  const body = await res.text();
  return {
    ok: false,
    summary: `Kalshi ${res.status}`,
    error: body.slice(0, 512),
  };
}
