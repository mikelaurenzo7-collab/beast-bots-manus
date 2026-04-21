import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "discord";
const BASE = "https://discord.com/api/v10";

async function discord<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// ─── list_guilds ──────────────────────────────────────────────────────────────

const listGuildsInput = z.object({});

type Guild = { id: string; name: string; owner?: boolean };

const listGuilds: Tool<z.infer<typeof listGuildsInput>> = {
  name: `${PROVIDER}.list_guilds`,
  label: "List Discord servers",
  provider: PROVIDER,
  description: "List Discord servers (guilds) the authenticated user belongs to.",
  input: listGuildsInput,
  async run({ token }: ToolContext<z.infer<typeof listGuildsInput>>): Promise<ToolResult> {
    try {
      const guilds = await discord<Guild[]>(token, `/users/@me/guilds`);
      const summary =
        guilds.length === 0
          ? "No Discord servers."
          : `${guilds.length} server${guilds.length === 1 ? "" : "s"}: ${guilds
              .slice(0, 5)
              .map((g) => g.name)
              .join(", ")}${guilds.length > 5 ? ", …" : ""}`;
      return { ok: true, summary, data: guilds.map((g) => ({ id: g.id, name: g.name, owner: !!g.owner })) };
    } catch (e) {
      return { ok: false, summary: "Failed to list guilds", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── get_me ───────────────────────────────────────────────────────────────────

const getMeInput = z.object({});

const getMe: Tool<z.infer<typeof getMeInput>> = {
  name: `${PROVIDER}.get_me`,
  label: "Get Discord profile",
  provider: PROVIDER,
  description: "Return the authenticated Discord user's profile.",
  input: getMeInput,
  async run({ token }: ToolContext<z.infer<typeof getMeInput>>): Promise<ToolResult> {
    try {
      const me = await discord<{ id: string; username: string; global_name?: string; email?: string }>(
        token,
        `/users/@me`
      );
      return {
        ok: true,
        summary: `Logged in as ${me.global_name ?? me.username}`,
        data: me,
      };
    } catch (e) {
      return { ok: false, summary: "Failed to fetch profile", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

registerTool(listGuilds);
registerTool(getMe);
