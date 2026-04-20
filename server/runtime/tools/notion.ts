import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "notion";
const BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function notion<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "notion-version": NOTION_VERSION,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ─── list_databases ───────────────────────────────────────────────────────────

const listDatabasesInput = z.object({
  query: z.string().optional().describe("Optional text filter"),
});

type NotionDB = {
  id: string;
  title?: { plain_text: string }[];
  url?: string;
};

const listDatabases: Tool<z.infer<typeof listDatabasesInput>> = {
  name: `${PROVIDER}.list_databases`,
  label: "List databases",
  provider: PROVIDER,
  description: "Search Notion databases the integration has access to.",
  input: listDatabasesInput,
  async run({ token, input }: ToolContext<z.infer<typeof listDatabasesInput>>): Promise<ToolResult> {
    try {
      const json = await notion<{ results: NotionDB[] }>(token, `/search`, {
        method: "POST",
        body: JSON.stringify({
          query: input.query ?? "",
          filter: { value: "database", property: "object" },
          page_size: 20,
        }),
      });
      const results = json.results ?? [];
      const titled = results.map((d) => ({
        id: d.id,
        title: d.title?.[0]?.plain_text ?? "(untitled)",
        url: d.url,
      }));
      const summary =
        titled.length === 0
          ? "No Notion databases found."
          : `Found ${titled.length} database${titled.length === 1 ? "" : "s"}: ${titled
              .slice(0, 5)
              .map((d) => d.title)
              .join(", ")}${titled.length > 5 ? ", …" : ""}`;
      return { ok: true, summary, data: titled };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to list databases", error: message };
    }
  },
};

// ─── append_block ─────────────────────────────────────────────────────────────

const appendBlockInput = z.object({
  pageId: z.string().describe("Notion page or block ID"),
  text: z.string().min(1).describe("Paragraph text to append"),
});

type AppendResponse = { results: { id: string }[] };

const appendBlock: Tool<z.infer<typeof appendBlockInput>> = {
  name: `${PROVIDER}.append_block`,
  label: "Append block",
  provider: PROVIDER,
  description: "Append a paragraph block to a Notion page.",
  input: appendBlockInput,
  async run({ token, input }: ToolContext<z.infer<typeof appendBlockInput>>): Promise<ToolResult> {
    try {
      const json = await notion<AppendResponse>(
        token,
        `/blocks/${encodeURIComponent(input.pageId)}/children`,
        {
          method: "PATCH",
          body: JSON.stringify({
            children: [
              {
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [{ type: "text", text: { content: input.text } }],
                },
              },
            ],
          }),
        }
      );
      return {
        ok: true,
        summary: `Appended block to Notion page ${input.pageId}`,
        data: { blockIds: json.results.map((r) => r.id) },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to append block", error: message };
    }
  },
};

registerTool(listDatabases);
registerTool(appendBlock);

// ─── create_page ──────────────────────────────────────────────────────────────

const createPageInput = z.object({
  database_id: z.string().describe("Notion database ID to create the page in"),
  title: z.string().min(1).describe("Page title"),
  content: z.string().optional().describe("Optional paragraph content for the page body"),
});

type CreatedPage = { id: string; url?: string };

const createPage: Tool<z.infer<typeof createPageInput>> = {
  name: `${PROVIDER}.create_page`,
  label: "Create page",
  provider: PROVIDER,
  description: "Create a new page in a Notion database, optionally with a paragraph body.",
  input: createPageInput,
  async run({ token, input }: ToolContext<z.infer<typeof createPageInput>>): Promise<ToolResult> {
    try {
      const children = input.content
        ? [
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ type: "text", text: { content: input.content } }],
              },
            },
          ]
        : [];
      const page = await notion<CreatedPage>(token, "/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: input.database_id },
          properties: {
            title: {
              title: [{ type: "text", text: { content: input.title } }],
            },
          },
          children,
        }),
      });
      return {
        ok: true,
        summary: `Created page "${input.title}" in database ${input.database_id}`,
        data: { id: page.id, url: page.url },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to create page", error: message };
    }
  },
};

// ─── search ───────────────────────────────────────────────────────────────────

const notionSearchInput = z.object({
  query: z.string().min(1).describe("Search query"),
});

type NotionSearchResult = {
  id: string;
  object: string;
  url?: string;
  title?: { plain_text: string }[];
  properties?: { title?: { title?: { plain_text: string }[] } };
};

const notionSearch: Tool<z.infer<typeof notionSearchInput>> = {
  name: `${PROVIDER}.search`,
  label: "Search Notion",
  provider: PROVIDER,
  description: "Search for pages and databases in Notion by keyword.",
  input: notionSearchInput,
  async run({ token, input }: ToolContext<z.infer<typeof notionSearchInput>>): Promise<ToolResult> {
    try {
      const json = await notion<{ results: NotionSearchResult[] }>(token, "/search", {
        method: "POST",
        body: JSON.stringify({ query: input.query, page_size: 5 }),
      });
      const results = json.results ?? [];
      const mapped = results.map((r) => {
        const titleArr =
          r.title ??
          r.properties?.title?.title ??
          [];
        const title = titleArr[0]?.plain_text ?? "(untitled)";
        return { id: r.id, type: r.object, title, url: r.url };
      });
      const summary =
        mapped.length === 0
          ? `No results for "${input.query}".`
          : `Found ${mapped.length} result${mapped.length === 1 ? "" : "s"} for "${input.query}": ${mapped
              .map((r) => r.title)
              .join(", ")}`;
      return { ok: true, summary, data: mapped };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to search Notion", error: message };
    }
  },
};

registerTool(createPage);
registerTool(notionSearch);
