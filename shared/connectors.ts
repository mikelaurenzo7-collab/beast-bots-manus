export type ConnectorId = "github" | "slack" | "notion" | "linear";

export type ConnectorRuntimeSource = "vault" | "env" | "none";

export type ConnectorDefinition = {
  id: ConnectorId;
  label: string;
  category: string;
  tagline: string;
  description: string;
  accentColor: string;
  probeActionId: string;
  tokenEnv: string;
  whyItMatters: string;
};

export type ConnectorRuntimeStatus = {
  configured: boolean;
  source: ConnectorRuntimeSource;
  maskedToken?: string;
  updatedAt?: string;
  vaultEnabled: boolean;
  vaultLocked: boolean;
  hasStoredSecret: boolean;
};

export type ConnectorWithStatus = ConnectorDefinition & ConnectorRuntimeStatus;

export const CONNECTORS: ConnectorDefinition[] = [
  {
    id: "github",
    label: "GitHub",
    category: "Build",
    tagline: "Know what is shipping and what is slipping.",
    description:
      "Live repo and issue actions for the systems that usually reveal product risk first.",
    accentColor: "#F26B3A",
    probeActionId: "github.list-repos",
    tokenEnv: "GITHUB_TOKEN",
    whyItMatters: "Release truth, backlog pressure, and ownership drift all show up here first.",
  },
  {
    id: "slack",
    label: "Slack",
    category: "Comms",
    tagline: "Broadcast, inspect, and unblock the operating cadence.",
    description:
      "Channel inventory and message posting so the boss bot can actually move information, not just analyze it.",
    accentColor: "#5B2A86",
    probeActionId: "slack.list-channels",
    tokenEnv: "SLACK_BOT_TOKEN",
    whyItMatters: "If the product team cannot close loops in Slack, the agent never becomes operational.",
  },
  {
    id: "notion",
    label: "Notion",
    category: "Knowledge",
    tagline: "Write outcomes back into the place the team already trusts.",
    description:
      "Searchable databases and block append flows for turning signal into durable memory.",
    accentColor: "#202020",
    probeActionId: "notion.list-databases",
    tokenEnv: "NOTION_TOKEN",
    whyItMatters: "Founder tools win when summaries and decisions land where the org already works.",
  },
  {
    id: "linear",
    label: "Linear",
    category: "Execution",
    tagline: "Tie product risk to the issue queue that actually drives work.",
    description:
      "Pull open issues and create tickets fast when Bot Boss spots a gap or a fire.",
    accentColor: "#6E5BFF",
    probeActionId: "linear.list-issues",
    tokenEnv: "LINEAR_API_KEY",
    whyItMatters: "Without issue creation, an agent is advice. With issue creation, it becomes leverage.",
  },
];

export function getConnectorById(id: ConnectorId) {
  return CONNECTORS.find((connector) => connector.id === id);
}