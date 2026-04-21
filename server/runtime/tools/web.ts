import { z } from "zod";
import { registerTool } from "../registry";

/** Fetch a URL and return the text body (truncated). Safe for LLM context. */
registerTool({
  name: "web.fetch",
  label: "Fetch URL",
  provider: "builtin",
  description:
    "Fetch an HTTP(S) URL and return the response body as text. Use for reading public web pages or JSON APIs. Max 8 KB returned.",
  input: z.object({
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
  }),
  async run({ input }) {
    try {
      const res = await fetch(input.url, {
        headers: input.headers,
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      const body = await res.text();
      const truncated = body.slice(0, 8192);
      return {
        ok: res.ok,
        summary: `${res.status} ${res.statusText} — ${truncated.length} chars`,
        data: { status: res.status, body: truncated },
      };
    } catch (err) {
      return {
        ok: false,
        summary: "Fetch failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});

/**
 * Web search via DuckDuckGo's HTML endpoint. Good enough for a built-in tool;
 * upgrade to a proper search API (Brave, Kagi, Bing) by swapping this body.
 */
registerTool({
  name: "web.search",
  label: "Web search",
  provider: "builtin",
  description:
    "Search the web and return the top results (title, URL, snippet). Use when you need fresh information or links.",
  input: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(10).optional(),
  }),
  async run({ input }) {
    const limit = input.limit ?? 5;
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`;
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "BotBoss/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return { ok: false, summary: `Search failed: ${res.status}` };
      }
      const html = await res.text();
      const results = parseDuckDuckGoHtml(html).slice(0, limit);
      return {
        ok: true,
        summary: `${results.length} results for "${input.query}"`,
        data: { query: input.query, results },
      };
    } catch (err) {
      return {
        ok: false,
        summary: "Search failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});

function parseDuckDuckGoHtml(html: string): { title: string; url: string; snippet: string }[] {
  const results: { title: string; url: string; snippet: string }[] = [];
  const linkRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snippetRegex = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const linkMatches: { url: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    linkMatches.push({ url: decodeDdgUrl(m[1]), title: stripTags(m[2]) });
  }
  const snippets: string[] = [];
  while ((m = snippetRegex.exec(html)) !== null) {
    snippets.push(stripTags(m[1]));
  }
  for (let i = 0; i < linkMatches.length; i++) {
    results.push({
      title: linkMatches[i].title,
      url: linkMatches[i].url,
      snippet: snippets[i] ?? "",
    });
  }
  return results;
}

function decodeDdgUrl(href: string): string {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : u.toString();
  } catch {
    return href;
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
