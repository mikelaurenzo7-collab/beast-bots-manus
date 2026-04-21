import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "linkedin";

async function linkedin<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "x-restli-protocol-version": "2.0.0",
      accept: "application/json",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`LinkedIn ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// ─── profile ──────────────────────────────────────────────────────────────────

const profileInput = z.object({});

const profile: Tool<z.infer<typeof profileInput>> = {
  name: `${PROVIDER}.profile`,
  label: "Get LinkedIn profile",
  provider: PROVIDER,
  description: "Fetch the authenticated user's LinkedIn profile (OpenID userinfo).",
  input: profileInput,
  async run({ token }: ToolContext<z.infer<typeof profileInput>>): Promise<ToolResult> {
    try {
      const me = await linkedin<{ sub: string; name?: string; email?: string; picture?: string }>(
        token,
        "https://api.linkedin.com/v2/userinfo"
      );
      return {
        ok: true,
        summary: `${me.name ?? "(unnamed)"}${me.email ? ` <${me.email}>` : ""}`,
        data: me,
      };
    } catch (e) {
      return { ok: false, summary: "Failed to load profile", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── share_post ───────────────────────────────────────────────────────────────

const shareInput = z.object({
  text: z.string().min(1).max(3000).describe("Post body — LinkedIn allows up to 3000 characters"),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]).optional(),
});

const share: Tool<z.infer<typeof shareInput>> = {
  name: `${PROVIDER}.share_post`,
  label: "Share LinkedIn post",
  provider: PROVIDER,
  description:
    "Publish a text post to the authenticated user's LinkedIn feed. Always confirm the body before calling.",
  input: shareInput,
  async run({ token, input }: ToolContext<z.infer<typeof shareInput>>): Promise<ToolResult> {
    try {
      const me = await linkedin<{ sub: string }>(token, "https://api.linkedin.com/v2/userinfo");
      const author = `urn:li:person:${me.sub}`;
      const body = {
        author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: input.text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": input.visibility ?? "PUBLIC",
        },
      };
      const res = await linkedin<{ id: string }>(token, "https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return { ok: true, summary: `Published LinkedIn post ${res.id}`, data: { id: res.id } };
    } catch (e) {
      return { ok: false, summary: "Failed to share post", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

registerTool(profile);
registerTool(share);
