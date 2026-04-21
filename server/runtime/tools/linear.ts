import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "linear";
const ENDPOINT = "https://api.linear.app/graphql";

async function linearQuery<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`Linear GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  if (!json.data) throw new Error("Linear returned no data");
  return json.data;
}

// ─── list_issues ──────────────────────────────────────────────────────────────

const listIssuesInput = z.object({
  teamKey: z.string().optional().describe("Team key filter (e.g. 'ENG'). If omitted, returns issues across all teams."),
  state: z.enum(["open", "in_progress", "done", "all"]).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

type IssueNode = {
  id: string;
  identifier: string;
  title: string;
  state: { name: string; type: string };
  assignee?: { name?: string } | null;
  url: string;
};

const listIssues: Tool<z.infer<typeof listIssuesInput>> = {
  name: `${PROVIDER}.list_issues`,
  label: "List Linear issues",
  provider: PROVIDER,
  description: "List issues from Linear, optionally filtered by team key and state.",
  input: listIssuesInput,
  async run({ token, input }: ToolContext<z.infer<typeof listIssuesInput>>): Promise<ToolResult> {
    try {
      const first = Math.min(input.limit ?? 10, 25);
      const stateMap: Record<string, string[]> = {
        open: ["unstarted", "backlog"],
        in_progress: ["started"],
        done: ["completed"],
        all: [],
      };
      const stateTypes = input.state ? stateMap[input.state] : [];
      const query = /* GraphQL */ `
        query Issues($first: Int!, $teamKey: String, $stateTypes: [String!]) {
          issues(
            first: $first
            filter: {
              team: { key: { eq: $teamKey } }
              state: { type: { in: $stateTypes } }
            }
            orderBy: updatedAt
          ) {
            nodes { id identifier title state { name type } assignee { name } url }
          }
        }
      `;
      // Linear's filter skips null keys automatically.
      const variables: Record<string, unknown> = { first };
      if (input.teamKey) variables.teamKey = input.teamKey;
      if (stateTypes.length > 0) variables.stateTypes = stateTypes;

      const data = await linearQuery<{ issues: { nodes: IssueNode[] } }>(token, query, variables);
      const rows = data.issues.nodes.map((n) => ({
        id: n.identifier,
        title: n.title,
        state: n.state.name,
        assignee: n.assignee?.name ?? null,
        url: n.url,
      }));
      const summary =
        rows.length === 0
          ? "No matching Linear issues."
          : `${rows.length} issue${rows.length === 1 ? "" : "s"}: ${rows.slice(0, 3).map((r) => `${r.id} ${r.title}`).join("; ")}`;
      return { ok: true, summary, data: rows };
    } catch (e) {
      return { ok: false, summary: "Failed to list issues", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── create_issue ─────────────────────────────────────────────────────────────

const createIssueInput = z.object({
  teamKey: z.string().describe("Team key, e.g. 'ENG'"),
  title: z.string().describe("Issue title"),
  description: z.string().optional().describe("Markdown description"),
});

const createIssue: Tool<z.infer<typeof createIssueInput>> = {
  name: `${PROVIDER}.create_issue`,
  label: "Create Linear issue",
  provider: PROVIDER,
  description: "Create a new issue in Linear. Confirm the team key and title with the user before calling.",
  input: createIssueInput,
  async run({ token, input }: ToolContext<z.infer<typeof createIssueInput>>): Promise<ToolResult> {
    try {
      const teamQuery = /* GraphQL */ `
        query Team($key: String!) { teams(filter: { key: { eq: $key } }, first: 1) { nodes { id } } }
      `;
      const team = await linearQuery<{ teams: { nodes: { id: string }[] } }>(token, teamQuery, {
        key: input.teamKey,
      });
      const teamId = team.teams.nodes[0]?.id;
      if (!teamId) return { ok: false, summary: `Team ${input.teamKey} not found`, error: "no_team" };

      const mutation = /* GraphQL */ `
        mutation Create($teamId: String!, $title: String!, $description: String) {
          issueCreate(input: { teamId: $teamId, title: $title, description: $description }) {
            success
            issue { id identifier url title }
          }
        }
      `;
      const res = await linearQuery<{
        issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string; title: string } };
      }>(token, mutation, { teamId, title: input.title, description: input.description });

      const issue = res.issueCreate.issue;
      return {
        ok: res.issueCreate.success,
        summary: `Created ${issue.identifier} — "${issue.title}"`,
        data: { id: issue.id, identifier: issue.identifier, url: issue.url },
      };
    } catch (e) {
      return { ok: false, summary: "Failed to create issue", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

registerTool(listIssues);
registerTool(createIssue);
