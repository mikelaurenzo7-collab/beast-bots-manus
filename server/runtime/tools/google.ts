import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "google";
const GAPI_BASE = "https://www.googleapis.com";

async function gapi<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GAPI_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ─── list_events ──────────────────────────────────────────────────────────────

const listEventsInput = z.object({
  limit: z.number().int().min(1).max(50).optional().describe("Max events to return (default 10)"),
});

type CalendarEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

const listEvents: Tool<z.infer<typeof listEventsInput>> = {
  name: `${PROVIDER}.list_events`,
  label: "List calendar events",
  provider: PROVIDER,
  description: "List upcoming events from the user's primary Google Calendar.",
  input: listEventsInput,
  async run({ token, input }: ToolContext<z.infer<typeof listEventsInput>>): Promise<ToolResult> {
    try {
      const limit = input.limit ?? 10;
      const timeMin = new Date().toISOString();
      const data = await gapi<{ items?: CalendarEvent[] }>(
        token,
        `/calendar/v3/calendars/primary/events?maxResults=${limit}&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(timeMin)}`
      );
      const events = data.items ?? [];
      const summary =
        events.length === 0
          ? "No upcoming calendar events."
          : `Found ${events.length} upcoming event${events.length === 1 ? "" : "s"}: ${events
              .slice(0, 3)
              .map((e) => e.summary ?? "(no title)")
              .join(", ")}${events.length > 3 ? ", …" : ""}`;
      return {
        ok: true,
        summary,
        data: events.map((e) => ({
          id: e.id,
          summary: e.summary,
          start: e.start?.dateTime ?? e.start?.date,
          end: e.end?.dateTime ?? e.end?.date,
        })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to list calendar events", error: message };
    }
  },
};

// ─── create_event ─────────────────────────────────────────────────────────────

const createEventInput = z.object({
  summary: z.string().min(1).describe("Event title"),
  start: z.string().describe("Start datetime in ISO 8601 format (e.g. 2025-01-15T10:00:00-07:00)"),
  end: z.string().describe("End datetime in ISO 8601 format"),
  description: z.string().optional().describe("Optional event description"),
});

type CreatedEvent = { id: string; htmlLink?: string; summary?: string };

const createEvent: Tool<z.infer<typeof createEventInput>> = {
  name: `${PROVIDER}.create_event`,
  label: "Create calendar event",
  provider: PROVIDER,
  description: "Create a new event in the user's primary Google Calendar.",
  input: createEventInput,
  async run({ token, input }: ToolContext<z.infer<typeof createEventInput>>): Promise<ToolResult> {
    try {
      const event = await gapi<CreatedEvent>(
        token,
        "/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          body: JSON.stringify({
            summary: input.summary,
            description: input.description,
            start: { dateTime: input.start },
            end: { dateTime: input.end },
          }),
        }
      );
      return {
        ok: true,
        summary: `Created event "${input.summary}"`,
        data: { id: event.id, url: event.htmlLink, summary: event.summary },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to create calendar event", error: message };
    }
  },
};

// ─── list_emails ──────────────────────────────────────────────────────────────

const listEmailsInput = z.object({
  query: z.string().optional().describe("Gmail search query (e.g. 'from:boss@example.com is:unread')"),
  limit: z.number().int().min(1).max(20).optional().describe("Max emails to return (default 5)"),
});

type GmailMessageRef = { id: string };
type GmailMessage = {
  id: string;
  snippet?: string;
  payload?: {
    headers?: { name: string; value: string }[];
  };
};

const listEmails: Tool<z.infer<typeof listEmailsInput>> = {
  name: `${PROVIDER}.list_emails`,
  label: "List emails",
  provider: PROVIDER,
  description: "List recent emails from Gmail, optionally filtered by a search query.",
  input: listEmailsInput,
  async run({ token, input }: ToolContext<z.infer<typeof listEmailsInput>>): Promise<ToolResult> {
    try {
      const limit = input.limit ?? 5;
      const q = input.query ? `&q=${encodeURIComponent(input.query)}` : "";
      const list = await gapi<{ messages?: GmailMessageRef[] }>(
        token,
        `/gmail/v1/users/me/messages?maxResults=${limit}${q}`
      );
      const refs = list.messages ?? [];
      if (refs.length === 0) {
        return { ok: true, summary: "No emails found.", data: [] };
      }
      const messages = await Promise.all(
        refs.map((r) =>
          gapi<GmailMessage>(token, `/gmail/v1/users/me/messages/${r.id}?format=metadata&metadataHeaders=Subject`)
        )
      );
      const emails = messages.map((m) => {
        const subject =
          m.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")?.value ?? "(no subject)";
        return { id: m.id, subject, snippet: m.snippet };
      });
      const summary = `Retrieved ${emails.length} email${emails.length === 1 ? "" : "s"}: ${emails
        .slice(0, 3)
        .map((e) => e.subject)
        .join(", ")}${emails.length > 3 ? ", …" : ""}`;
      return { ok: true, summary, data: emails };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to list emails", error: message };
    }
  },
};

registerTool(listEvents);
registerTool(createEvent);
registerTool(listEmails);
