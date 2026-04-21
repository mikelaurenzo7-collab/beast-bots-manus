import { z } from "zod";
import { registerTool } from "../../registry";

/**
 * SEC EDGAR — public filings. No auth required but SEC requires a descriptive
 * User-Agent per their fair-access policy.
 */
const UA = "BotBoss/1.0 (bot-boss@botboss.app)";

registerTool({
  name: "sec.recent_filings",
  label: "Recent SEC filings",
  provider: "builtin",
  description:
    "Fetch recent SEC filings for a ticker (e.g. 'AAPL', 'TSLA'). Returns filing type, date, accession number, URL. Use for 10-K, 10-Q, 8-K, S-1 surveillance.",
  input: z.object({
    ticker: z.string().min(1).max(10),
    limit: z.number().int().min(1).max(40).optional(),
    formType: z
      .string()
      .optional()
      .describe("Restrict to a specific form (e.g. '10-K', '8-K', 'S-1')"),
  }),
  async run({ input }) {
    const cik = await tickerToCik(input.ticker);
    if (!cik) return { ok: false, summary: `Unknown ticker ${input.ticker}` };

    const res = await fetch(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) return { ok: false, summary: `SEC ${res.status}` };
    const data = (await res.json()) as {
      name: string;
      filings: { recent: SECRecentFilings };
    };
    const recent = data.filings.recent;
    const rows: Filing[] = [];
    for (let i = 0; i < recent.accessionNumber.length; i++) {
      const form = recent.form[i];
      if (input.formType && form !== input.formType) continue;
      rows.push({
        form,
        filedAt: recent.filingDate[i],
        accession: recent.accessionNumber[i],
        primaryDocument: recent.primaryDocument[i],
        url: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${recent.accessionNumber[i].replace(/-/g, "")}/${recent.primaryDocument[i]}`,
      });
      if (rows.length >= (input.limit ?? 20)) break;
    }
    return {
      ok: true,
      summary: `${rows.length} filings for ${data.name} (${input.ticker.toUpperCase()})`,
      data: { company: data.name, ticker: input.ticker.toUpperCase(), filings: rows },
    };
  },
});

registerTool({
  name: "sec.insider_trades",
  label: "SEC insider trades",
  provider: "builtin",
  description:
    "Fetch recent Form 4 insider transactions for a ticker. Shows which officers/directors bought or sold, when, and how many shares.",
  input: z.object({
    ticker: z.string().min(1).max(10),
    limit: z.number().int().min(1).max(40).optional(),
  }),
  async run({ input }) {
    const cik = await tickerToCik(input.ticker);
    if (!cik) return { ok: false, summary: `Unknown ticker ${input.ticker}` };
    const res = await fetch(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) return { ok: false, summary: `SEC ${res.status}` };
    const data = (await res.json()) as {
      name: string;
      filings: { recent: SECRecentFilings };
    };
    const recent = data.filings.recent;
    const rows: Filing[] = [];
    for (let i = 0; i < recent.accessionNumber.length; i++) {
      if (recent.form[i] !== "4") continue;
      rows.push({
        form: recent.form[i],
        filedAt: recent.filingDate[i],
        accession: recent.accessionNumber[i],
        primaryDocument: recent.primaryDocument[i],
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4&dateb=&owner=include&count=40&action=getcompany`,
      });
      if (rows.length >= (input.limit ?? 20)) break;
    }
    return {
      ok: true,
      summary: `${rows.length} Form 4 filings for ${data.name}`,
      data: { company: data.name, insiderFilings: rows },
    };
  },
});

type SECRecentFilings = {
  accessionNumber: string[];
  filingDate: string[];
  form: string[];
  primaryDocument: string[];
};

type Filing = {
  form: string;
  filedAt: string;
  accession: string;
  primaryDocument: string;
  url: string;
};

/** Cache the ticker → CIK map at module scope. It's ~13k entries, ~2 MB. */
let cikCache: Map<string, string> | null = null;
let cikCacheAt = 0;

async function tickerToCik(ticker: string): Promise<string | null> {
  const now = Date.now();
  if (!cikCache || now - cikCacheAt > 24 * 60 * 60 * 1000) {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, { ticker: string; cik_str: number }>;
    const map = new Map<string, string>();
    for (const row of Object.values(data)) {
      map.set(row.ticker.toUpperCase(), String(row.cik_str).padStart(10, "0"));
    }
    cikCache = map;
    cikCacheAt = now;
  }
  return cikCache.get(ticker.toUpperCase()) ?? null;
}
