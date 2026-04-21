import type { ConnectorId } from "./connectors";

export type MissionField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select";
  placeholder?: string;
  required?: boolean;
  description?: string;
  options?: Array<{ label: string; value: string }>;
};

export type MissionDefinition = {
  id: string;
  title: string;
  status: "live" | "next";
  description: string;
  connectorIds: ConnectorId[];
  outcome: string;
  runLabel: string;
  defaultPayload: Record<string, string | number>;
  fields: MissionField[];
};

export const MISSIONS: MissionDefinition[] = [
  {
    id: "daily-operator-snapshot",
    title: "Daily Operator Snapshot",
    status: "live",
    description:
      "Sweep GitHub, Slack, Notion, and Linear into one operating brief so the founder sees the day in one place.",
    connectorIds: ["github", "slack", "notion", "linear"],
    outcome: "A concise morning brief built from real systems, not a fake demo state.",
    runLabel: "Run snapshot",
    defaultPayload: {},
    fields: [],
  },
  {
    id: "release-radar",
    title: "Release Radar",
    status: "live",
    description:
      "Pull repo risk, queue pressure, and broadcast status into a war-room workflow for launches.",
    connectorIds: ["github", "linear", "slack"],
    outcome: "A live launch board that knows what is blocked, who owns it, and what changed.",
    runLabel: "Run release radar",
    defaultPayload: {
      owner: "",
      repo: "",
      teamKey: "",
      slackChannel: "",
    },
    fields: [
      {
        key: "owner",
        label: "GitHub owner",
        type: "text",
        placeholder: "acme",
        required: true,
        description: "The org or user that owns the repository you want to inspect.",
      },
      {
        key: "repo",
        label: "Repository",
        type: "text",
        placeholder: "core-app",
        required: true,
        description: "The repository whose open issue surface represents release risk.",
      },
      {
        key: "teamKey",
        label: "Linear team key",
        type: "text",
        placeholder: "ENG",
        description: "Optional. Narrow the execution queue to one Linear team if you want a sharper launch view.",
      },
      {
        key: "slackChannel",
        label: "Slack channel",
        type: "text",
        placeholder: "#launch-war-room",
        required: true,
        description: "Where the release brief should be posted once Bot Boss compiles it.",
      },
    ],
  },
  {
    id: "decision-loop",
    title: "Decision Loop",
    status: "live",
    description:
      "Turn a founder decision into a Linear issue, a Slack update, and a Notion record in one pass.",
    connectorIds: ["linear", "slack", "notion"],
    outcome: "A reliable path from insight to record to execution.",
    runLabel: "Run decision loop",
    defaultPayload: {
      issueTitle: "",
      decision: "",
      teamKey: "",
      notionPageId: "",
      slackChannel: "",
    },
    fields: [
      {
        key: "issueTitle",
        label: "Execution title",
        type: "text",
        placeholder: "Fix launch blocker triage",
        required: true,
        description: "The issue title Bot Boss will create in Linear.",
      },
      {
        key: "decision",
        label: "Decision or directive",
        type: "textarea",
        placeholder: "We are shipping on Friday and triaging only launch-blocking bugs until then.",
        required: true,
        description: "The actual founder decision that needs to become execution, communication, and record.",
      },
      {
        key: "teamKey",
        label: "Linear team key",
        type: "text",
        placeholder: "ENG",
        required: true,
        description: "Which Linear team should own the resulting execution item.",
      },
      {
        key: "notionPageId",
        label: "Notion page ID",
        type: "text",
        placeholder: "Notion page id",
        required: true,
        description: "The page where the decision should be appended as the canonical written record.",
      },
      {
        key: "slackChannel",
        label: "Slack channel",
        type: "text",
        placeholder: "#leadership",
        required: true,
        description: "The channel that should receive the final broadcast once the loop closes.",
      },
    ],
  },
  {
    id: "postmortem-loop",
    title: "Postmortem Loop",
    status: "next",
    description:
      "Turn incident learnings into a durable Notion record, a tracked Linear fix list, and an accountability thread in Slack.",
    connectorIds: ["slack", "notion", "linear"],
    outcome: "A consistent incident closeout ritual instead of a vague promise to learn later.",
    runLabel: "Open blueprint",
    defaultPayload: {},
    fields: [],
  },
];

export function getMissionById(id: string) {
  return MISSIONS.find((mission) => mission.id === id);
}