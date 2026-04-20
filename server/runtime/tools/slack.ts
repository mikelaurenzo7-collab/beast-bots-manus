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

// ─── search_messages ──────────────────────────────────────────────────────────

const searchMessagesInput = z.object({
  query: z.string().min(1).describe("Search query string"),
});

type SlackMatch = {
  text?: string;
  channel?: { name?: string };
  ts?: string;
};

const searchMessages: Tool<z.infer<typeof searchMessagesInput>> = {
  name: `${PROVIDER}.search_messages`,
  label: "Search messages",
  provider: PROVIDER,
  description: "Search Slack messages across all accessible channels.",
  input: searchMessagesInput,
  async run({ token, input }: ToolContext<z.infer<typeof searchMessagesInput>>): Promise<ToolResult> {
    try {
      const json = await slackGet<{ messages?: { matches?: SlackMatch[] } }>(
        token,
        "search.messages",
        { query: input.query, count: "5" }
      );
      const matches = json.messages?.matches ?? [];
      const summary =
        matches.length === 0
          ? `No messages found for "${input.query}".`
          : `Found ${matches.length} message${matches.length === 1 ? "" : "s"} for "${input.query}".`;
      return {
        ok: true,
        summary,
        data: matches.map((m) => ({
          text: m.text,
          channel: m.channel?.name,
          ts: m.ts,
        })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to search messages", error: message };
    }
  },
};

// ─── get_channel_history ──────────────────────────────────────────────────────

const getChannelHistoryInput = z.object({
  channel: z.string().describe("Channel ID (e.g. C01234567) — use slack.list_channels to look up IDs"),
  limit: z.number().int().min(1).max(50).optional().describe("Number of messages (default 10)"),
});

type SlackHistoryMessage = { text?: string; user?: string; ts?: string };

const getChannelHistory: Tool<z.infer<typeof getChannelHistoryInput>> = {
  name: `${PROVIDER}.get_channel_history`,
  label: "Get channel history",
  provider: PROVIDER,
  description: "Fetch the most recent messages from a Slack channel.",
  input: getChannelHistoryInput,
  async run({ token, input }: ToolContext<z.infer<typeof getChannelHistoryInput>>): Promise<ToolResult> {
    try {
      const limit = String(input.limit ?? 10);
      const json = await slackGet<{ messages?: SlackHistoryMessage[] }>(
        token,
        "conversations.history",
        { channel: input.channel, limit }
      );
      const messages = json.messages ?? [];
      const summary =
        messages.length === 0
          ? `No messages in channel ${input.channel}.`
          : `Retrieved ${messages.length} message${messages.length === 1 ? "" : "s"} from channel ${input.channel}.`;
      return {
        ok: true,
        summary,
        data: messages.map((m) => ({ text: m.text, user: m.user, ts: m.ts })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to get channel history", error: message };
    }
  },
};

registerTool(searchMessages);
registerTool(getChannelHistory);
