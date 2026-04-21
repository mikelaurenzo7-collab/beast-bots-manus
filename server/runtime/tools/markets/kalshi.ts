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

// ─── Expanded capabilities ─────────────────────────────────────────────────

registerTool({
  name: "kalshi.list_positions",
  label: "Open positions",
  provider: "kalshi",
  description:
    "List the user's open positions with cost basis and unrealized P&L. Use before proposing new trades so size + concentration are sane.",
  input: z.object({
    limit: z.number().int().min(1).max(200).optional(),
  }),
  async run({ token, input }) {
    const params = new URLSearchParams({ limit: String(input.limit ?? 100) });
    const res = await fetch(`${KALSHI_BASE}/portfolio/positions?${params}`, {
      headers: kalshiHeaders(token),
    });
    if (!res.ok) return kalshiError(res);
    const data = (await res.json()) as {
      market_positions: {
        ticker: string;
        position: number;
        market_exposure: number;
        realized_pnl: number;
        total_traded: number;
        resting_orders_count?: number;
      }[];
    };
    const rows = data.market_positions;
    const totalExposure = rows.reduce((s, p) => s + Math.abs(p.market_exposure ?? 0), 0);
    const totalPnl = rows.reduce((s, p) => s + (p.realized_pnl ?? 0), 0);
    return {
      ok: true,
      summary: `${rows.length} positions — exposure $${(totalExposure / 100).toFixed(2)}, realized P&L $${(totalPnl / 100).toFixed(2)}`,
      data: rows.map((p) => ({
        ticker: p.ticker,
        contracts: p.position,
        exposureCents: p.market_exposure,
        realizedPnlCents: p.realized_pnl,
        totalTraded: p.total_traded,
      })),
    };
  },
});

registerTool({
  name: "kalshi.list_orders",
  label: "Open orders",
  provider: "kalshi",
  description:
    "List the user's open (resting) orders so the agent can reference or cancel them. Status 'resting' = live on the book.",
  input: z.object({
    ticker: z.string().optional(),
    status: z.enum(["resting", "canceled", "executed"]).optional(),
  }),
  async run({ token, input }) {
    const params = new URLSearchParams({
      status: input.status ?? "resting",
    });
    if (input.ticker) params.set("ticker", input.ticker);
    const res = await fetch(`${KALSHI_BASE}/portfolio/orders?${params}`, {
      headers: kalshiHeaders(token),
    });
    if (!res.ok) return kalshiError(res);
    const data = (await res.json()) as {
      orders: {
        order_id: string;
        ticker: string;
        side: string;
        action: string;
        yes_price?: number;
        no_price?: number;
        count: number;
        remaining_count: number;
        created_time?: string;
      }[];
    };
    return {
      ok: true,
      summary: `${data.orders.length} ${input.status ?? "resting"} orders`,
      data: data.orders.map((o) => ({
        orderId: o.order_id,
        ticker: o.ticker,
        side: o.side,
        action: o.action,
        priceCents: o.yes_price ?? o.no_price,
        count: o.count,
        remaining: o.remaining_count,
        createdAt: o.created_time,
      })),
    };
  },
});

registerTool({
  name: "kalshi.cancel_order",
  label: "Cancel order",
  provider: "kalshi",
  description:
    "Cancel an open Kalshi order by orderId. ALWAYS confirm the orderId and ticker with the user before calling.",
  input: z.object({ orderId: z.string() }),
  async run({ token, input }) {
    const res = await fetch(
      `${KALSHI_BASE}/portfolio/orders/${encodeURIComponent(input.orderId)}`,
      { method: "DELETE", headers: kalshiHeaders(token) }
    );
    if (!res.ok) return kalshiError(res);
    return { ok: true, summary: `Cancelled order ${input.orderId}` };
  },
});

registerTool({
  name: "kalshi.list_fills",
  label: "Recent trade fills",
  provider: "kalshi",
  description:
    "List recent fills (executed trades). Useful when the user asks 'what did I trade today?' or we need to compute a day's P&L.",
  input: z.object({
    ticker: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  async run({ token, input }) {
    const params = new URLSearchParams({ limit: String(input.limit ?? 25) });
    if (input.ticker) params.set("ticker", input.ticker);
    const res = await fetch(`${KALSHI_BASE}/portfolio/fills?${params}`, {
      headers: kalshiHeaders(token),
    });
    if (!res.ok) return kalshiError(res);
    const data = (await res.json()) as {
      fills: {
        trade_id?: string;
        ticker: string;
        side: string;
        count: number;
        yes_price?: number;
        no_price?: number;
        created_time?: string;
      }[];
    };
    return {
      ok: true,
      summary: `${data.fills.length} fills`,
      data: data.fills.map((f) => ({
        tradeId: f.trade_id,
        ticker: f.ticker,
        side: f.side,
        count: f.count,
        priceCents: f.yes_price ?? f.no_price,
        executedAt: f.created_time,
      })),
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
