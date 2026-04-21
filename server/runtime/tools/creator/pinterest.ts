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
