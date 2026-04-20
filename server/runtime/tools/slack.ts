import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "slack";
const BASE = "https://slack.com/api";

type SlackResponse<T> = T & { ok: boolean; error?: string };

async function slackPost<T>(
  token: string,
  method: string,
  params: Record<string, string>
): Promise<SlackResponse<T>> {
  const body = new URLSearchParams(params);
  const res = await fetch(`${BASE}/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Slack HTTP ${res.status}`);
  const json = (await res.json()) as SlackResponse<T>;
  if (!json.ok) throw new Error(`Slack error: ${json.error ?? "unknown"}`);
  return json;
}

async function slackGet<T>(
  token: string,
  method: string,
  query: Record<string, string> = {}
): Promise<SlackResponse<T>> {
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${BASE}/${method}${qs ? `?${qs}` : ""}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Slack HTTP ${res.status}`);
  const json = (await res.json()) as SlackResponse<T>;
  if (!json.ok) throw new Error(`Slack error: ${json.error ?? "unknown"}`);
  return json;
}

// ─── list_channels ────────────────────────────────────────────────────────────

const listChannelsInput = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

type Channel = { id: string; name: string; is_private: boolean; num_members?: number };

const listChannels: Tool<z.infer<typeof listChannelsInput>> = {
  name: `${PROVIDER}.list_channels`,
  label: "List channels",
  provider: PROVIDER,
  description: "List channels the Slack user/bot has access to.",
  input: listChannelsInput,
  async run({ token, input }: ToolContext<z.infer<typeof listChannelsInput>>): Promise<ToolResult> {
    try {
      const limit = String(input.limit ?? 50);
      const json = await slackGet<{ channels: Channel[] }>(token, "conversations.list", {
        limit,
        exclude_archived: "true",
      });
      const channels = json.channels ?? [];
      const summary =
        channels.length === 0
          ? "No accessible channels."
          : `Found ${channels.length} channel${channels.length === 1 ? "" : "s"}: ${channels
              .slice(0, 5)
              .map((c) => `#${c.name}`)
              .join(", ")}${channels.length > 5 ? ", …" : ""}`;
      return {
        ok: true,
        summary,
        data: channels.map((c) => ({ id: c.id, name: c.name, private: c.is_private })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to list channels", error: message };
    }
  },
};

// ─── send_message ─────────────────────────────────────────────────────────────

const sendMessageInput = z.object({
  channel: z.string().describe("Channel ID (e.g. C01234567) or name (e.g. #general)"),
  text: z.string().min(1).describe("Message text; supports Slack mrkdwn"),
});

const sendMessage: Tool<z.infer<typeof sendMessageInput>> = {
  name: `${PROVIDER}.send_message`,
  label: "Send message",
  provider: PROVIDER,
  description:
    "Post a message to a Slack channel. Always confirm the channel with the user before calling this tool.",
  input: sendMessageInput,
  async run({ token, input }: ToolContext<z.infer<typeof sendMessageInput>>): Promise<ToolResult> {
    try {
      const json = await slackPost<{ ts: string; channel: string }>(
        token,
        "chat.postMessage",
        { channel: input.channel, text: input.text }
      );
      return {
        ok: true,
        summary: `Sent message to ${input.channel}`,
        data: { ts: json.ts, channel: json.channel },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to send message", error: message };
    }
  },
};

registerTool(listChannels);
registerTool(sendMessage);
