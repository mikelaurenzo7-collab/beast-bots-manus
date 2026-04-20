import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "github";
const BASE = "https://api.github.com";

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "beast-bots",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ─── list_repos ───────────────────────────────────────────────────────────────

const listReposInput = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe("Max number of repositories to return (default 10)"),
});

type RepoRow = { full_name: string; description: string | null; stargazers_count: number; private: boolean };

const listRepos: Tool<z.infer<typeof listReposInput>> = {
  name: `${PROVIDER}.list_repos`,
  label: "List repositories",
  provider: PROVIDER,
  description: "List the authenticated user's GitHub repositories, sorted by recent activity.",
  input: listReposInput,
  async run({ token, input }: ToolContext<z.infer<typeof listReposInput>>): Promise<ToolResult> {
    try {
      const limit = input.limit ?? 10;
      const rows = await gh<RepoRow[]>(token, `/user/repos?per_page=${limit}&sort=updated`);
      const summary =
        rows.length === 0
          ? "No repositories found."
          : `Found ${rows.length} repo${rows.length === 1 ? "" : "s"}: ${rows
              .slice(0, 5)
              .map((r) => r.full_name)
              .join(", ")}${rows.length > 5 ? ", …" : ""}`;
      return {
        ok: true,
        summary,
        data: rows.map((r) => ({
          name: r.full_name,
          description: r.description,
          stars: r.stargazers_count,
          private: r.private,
        })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: `Failed to list repos`, error: message };
    }
  },
};

// ─── list_issues ──────────────────────────────────────────────────────────────

const listIssuesInput = z.object({
  owner: z.string().describe("Repository owner (user or org)"),
  repo: z.string().describe("Repository name"),
  state: z.enum(["open", "closed", "all"]).optional().describe("Issue state filter (default 'open')"),
  limit: z.number().int().min(1).max(30).optional(),
});

type IssueRow = { number: number; title: string; state: string; html_url: string; user: { login: string } | null };

const listIssues: Tool<z.infer<typeof listIssuesInput>> = {
  name: `${PROVIDER}.list_issues`,
  label: "List issues",
  provider: PROVIDER,
  description: "List issues in a GitHub repository. Filter by open/closed state.",
  input: listIssuesInput,
  async run({ token, input }: ToolContext<z.infer<typeof listIssuesInput>>): Promise<ToolResult> {
    try {
      const limit = input.limit ?? 10;
      const state = input.state ?? "open";
      const rows = await gh<IssueRow[]>(
        token,
        `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues?state=${state}&per_page=${limit}`
      );
      const summary =
        rows.length === 0
          ? `No ${state} issues in ${input.owner}/${input.repo}.`
          : `Found ${rows.length} ${state} issue${rows.length === 1 ? "" : "s"} in ${input.owner}/${input.repo}.`;
      return {
        ok: true,
        summary,
        data: rows.map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          author: i.user?.login,
          url: i.html_url,
        })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to list issues", error: message };
    }
  },
};

// ─── create_issue ─────────────────────────────────────────────────────────────

const createIssueInput = z.object({
  owner: z.string(),
  repo: z.string(),
  title: z.string().describe("Issue title"),
  body: z.string().optional().describe("Issue body (Markdown)"),
});

type CreatedIssue = { number: number; html_url: string; title: string };

const createIssue: Tool<z.infer<typeof createIssueInput>> = {
  name: `${PROVIDER}.create_issue`,
  label: "Create issue",
  provider: PROVIDER,
  description: "Open a new issue in a GitHub repository.",
  input: createIssueInput,
  async run({ token, input }: ToolContext<z.infer<typeof createIssueInput>>): Promise<ToolResult> {
    try {
      const issue = await gh<CreatedIssue>(
        token,
        `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues`,
        { method: "POST", body: JSON.stringify({ title: input.title, body: input.body }) }
      );
      return {
        ok: true,
        summary: `Opened issue #${issue.number} in ${input.owner}/${input.repo}`,
        data: { number: issue.number, url: issue.html_url, title: issue.title },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to create issue", error: message };
    }
  },
};

registerTool(listRepos);
registerTool(listIssues);
registerTool(createIssue);
