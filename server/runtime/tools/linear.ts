import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "linear";

async function linearGql<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Linear GraphQL error: ${json.errors[0].message}`);
  }
  return json.data as T;
}

// ─── list_issues ──────────────────────────────────────────────────────────────

const listLinearIssuesInput = z.object({
  limit: z.number().int().min(1).max(50).optional().describe("Max issues to return (default 20)"),
});

type LinearIssueNode = {
  id: string;
  title: string;
  state?: { name: string };
  assignee?: { name: string } | null;
};

const listLinearIssues: Tool<z.infer<typeof listLinearIssuesInput>> = {
  name: `${PROVIDER}.list_issues`,
  label: "List Linear issues",
  provider: PROVIDER,
  description: "List active (unstarted and started) issues assigned to the user's teams.",
  input: listLinearIssuesInput,
  async run({ token, input }: ToolContext<z.infer<typeof listLinearIssuesInput>>): Promise<ToolResult> {
    try {
      const limit = input.limit ?? 20;
      const data = await linearGql<{ issues: { nodes: LinearIssueNode[] } }>(
        token,
        `query ListIssues($limit: Int) {
          issues(first: $limit, filter: { state: { type: { in: ["unstarted", "started"] } } }) {
            nodes { id title state { name } assignee { name } }
          }
        }`,
        { limit }
      );
      const nodes = data.issues?.nodes ?? [];
      const summary =
        nodes.length === 0
          ? "No active issues found."
          : `Found ${nodes.length} active issue${nodes.length === 1 ? "" : "s"}: ${nodes
              .slice(0, 5)
              .map((i) => i.title)
              .join(", ")}${nodes.length > 5 ? ", …" : ""}`;
      return {
        ok: true,
        summary,
        data: nodes.map((i) => ({
          id: i.id,
          title: i.title,
          state: i.state?.name,
          assignee: i.assignee?.name,
        })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to list Linear issues", error: message };
    }
  },
};

// ─── create_issue ─────────────────────────────────────────────────────────────

const createLinearIssueInput = z.object({
  team_id: z.string().describe("Linear team ID to create the issue in"),
  title: z.string().min(1).describe("Issue title"),
  description: z.string().optional().describe("Optional issue description (Markdown)"),
});

type CreatedLinearIssue = {
  issueCreate: { success: boolean; issue: { id: string; title: string; url: string } };
};

const createLinearIssue: Tool<z.infer<typeof createLinearIssueInput>> = {
  name: `${PROVIDER}.create_issue`,
  label: "Create Linear issue",
  provider: PROVIDER,
  description: "Create a new issue in a Linear team.",
  input: createLinearIssueInput,
  async run({ token, input }: ToolContext<z.infer<typeof createLinearIssueInput>>): Promise<ToolResult> {
    try {
      const data = await linearGql<CreatedLinearIssue>(
        token,
        `mutation CreateIssue($title: String!, $description: String, $teamId: String!) {
          issueCreate(input: { title: $title, description: $description, teamId: $teamId }) {
            success
            issue { id title url }
          }
        }`,
        { title: input.title, description: input.description, teamId: input.team_id }
      );
      const issue = data.issueCreate?.issue;
      return {
        ok: data.issueCreate?.success ?? false,
        summary: issue ? `Created Linear issue "${issue.title}"` : "Failed to create Linear issue",
        data: issue ? { id: issue.id, title: issue.title, url: issue.url } : undefined,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to create Linear issue", error: message };
    }
  },
};

// ─── list_teams ───────────────────────────────────────────────────────────────

const listLinearTeamsInput = z.object({});

type LinearTeamNode = { id: string; name: string };

const listLinearTeams: Tool<z.infer<typeof listLinearTeamsInput>> = {
  name: `${PROVIDER}.list_teams`,
  label: "List Linear teams",
  provider: PROVIDER,
  description: "List all teams in the Linear workspace.",
  input: listLinearTeamsInput,
  async run({ token }: ToolContext<z.infer<typeof listLinearTeamsInput>>): Promise<ToolResult> {
    try {
      const data = await linearGql<{ teams: { nodes: LinearTeamNode[] } }>(
        token,
        `{ teams { nodes { id name } } }`
      );
      const nodes = data.teams?.nodes ?? [];
      const summary =
        nodes.length === 0
          ? "No teams found."
          : `Found ${nodes.length} team${nodes.length === 1 ? "" : "s"}: ${nodes.map((t) => t.name).join(", ")}`;
      return { ok: true, summary, data: nodes };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: "Failed to list Linear teams", error: message };
    }
  },
};

registerTool(listLinearIssues);
registerTool(createLinearIssue);
registerTool(listLinearTeams);
