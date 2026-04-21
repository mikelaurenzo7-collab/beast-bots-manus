import { z } from "zod";
import { registerTool } from "../../registry";

/**
 * Congress stock trades via House/Senate financial disclosure feeds,
 * mirrored through the community "Financial Disclosure" project and
 * Quiver's public JSON endpoints. Defaults to Quiver's read-only feed
 * which is free and un-authed for light use.
 */
const QUIVER = "https://api.quiverquant.com/beta/bulk/congresstrading";

registerTool({
  name: "congress.recent_trades",
  label: "Congress trades",
  provider: "builtin",
  description:
    "Recent stock transactions disclosed by US Senators and Representatives. Filter by ticker or lawmaker. Useful for 'what did Pelosi buy this quarter?' type queries.",
  input: z.object({
    ticker: z.string().optional().describe("Optional ticker filter (e.g. 'NVDA')"),
    representative: z
      .string()
      .optional()
      .describe("Optional lawmaker name filter, matched case-insensitively"),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  async run({ input }) {
    const res = await fetch(QUIVER, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        summary: `Congress trades feed ${res.status}`,
        error: "The public Quiver feed rate-limited or is down. Try again later.",
      };
    }
    const all = (await res.json()) as CongressTrade[];
    let rows = all;
    if (input.ticker) {
      const t = input.ticker.toUpperCase();
      rows = rows.filter((r) => (r.Ticker ?? "").toUpperCase() === t);
    }
    if (input.representative) {
      const q = input.representative.toLowerCase();
      rows = rows.filter((r) => (r.Representative ?? "").toLowerCase().includes(q));
    }
    rows = rows.slice(0, input.limit ?? 25);
    return {
      ok: true,
      summary: `${rows.length} congressional trades`,
      data: rows.map((r) => ({
        representative: r.Representative,
        chamber: r.House,
        ticker: r.Ticker,
        transactionType: r.Transaction,
        tradedOn: r.TransactionDate,
        disclosedOn: r.ReportDate,
        range: r.Range,
      })),
    };
  },
});

type CongressTrade = {
  Representative?: string;
  House?: string;
  Ticker?: string;
  Transaction?: string;
  TransactionDate?: string;
  ReportDate?: string;
  Range?: string;
};
