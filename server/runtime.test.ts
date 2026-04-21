import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIONS } from "../shared/actions";
import { MISSIONS } from "../shared/missions";
import { runActionWithTokens, runMissionWithTokens } from "./runtime/orchestrator";
import "./runtime";
import { getTool, listToolNames } from "./runtime";

describe("runtime registry", () => {
  it("registers the curated Bot Boss tools", () => {
    const names = listToolNames();
    expect(names).toContain("github.list_repos");
    expect(names).toContain("github.list_issues");
    expect(names).toContain("github.create_issue");
    expect(names).toContain("slack.list_channels");
    expect(names).toContain("slack.send_message");
    expect(names).toContain("notion.list_databases");
    expect(names).toContain("notion.append_block");
    expect(names).toContain("linear.list_issues");
    expect(names).toContain("linear.create_issue");
  });

  it("keeps every visible action wired to a registered tool", () => {
    const registered = new Set(listToolNames());
    for (const action of ACTIONS) {
      expect(registered.has(action.toolName), `${action.id} is missing ${action.toolName}`).toBe(true);
    }
  });

  it("has one live mission and at least one future mission", () => {
    expect(MISSIONS.filter((mission) => mission.status === "live").length).toBeGreaterThanOrEqual(3);
    expect(MISSIONS.some((mission) => mission.status === "next")).toBe(true);
  });
});

describe("action orchestration", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails cleanly when a connector token is missing", async () => {
    const result = await runActionWithTokens(
      "github.list-repos",
      { limit: 5 },
      {
        github: undefined,
        slack: undefined,
        notion: undefined,
        linear: undefined,
      }
    );

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("Set GITHUB credentials first");
  });

  it("runs a github read action with mocked fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { full_name: "acme/core", description: "Core app", stargazers_count: 12, private: false },
            { full_name: "acme/site", description: null, stargazers_count: 3, private: true },
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      )
    );

    const result = await runActionWithTokens(
      "github.list-repos",
      { limit: 2 },
      {
        github: "ghp_test",
        slack: undefined,
        notion: undefined,
        linear: undefined,
      }
    );

    expect(result.ok).toBe(true);
    expect(result.summary).toContain("acme/core");
    expect(result.toolName).toBe("github.list_repos");
  });

  it("keeps direct tool lookup available for future UI extensions", () => {
    expect(getTool("linear.create_issue")).toBeDefined();
  });

  it("runs release radar across GitHub, Linear, and Slack", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("api.github.com/repos/acme/core-app/issues")) {
          return new Response(
            JSON.stringify([
              { number: 14, title: "Fix launch blocker triage", state: "open", html_url: "https://github.com/acme/core-app/issues/14", user: { login: "mike" } },
            ]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url === "https://api.linear.app/graphql") {
          return new Response(
            JSON.stringify({
              data: {
                issues: {
                  nodes: [
                    { id: "lin_1", identifier: "ENG-12", title: "Triage launch blockers", state: { name: "Backlog", type: "backlog" }, assignee: { name: "Alex" }, url: "https://linear.app/acme/issue/ENG-12" },
                  ],
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url === "https://slack.com/api/chat.postMessage") {
          return new Response(JSON.stringify({ ok: true, ts: "1.0", channel: "C1" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`Unexpected fetch: ${url} ${String(init?.method ?? "GET")}`);
      })
    );

    const result = await runMissionWithTokens(
      "release-radar",
      { owner: "acme", repo: "core-app", teamKey: "ENG", slackChannel: "#launch-war-room" },
      {
        github: "ghp_test",
        slack: "xoxb_test",
        notion: undefined,
        linear: "lin_test",
      }
    );

    expect(result.ok).toBe(true);
    expect(result.headline).toContain("#launch-war-room");
    expect(result.sections).toHaveLength(3);
    expect(result.synthesis?.executiveSummary).toContain("Release Radar");
  });

  it("runs decision loop across Linear, Notion, and Slack", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "https://api.linear.app/graphql") {
          const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string };
          if (body.query?.includes("query Team")) {
            return new Response(
              JSON.stringify({ data: { teams: { nodes: [{ id: "team_1" }] } } }),
              { status: 200, headers: { "content-type": "application/json" } }
            );
          }
          if (body.query?.includes("mutation Create")) {
            return new Response(
              JSON.stringify({ data: { issueCreate: { success: true, issue: { id: "issue_1", identifier: "ENG-42", url: "https://linear.app/acme/issue/ENG-42", title: "Ship Friday" } } } }),
              { status: 200, headers: { "content-type": "application/json" } }
            );
          }
        }
        if (url === "https://api.notion.com/v1/blocks/page_123/children") {
          return new Response(
            JSON.stringify({ results: [{ id: "block_1" }] }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url === "https://slack.com/api/chat.postMessage") {
          return new Response(JSON.stringify({ ok: true, ts: "2.0", channel: "C2" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const result = await runMissionWithTokens(
      "decision-loop",
      {
        issueTitle: "Ship Friday",
        decision: "Freeze scope and triage only launch blockers.",
        teamKey: "ENG",
        notionPageId: "page_123",
        slackChannel: "#leadership",
      },
      {
        github: undefined,
        slack: "xoxb_test",
        notion: "secret_notion",
        linear: "lin_test",
      }
    );

    expect(result.ok).toBe(true);
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0]?.summary).toContain("ENG-42");
    expect(result.synthesis?.nextMoves.length).toBeGreaterThan(0);
  });
});