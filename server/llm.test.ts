import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHeuristicMissionSynthesis, generateMissionSynthesis } from "./_core/llm";

describe("mission synthesis", () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    vi.unstubAllGlobals();
  });

  it("builds a heuristic synthesis when no LLM key is configured", async () => {
    const result = await generateMissionSynthesis({
      missionTitle: "Release Radar",
      missionOutcome: "A live launch board that knows what is blocked, who owns it, and what changed.",
      payload: { owner: "acme", repo: "core-app" },
      headline: "Release Radar pushed to #launch-war-room",
      narrative: "Bot Boss scanned the repo and queue, then posted the brief.",
      sections: [
        { connectorLabel: "GitHub", title: "GitHub repo risk", ok: true, summary: "Three open issues sampled." },
        { connectorLabel: "Slack", title: "Slack release brief", ok: true, summary: "Posted the brief." },
      ],
      recommendedNext: ["Pin the launch brief.", "Convert repo risk into owned work."],
    });

    expect(result.source).toBe("heuristic");
    expect(result.executiveSummary).toContain("Release Radar");
    expect(result.nextMoves).toHaveLength(2);
  });

  it("falls back to a blocked heuristic when sections fail", () => {
    const result = buildHeuristicMissionSynthesis({
      missionTitle: "Decision Loop",
      missionOutcome: "A reliable path from insight to record to execution.",
      payload: { issueTitle: "Ship Friday" },
      headline: "Decision Loop only partially completed",
      narrative: "One downstream system failed.",
      sections: [
        { connectorLabel: "Linear", title: "Linear execution issue", ok: true, summary: "Created ENG-42." },
        { connectorLabel: "Slack", title: "Slack decision broadcast", ok: false, summary: "Failed to post.", error: "channel_not_found" },
        { connectorLabel: "Notion", title: "Notion decision record", ok: false, summary: "Failed to append.", error: "unauthorized" },
      ],
      recommendedNext: ["Fix the Slack channel target.", "Fix the Notion page target."],
    });

    expect(result.operatorVerdict).toBe("blocked");
  });

  it("uses OpenAI synthesis when an API key is configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_MODEL = "gpt-test-mini";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    executiveSummary: "Launch risk is visible and the team now has one operating brief.",
                    operatorVerdict: "watch",
                    nextMoves: ["Pin the Slack brief.", "Assign the top blocker.", "Review the queue at noon."],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const result = await generateMissionSynthesis({
      missionTitle: "Release Radar",
      missionOutcome: "A live launch board that knows what is blocked, who owns it, and what changed.",
      payload: { owner: "acme", repo: "core-app" },
      headline: "Release Radar pushed to #launch-war-room",
      narrative: "Bot Boss scanned the repo and queue, then posted the brief.",
      sections: [
        { connectorLabel: "GitHub", title: "GitHub repo risk", ok: true, summary: "Three open issues sampled." },
        { connectorLabel: "Slack", title: "Slack release brief", ok: true, summary: "Posted the brief." },
      ],
      recommendedNext: ["Pin the launch brief.", "Convert repo risk into owned work."],
    });

    expect(result.source).toBe("openai");
    expect(result.model).toBe("gpt-test-mini");
    expect(result.operatorVerdict).toBe("watch");
  });
});