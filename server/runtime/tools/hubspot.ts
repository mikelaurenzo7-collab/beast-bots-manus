import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "hubspot";
const BASE = "https://api.hubapi.com";

async function hub<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HubSpot ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// ─── list_contacts ────────────────────────────────────────────────────────────

const listContactsInput = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

type Contact = { id: string; properties: Record<string, string> };

const listContacts: Tool<z.infer<typeof listContactsInput>> = {
  name: `${PROVIDER}.list_contacts`,
  label: "List HubSpot contacts",
  provider: PROVIDER,
  description: "List recent HubSpot contacts with email, firstname and lastname properties.",
  input: listContactsInput,
  async run({ token, input }: ToolContext<z.infer<typeof listContactsInput>>): Promise<ToolResult> {
    try {
      const limit = input.limit ?? 10;
      const json = await hub<{ results: Contact[] }>(
        token,
        `/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,company`
      );
      const rows = json.results.map((c) => ({
        id: c.id,
        name: `${c.properties.firstname ?? ""} ${c.properties.lastname ?? ""}`.trim() || "(no name)",
        email: c.properties.email ?? null,
        company: c.properties.company ?? null,
      }));
      const summary =
        rows.length === 0
          ? "No HubSpot contacts found."
          : `${rows.length} contact${rows.length === 1 ? "" : "s"}: ${rows
              .slice(0, 3)
              .map((c) => c.email ?? c.name)
              .join(", ")}${rows.length > 3 ? ", …" : ""}`;
      return { ok: true, summary, data: rows };
    } catch (e) {
      return { ok: false, summary: "Failed to list contacts", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── create_contact ───────────────────────────────────────────────────────────

const createContactInput = z.object({
  email: z.string().email().describe("Primary email address — this is the HubSpot unique key"),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
});

const createContact: Tool<z.infer<typeof createContactInput>> = {
  name: `${PROVIDER}.create_contact`,
  label: "Create HubSpot contact",
  provider: PROVIDER,
  description:
    "Create a new contact in HubSpot CRM. Confirm the email (the unique key) with the user before calling.",
  input: createContactInput,
  async run({ token, input }: ToolContext<z.infer<typeof createContactInput>>): Promise<ToolResult> {
    try {
      const properties: Record<string, string> = { email: input.email };
      if (input.firstname) properties.firstname = input.firstname;
      if (input.lastname) properties.lastname = input.lastname;
      if (input.company) properties.company = input.company;
      if (input.phone) properties.phone = input.phone;
      const res = await hub<{ id: string; properties: Record<string, string> }>(
        token,
        `/crm/v3/objects/contacts`,
        { method: "POST", body: JSON.stringify({ properties }) }
      );
      return {
        ok: true,
        summary: `Created HubSpot contact ${res.id} for ${input.email}`,
        data: { id: res.id, email: input.email },
      };
    } catch (e) {
      return { ok: false, summary: "Failed to create contact", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

registerTool(listContacts);
registerTool(createContact);
