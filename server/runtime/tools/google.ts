import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "google";

async function google<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ─── gmail.list_unread ────────────────────────────────────────────────────────

const gmailListInput = z.object({
  query: z.string().optional().describe("Gmail search query (e.g. 'is:unread newer_than:1d')"),
  limit: z.number().int().min(1).max(25).optional(),
});

type GmailListResponse = {
  messages?: { id: string; threadId: string }[];
  resultSizeEstimate?: number;
};

type GmailMessage = {
  id: string;
  snippet?: string;
  payload?: { headers?: { name: string; value: string }[] };
};

const gmailListUnread: Tool<z.infer<typeof gmailListInput>> = {
  name: `${PROVIDER}.gmail_list`,
  label: "List Gmail messages",
  provider: PROVIDER,
  description:
    "Search Gmail and return metadata (subject/from/snippet) for up to 25 messages. Default query is 'is:unread'.",
  input: gmailListInput,
  async run({ token, input }: ToolContext<z.infer<typeof gmailListInput>>): Promise<ToolResult> {
    try {
      const q = input.query ?? "is:unread";
      const limit = Math.min(input.limit ?? 10, 25);
      const list = await google<GmailListResponse>(
        token,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${limit}`
      );
      const ids = (list.messages ?? []).map((m) => m.id);
      const details = await Promise.all(
        ids.map((id) =>
          google<GmailMessage>(
            token,
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
          ).catch(() => null)
        )
      );
      const rows = details
        .filter((m): m is GmailMessage => !!m)
        .map((m) => {
          const headers = m.payload?.headers ?? [];
          const h = (name: string) => headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value;
          return { id: m.id, from: h("From") ?? "?", subject: h("Subject") ?? "(no subject)", snippet: m.snippet ?? "" };
        });
      const summary =
        rows.length === 0
          ? `No messages match "${q}".`
          : `Found ${rows.length} message${rows.length === 1 ? "" : "s"}: ` +
            rows
              .slice(0, 3)
              .map((r) => `"${r.subject}" — ${r.from}`)
              .join("; ");
      return { ok: true, summary, data: rows };
    } catch (e) {
      return { ok: false, summary: "Failed to list Gmail", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── gmail.send ───────────────────────────────────────────────────────────────

const gmailSendInput = z.object({
  to: z.string().describe("Recipient email address"),
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Plain-text email body"),
  cc: z.string().optional().describe("Optional CC address"),
});

function buildRawEmail({ to, cc, subject, body }: z.infer<typeof gmailSendInput>): string {
  const lines = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

const gmailSend: Tool<z.infer<typeof gmailSendInput>> = {
  name: `${PROVIDER}.gmail_send`,
  label: "Send Gmail",
  provider: PROVIDER,
  description:
    "Send a plain-text email through the authenticated Gmail account. Always confirm the recipient and subject with the user before calling.",
  input: gmailSendInput,
  async run({ token, input }: ToolContext<z.infer<typeof gmailSendInput>>): Promise<ToolResult> {
    try {
      const raw = buildRawEmail(input);
      const res = await google<{ id: string; threadId: string }>(
        token,
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        { method: "POST", body: JSON.stringify({ raw }) }
      );
      return {
        ok: true,
        summary: `Email sent to ${input.to} — "${input.subject}"`,
        data: { messageId: res.id, threadId: res.threadId },
      };
    } catch (e) {
      return { ok: false, summary: "Failed to send email", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── calendar.list_events ─────────────────────────────────────────────────────

const calendarListInput = z.object({
  calendarId: z.string().optional().describe("Calendar id (default 'primary')"),
  daysAhead: z.number().int().min(0).max(60).optional().describe("How many days ahead to include (default 7)"),
  limit: z.number().int().min(1).max(25).optional(),
});

type CalendarEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
  attendees?: { email: string }[];
};

const calendarListEvents: Tool<z.infer<typeof calendarListInput>> = {
  name: `${PROVIDER}.calendar_list`,
  label: "List calendar events",
  provider: PROVIDER,
  description: "List upcoming events from the user's Google Calendar, sorted by start time.",
  input: calendarListInput,
  async run({ token, input }: ToolContext<z.infer<typeof calendarListInput>>): Promise<ToolResult> {
    try {
      const calendar = input.calendarId ?? "primary";
      const days = input.daysAhead ?? 7;
      const limit = input.limit ?? 10;
      const now = new Date();
      const end = new Date(now.getTime() + days * 86_400_000);
      const url =
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar)}/events` +
        `?timeMin=${encodeURIComponent(now.toISOString())}` +
        `&timeMax=${encodeURIComponent(end.toISOString())}` +
        `&maxResults=${limit}&orderBy=startTime&singleEvents=true`;
      const json = await google<{ items?: CalendarEvent[] }>(token, url);
      const events = (json.items ?? []).map((e) => ({
        id: e.id,
        summary: e.summary ?? "(no title)",
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        attendees: e.attendees?.length ?? 0,
        url: e.htmlLink,
      }));
      const summary =
        events.length === 0
          ? `No events in the next ${days} days.`
          : `${events.length} upcoming event${events.length === 1 ? "" : "s"}: ${events
              .slice(0, 3)
              .map((e) => e.summary)
              .join(", ")}${events.length > 3 ? ", …" : ""}`;
      return { ok: true, summary, data: events };
    } catch (e) {
      return { ok: false, summary: "Failed to list events", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── calendar.create_event ───────────────────────────────────────────────────

const calendarCreateInput = z.object({
  calendarId: z.string().optional().describe("Calendar id (default 'primary')"),
  summary: z.string().describe("Event title"),
  description: z.string().optional(),
  startIso: z.string().describe("Start time in ISO 8601 (e.g. 2026-04-21T15:00:00-07:00)"),
  endIso: z.string().describe("End time in ISO 8601"),
  attendees: z.array(z.string()).optional().describe("Attendee email addresses"),
});

const calendarCreateEvent: Tool<z.infer<typeof calendarCreateInput>> = {
  name: `${PROVIDER}.calendar_create_event`,
  label: "Create calendar event",
  provider: PROVIDER,
  description:
    "Create a new event on the user's Google Calendar. Always confirm the date/time and attendees before calling.",
  input: calendarCreateInput,
  async run({ token, input }: ToolContext<z.infer<typeof calendarCreateInput>>): Promise<ToolResult> {
    try {
      const calendar = input.calendarId ?? "primary";
      const body = {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startIso },
        end: { dateTime: input.endIso },
        attendees: (input.attendees ?? []).map((email) => ({ email })),
      };
      const created = await google<{ id: string; htmlLink?: string }>(
        token,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar)}/events`,
        { method: "POST", body: JSON.stringify(body) }
      );
      return {
        ok: true,
        summary: `Created event "${input.summary}" on ${input.startIso}`,
        data: { id: created.id, url: created.htmlLink },
      };
    } catch (e) {
      return { ok: false, summary: "Failed to create event", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

registerTool(gmailListUnread);
registerTool(gmailSend);
registerTool(calendarListEvents);
registerTool(calendarCreateEvent);
