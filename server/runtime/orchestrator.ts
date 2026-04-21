import { getActionById } from "../../shared/actions";
import { CONNECTORS, type ConnectorId } from "../../shared/connectors";
import type { RunSynthesis } from "../../shared/history";
import { getMissionById, type MissionDefinition } from "../../shared/missions";
import { generateMissionSynthesis } from "../_core/llm";
import "./index";
import { getTool } from "./registry";
import type { ToolResult } from "./types";

type ConnectorTokens = Record<ConnectorId, string | undefined>;

type UnknownRecord = Record<string, unknown>;

export type ActionRunResult = ToolResult & {
  connectorId: ConnectorId;
  toolName: string;
};

export type MissionRunSection = {
  id: string;
  title: string;
  connectorId?: ConnectorId;
  connectorLabel: string;
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
};

export type MissionRunResult = {
  ok: boolean;
  headline: string;
  narrative: string;
  sections: MissionRunSection[];
  recommendedNext: string[];
  synthesis?: RunSynthesis;
};

export async function runActionWithTokens(
  actionId: string,
  payload: Record<string, unknown>,
  connectorTokens: ConnectorTokens
): Promise<ActionRunResult> {
  const action = getActionById(actionId);
  if (!action) {
    return {
      ok: false,
      summary: "Unknown action",
      error: `No action found for ${actionId}`,
      connectorId: "github",
      toolName: "unknown",
    };
  }

  const token = connectorTokens[action.connectorId];
  if (!token) {
    return {
      ok: false,
      summary: `Set ${action.connectorId.toUpperCase()} credentials first`,
      error: `Missing token for ${action.connectorId}`,
      connectorId: action.connectorId,
      toolName: action.toolName,
    };
  }

  const tool = getTool(action.toolName);
  if (!tool) {
    return {
      ok: false,
      summary: `Tool ${action.toolName} is not registered`,
      error: "missing_tool",
      connectorId: action.connectorId,
      toolName: action.toolName,
    };
  }

  const parsed = tool.input.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      summary: `Invalid payload for ${action.label}`,
      error: parsed.error.message,
      connectorId: action.connectorId,
      toolName: action.toolName,
    };
  }

  const result = await tool.run({ token, input: parsed.data });
  return {
    ...result,
    connectorId: action.connectorId,
    toolName: action.toolName,
  };
}

export async function runConnectorProbe(connectorId: ConnectorId, connectorTokens: ConnectorTokens) {
  const connector = CONNECTORS.find((item) => item.id === connectorId);
  if (!connector) {
    return {
      ok: false,
      summary: "Unknown connector",
      error: `No connector found for ${connectorId}`,
      connectorId,
      toolName: "unknown",
    } satisfies ActionRunResult;
  }

  const probeAction = getActionById(connector.probeActionId);
  return runActionWithTokens(connector.probeActionId, probeAction?.defaultPayload ?? {}, connectorTokens);
}

function getConnectorLabel(connectorId?: ConnectorId) {
  if (!connectorId) return "Mission";
  return CONNECTORS.find((item) => item.id === connectorId)?.label ?? connectorId;
}

function hasValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return value !== undefined && value !== null;
}

function getStringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function toRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : undefined;
}

function getRecordString(record: UnknownRecord | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getRecordNumber(record: UnknownRecord | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "number" ? value : undefined;
}

function rowsFromData(data: unknown) {
  return Array.isArray(data)
    ? data.filter((item): item is UnknownRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function buildSection(
  id: string,
  title: string,
  connectorId: ConnectorId | undefined,
  result: ActionRunResult,
  summary?: string
): MissionRunSection {
  return {
    id,
    title,
    connectorId,
    connectorLabel: getConnectorLabel(connectorId),
    ok: result.ok,
    summary: summary ?? result.summary,
    data: result.data,
    error: result.error,
  };
}

function invalidMissionResult(headline: string, narrative: string, recommendedNext: string[]): MissionRunResult {
  return {
    ok: false,
    headline,
    narrative,
    sections: [],
    recommendedNext,
  };
}

function validateMissionPayload(mission: MissionDefinition, payload: Record<string, unknown>) {
  return mission.fields
    .filter((field) => field.required && !hasValue(payload[field.key]))
    .map((field) => field.label);
}

async function runDailyOperatorSnapshot(connectorTokens: ConnectorTokens): Promise<MissionRunResult> {
  const mission = getMissionById("daily-operator-snapshot")!;
  const probeRuns = await Promise.all(mission.connectorIds.map((connectorId) => runConnectorProbe(connectorId, connectorTokens)));
  const liveSections = probeRuns.filter((section) => section.ok);
  const missingSections = probeRuns.filter((section) => !section.ok);
  const sections = probeRuns.map((section) => {
    const connectorLabel = getConnectorLabel(section.connectorId);
    return buildSection(
      `${section.connectorId}-probe`,
      `${connectorLabel} pulse`,
      section.connectorId,
      section,
      section.ok
        ? `${connectorLabel} is live. ${section.summary}`
        : `${connectorLabel} is not active yet. ${section.summary}`
    );
  });

  const headline =
    liveSections.length > 0
      ? `Snapshot compiled from ${liveSections.length} live connector${liveSections.length === 1 ? "" : "s"}`
      : "No live connectors configured yet";

  const narrative =
    liveSections.length > 0
      ? liveSections.map((section) => section.summary).join(" ")
      : "Set at least one connector token in .env to let Bot Boss operate against real systems.";

  const recommendedNext = [
    ...missingSections.map((section) => `Configure ${section.connectorId} to pull it into the daily snapshot.`),
    ...(liveSections.length > 0 ? ["Use Release Radar or Decision Loop to turn this visibility into action."] : []),
  ];

  return {
    ok: liveSections.length > 0,
    headline,
    narrative,
    sections,
    recommendedNext,
  };
}

async function runReleaseRadar(
  mission: MissionDefinition,
  payload: Record<string, unknown>,
  connectorTokens: ConnectorTokens
): Promise<MissionRunResult> {
  const owner = getStringValue(payload, "owner");
  const repo = getStringValue(payload, "repo");
  const teamKey = getStringValue(payload, "teamKey");
  const slackChannel = getStringValue(payload, "slackChannel");

  const [githubRun, linearRun] = await Promise.all([
    runActionWithTokens("github.list-issues", { owner, repo, state: "open", limit: 8 }, connectorTokens),
    runActionWithTokens(
      "linear.list-issues",
      { teamKey: teamKey || undefined, state: "open", limit: 8 },
      connectorTokens
    ),
  ]);

  const githubRows = rowsFromData(githubRun.data);
  const linearRows = rowsFromData(linearRun.data);
  const topGithub = githubRows[0];
  const topLinear = linearRows[0];
  const topGithubTitle = getRecordString(topGithub, "title");
  const topGithubNumber = getRecordNumber(topGithub, "number");
  const topLinearId = getRecordString(topLinear, "id");
  const topLinearTitle = getRecordString(topLinear, "title");

  const radarSummary = [
    `Release Radar for ${owner}/${repo}`,
    `- GitHub open issues sampled: ${githubRows.length}`,
    `- Linear issues sampled${teamKey ? ` for ${teamKey}` : ""}: ${linearRows.length}`,
    topGithubTitle ? `- Top GitHub issue: #${topGithubNumber ?? "?"} ${topGithubTitle}` : "- No GitHub issue returned in sample.",
    topLinearTitle ? `- Top Linear issue: ${topLinearId ?? "?"} ${topLinearTitle}` : "- No Linear issue returned in sample.",
  ].join("\n");

  const slackRun = await runActionWithTokens(
    "slack.send-message",
    { channel: slackChannel, text: radarSummary },
    connectorTokens
  );

  const sections = [
    buildSection(
      "github-release-risk",
      "GitHub repo risk",
      "github",
      githubRun,
      githubRun.ok
        ? topGithubTitle
          ? `Sampled ${githubRows.length} open GitHub issues. Top item is #${topGithubNumber ?? "?"} ${topGithubTitle}.`
          : `GitHub responded, but no open issues were returned in the sample.`
        : githubRun.summary
    ),
    buildSection(
      "linear-launch-queue",
      "Linear launch queue",
      "linear",
      linearRun,
      linearRun.ok
        ? topLinearTitle
          ? `Sampled ${linearRows.length} Linear issues${teamKey ? ` for ${teamKey}` : ""}. Top issue is ${topLinearId ?? "?"} ${topLinearTitle}.`
          : `Linear responded, but no matching issues were returned in the sample.`
        : linearRun.summary
    ),
    buildSection(
      "slack-release-brief",
      "Slack release brief",
      "slack",
      slackRun,
      slackRun.ok ? `Posted the release radar summary to ${slackChannel}.` : slackRun.summary
    ),
  ];

  const ok = githubRun.ok && linearRun.ok && slackRun.ok;
  const recommendedNext = [
    ...(githubRun.ok && linearRun.ok && githubRows.length > linearRows.length
      ? ["Repo risk looks heavier than the tracked Linear queue. Convert untracked GitHub issues into owned execution items."]
      : []),
    ...(!githubRun.ok ? ["Fix the GitHub token or repo inputs so Release Radar can read repo risk."] : []),
    ...(!linearRun.ok ? ["Fix the Linear token or team key so Release Radar can compare execution against repo risk."] : []),
    ...(!slackRun.ok ? [`Invite the Slack bot to ${slackChannel} or confirm the channel identifier before broadcasting again.`] : [`Pin the ${slackChannel} post during the launch window so the whole team works from one brief.`]),
  ];

  return {
    ok,
    headline: ok ? `Release Radar pushed to ${slackChannel}` : `Release Radar compiled with delivery gaps`,
    narrative: `Bot Boss scanned ${owner}/${repo}${teamKey ? ` and the ${teamKey} Linear queue` : " and the current Linear queue"}${slackRun.ok ? `, then posted the launch brief to ${slackChannel}.` : ", but did not complete the Slack broadcast."}`,
    sections,
    recommendedNext,
  };
}

async function runDecisionLoop(
  payload: Record<string, unknown>,
  connectorTokens: ConnectorTokens
): Promise<MissionRunResult> {
  const issueTitle = getStringValue(payload, "issueTitle");
  const decision = getStringValue(payload, "decision");
  const teamKey = getStringValue(payload, "teamKey");
  const notionPageId = getStringValue(payload, "notionPageId");
  const slackChannel = getStringValue(payload, "slackChannel");

  const linearDescription = [
    "Founder decision captured by Bot Boss.",
    "",
    `Decision: ${decision}`,
    "",
    "Expected outcome:",
    "- Turn the decision into owned execution immediately.",
    "- Keep the team aligned in Slack.",
    "- Preserve the record in Notion.",
  ].join("\n");

  const linearRun = await runActionWithTokens(
    "linear.create-issue",
    { teamKey, title: issueTitle, description: linearDescription },
    connectorTokens
  );

  const linearData = toRecord(linearRun.data);
  const linearIdentifier = getRecordString(linearData, "identifier");
  const linearUrl = getRecordString(linearData, "url");

  const notionText = [
    `Decision: ${decision}`,
    `Execution title: ${issueTitle}`,
    linearIdentifier ? `Linear issue: ${linearIdentifier}${linearUrl ? ` ${linearUrl}` : ""}` : "Linear issue: not created.",
  ].join("\n");

  const notionRun = await runActionWithTokens(
    "notion.append-block",
    { pageId: notionPageId, text: notionText },
    connectorTokens
  );

  const slackText = [
    "Bot Boss Decision Loop",
    `Title: ${issueTitle}`,
    `Decision: ${decision}`,
    linearIdentifier ? `Linear: ${linearIdentifier}${linearUrl ? ` ${linearUrl}` : ""}` : "Linear: creation failed",
    notionRun.ok ? `Notion: appended to ${notionPageId}` : `Notion: append failed for ${notionPageId}`,
  ].join("\n");

  const slackRun = await runActionWithTokens(
    "slack.send-message",
    { channel: slackChannel, text: slackText },
    connectorTokens
  );

  const sections = [
    buildSection(
      "linear-decision-issue",
      "Linear execution issue",
      "linear",
      linearRun,
      linearRun.ok && linearIdentifier
        ? `Created ${linearIdentifier} to turn the decision into owned execution.`
        : linearRun.summary
    ),
    buildSection(
      "notion-decision-record",
      "Notion decision record",
      "notion",
      notionRun,
      notionRun.ok ? `Appended the decision record to Notion page ${notionPageId}.` : notionRun.summary
    ),
    buildSection(
      "slack-decision-broadcast",
      "Slack decision broadcast",
      "slack",
      slackRun,
      slackRun.ok ? `Broadcast the decision loop into ${slackChannel}.` : slackRun.summary
    ),
  ];

  const ok = sections.every((section) => section.ok);
  const recommendedNext = [
    ...(linearIdentifier ? [`Assign ${linearIdentifier} in Linear and keep the issue as the execution spine for this decision.`] : []),
    ...(notionRun.ok ? [`Use Notion page ${notionPageId} as the durable written record for the decision.`] : ["Fix the Notion page target so the decision has a durable written home."]),
    ...(slackRun.ok ? [`Reply in ${slackChannel} with owners and due dates so the broadcast becomes accountability.`] : [`Invite the Slack bot to ${slackChannel} or confirm the channel target before rerunning the mission.`]),
  ];

  return {
    ok,
    headline: ok ? `Decision Loop closed across Linear, Notion, and Slack` : `Decision Loop only partially completed`,
    narrative: ok
      ? `Bot Boss turned the decision into a live execution issue, a written record, and a team broadcast in one pass.`
      : `Bot Boss started the decision loop but one or more downstream systems failed before the loop fully closed.`,
    sections,
    recommendedNext,
  };
}

async function attachMissionSynthesis(
  mission: MissionDefinition,
  payload: Record<string, unknown>,
  result: MissionRunResult
): Promise<MissionRunResult> {
  const synthesis = await generateMissionSynthesis({
    missionTitle: mission.title,
    missionOutcome: mission.outcome,
    payload,
    headline: result.headline,
    narrative: result.narrative,
    sections: result.sections.map((section) => ({
      connectorLabel: section.connectorLabel,
      title: section.title,
      ok: section.ok,
      summary: section.summary,
      error: section.error,
    })),
    recommendedNext: result.recommendedNext,
  });

  return {
    ...result,
    synthesis,
  };
}

export async function runMissionWithTokens(
  missionId: string,
  payload: Record<string, unknown> = {},
  connectorTokens: ConnectorTokens
): Promise<MissionRunResult> {
  const mission = getMissionById(missionId);
  if (!mission) {
    return invalidMissionResult("Mission not found", `No mission exists for ${missionId}.`, []);
  }

  const missingFields = validateMissionPayload(mission, payload);
  if (missingFields.length > 0) {
    return attachMissionSynthesis(mission, payload, invalidMissionResult(
      `${mission.title} needs a bit more context`,
      `Provide the required mission inputs before Bot Boss can run this workflow: ${missingFields.join(", ")}.`,
      ["Fill the missing fields in the mission workbench and run the workflow again."]
    ));
  }

  if (mission.id === "daily-operator-snapshot") {
    return attachMissionSynthesis(mission, payload, await runDailyOperatorSnapshot(connectorTokens));
  }

  if (mission.id === "release-radar") {
    return attachMissionSynthesis(mission, payload, await runReleaseRadar(mission, payload, connectorTokens));
  }

  if (mission.id === "decision-loop") {
    return attachMissionSynthesis(mission, payload, await runDecisionLoop(payload, connectorTokens));
  }

  return attachMissionSynthesis(mission, payload, {
    ok: false,
    headline: `${mission.title} is still a blueprint`,
    narrative: "This mission is productized as a concept, but the live execution path has not been wired yet.",
    sections: [],
    recommendedNext: [
      "Use the action console to run the underlying connectors directly for now.",
      "Keep this blueprint around so the next live loop grows from a real operator need.",
    ],
  });
}
