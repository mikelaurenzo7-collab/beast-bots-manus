import { z } from "zod";
import { registerTool } from "../../registry";

/**
 * Pinterest REST API v5. User connects via OAuth
 * (scopes: boards:read, pins:read, pins:write, user_accounts:read).
 *
 * Pinterest is an underrated top-of-funnel for ecommerce — pins are evergreen
 * and drive click-outs to Shopify/Etsy. This bot's job is to create pins,
 * track which pins drive clicks, and propose more of what works.
 *
 * Docs: https://developers.pinterest.com/docs/api/v5/
 */
const BASE = "https://api.pinterest.com/v5";

registerTool({
  name: "pinterest.create_pin",
  label: "Create Pinterest pin",
  provider: "pinterest",
  description:
    "Publish a pin to one of the user's boards. Requires imageUrl, title, description, and a destination link to drive clicks. Always confirm destination URL before calling.",
  input: z.object({
    boardId: z.string(),
    title: z.string().max(100),
    description: z.string().max(800).optional(),
    link: z.string().url(),
    imageUrl: z.string().url(),
    altText: z.string().max(500).optional(),
  }),
  async run({ token, input }) {
    const body = {
      board_id: input.boardId,
      title: input.title,
      description: input.description,
      alt_text: input.altText,
      link: input.link,
      media_source: { source_type: "image_url", url: input.imageUrl },
    };
    const res = await fetch(`${BASE}/pins`, {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return pinError(res);
    const data = await res.json();
    return {
      ok: true,
      summary: `Pin published: ${input.title}`,
      data,
    };
  },
});

registerTool({
  name: "pinterest.top_pins",
  label: "Top-performing pins",
  provider: "pinterest",
  description:
    "List the user's top pins by impressions / outbound clicks over the last N days. Key input for 'make more of what's working' loops.",
  input: z.object({
    days: z.number().int().min(7).max(90).optional(),
    sortBy: z.enum(["IMPRESSION", "OUTBOUND_CLICK", "PIN_CLICK", "SAVE"]).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  async run({ token, input }) {
    const end = new Date();
    const start = new Date(end.getTime() - (input.days ?? 30) * 86_400_000);
    const params = new URLSearchParams({
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      metric_types: "IMPRESSION,OUTBOUND_CLICK,PIN_CLICK,SAVE",
      sort_by: input.sortBy ?? "OUTBOUND_CLICK",
      num_of_pins: String(input.limit ?? 25),
    });
    const res = await fetch(`${BASE}/user_account/top_pins/analytics?${params}`, {
      headers: headers(token),
    });
    if (!res.ok) return pinError(res);
    const data = (await res.json()) as { pins?: TopPin[] };
    return {
      ok: true,
      summary: `${data.pins?.length ?? 0} top pins (last ${input.days ?? 30}d)`,
      data: (data.pins ?? []).map((p) => ({
        pinId: p.pin_id,
        impressions: p.metrics?.IMPRESSION ?? 0,
        outboundClicks: p.metrics?.OUTBOUND_CLICK ?? 0,
        pinClicks: p.metrics?.PIN_CLICK ?? 0,
        saves: p.metrics?.SAVE ?? 0,
      })),
    };
  },
});

registerTool({
  name: "pinterest.list_boards",
  label: "List Pinterest boards",
  provider: "pinterest",
  description: "Return the user's Pinterest boards with their ids. Needed to target create_pin.",
  input: z.object({}),
  async run({ token }) {
    const res = await fetch(`${BASE}/boards?page_size=100`, { headers: headers(token) });
    if (!res.ok) return pinError(res);
    const data = (await res.json()) as { items: { id: string; name: string }[] };
    return {
      ok: true,
      summary: `${data.items.length} boards`,
      data: data.items,
    };
  },
});

// ─── Expanded capabilities ─────────────────────────────────────────────────

registerTool({
  name: "pinterest.list_pins",
  label: "List all pins",
  provider: "pinterest",
  description:
    "Paginate through the user's pins. Returns id, board, link, title. Use to find pin ids for analytics or cleanup.",
  input: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    bookmark: z.string().optional().describe("Cursor for the next page"),
  }),
  async run({ token, input }) {
    const params = new URLSearchParams({ page_size: String(input.limit ?? 25) });
    if (input.bookmark) params.set("bookmark", input.bookmark);
    const res = await fetch(`${BASE}/pins?${params}`, { headers: headers(token) });
    if (!res.ok) return pinError(res);
    const data = (await res.json()) as {
      items: {
        id: string;
        board_id?: string;
        title?: string;
        link?: string;
        created_at?: string;
      }[];
      bookmark?: string;
    };
    return {
      ok: true,
      summary: `${data.items.length} pins`,
      data: {
        pins: data.items.map((p) => ({
          id: p.id,
          boardId: p.board_id,
          title: p.title,
          link: p.link,
          createdAt: p.created_at,
        })),
        nextBookmark: data.bookmark,
      },
    };
  },
});

registerTool({
  name: "pinterest.pin_analytics",
  label: "Pin analytics",
  provider: "pinterest",
  description:
    "Per-pin analytics (impressions, saves, outbound clicks) for a date range. Use to compare performance of specific pins.",
  input: z.object({
    pinId: z.string(),
    days: z.number().int().min(7).max(90).optional(),
  }),
  async run({ token, input }) {
    const end = new Date();
    const start = new Date(end.getTime() - (input.days ?? 30) * 86_400_000);
    const params = new URLSearchParams({
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      metric_types: "IMPRESSION,SAVE,OUTBOUND_CLICK,PIN_CLICK",
    });
    const res = await fetch(
      `${BASE}/pins/${encodeURIComponent(input.pinId)}/analytics?${params}`,
      { headers: headers(token) }
    );
    if (!res.ok) return pinError(res);
    const data = (await res.json()) as Record<string, { summary_metrics?: Record<string, number> }>;
    const all = data.ALL?.summary_metrics ?? {};
    return {
      ok: true,
      summary: `${all.IMPRESSION ?? 0} impressions, ${all.OUTBOUND_CLICK ?? 0} clicks`,
      data: {
        pinId: input.pinId,
        days: input.days ?? 30,
        impressions: all.IMPRESSION ?? 0,
        saves: all.SAVE ?? 0,
        outboundClicks: all.OUTBOUND_CLICK ?? 0,
        pinClicks: all.PIN_CLICK ?? 0,
      },
    };
  },
});

registerTool({
  name: "pinterest.create_board",
  label: "Create Pinterest board",
  provider: "pinterest",
  description:
    "Create a new Pinterest board. Use when the user needs to organize pins into a new collection (e.g. 'Winter Collection 2025').",
  input: z.object({
    name: z.string().min(1).max(180),
    description: z.string().max(500).optional(),
    privacy: z.enum(["PUBLIC", "PROTECTED", "SECRET"]).optional(),
  }),
  async run({ token, input }) {
    const res = await fetch(`${BASE}/boards`, {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        privacy: input.privacy ?? "PUBLIC",
      }),
    });
    if (!res.ok) return pinError(res);
    const data = (await res.json()) as { id: string; name: string; url: string };
    return {
      ok: true,
      summary: `Created board "${data.name}"`,
      data,
    };
  },
});

type TopPin = {
  pin_id: string;
  metrics?: Partial<Record<"IMPRESSION" | "OUTBOUND_CLICK" | "PIN_CLICK" | "SAVE", number>>;
};

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

async function pinError(res: Response) {
  return { ok: false, summary: `Pinterest ${res.status}`, error: (await res.text()).slice(0, 256) };
}
