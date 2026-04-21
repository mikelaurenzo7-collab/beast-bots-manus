import type { ConnectorId } from "./connectors";

export type ActionField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select";
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
};

export type ActionDefinition = {
  id: string;
  connectorId: ConnectorId;
  toolName: string;
  label: string;
  description: string;
  mode: "read" | "write";
  caution?: string;
  defaultPayload: Record<string, string | number>;
  fields: ActionField[];
};

export const ACTIONS: ActionDefinition[] = [
  {
    id: "github.list-repos",
    connectorId: "github",
    toolName: "github.list_repos",
    label: "List GitHub repos",
    description: "Read the repo surface and recent activity footprint.",
    mode: "read",
    defaultPayload: { limit: 8 },
    fields: [{ key: "limit", label: "Limit", type: "number", placeholder: "8" }],
  },
  {
    id: "github.list-issues",
    connectorId: "github",
    toolName: "github.list_issues",
    label: "List GitHub issues",
    description: "Inspect open work inside a specific repository.",
    mode: "read",
    defaultPayload: { owner: "", repo: "", state: "open", limit: 10 },
    fields: [
      { key: "owner", label: "Owner", type: "text", placeholder: "acme", required: true },
      { key: "repo", label: "Repository", type: "text", placeholder: "core-app", required: true },
      {
        key: "state",
        label: "State",
        type: "select",
        required: true,
        options: [
          { label: "Open", value: "open" },
          { label: "Closed", value: "closed" },
          { label: "All", value: "all" },
        ],
      },
      { key: "limit", label: "Limit", type: "number", placeholder: "10" },
    ],
  },
  {
    id: "github.create-issue",
    connectorId: "github",
    toolName: "github.create_issue",
    label: "Create GitHub issue",
    description: "Open a new issue in the repo you want Bot Boss to push work into.",
    mode: "write",
    caution: "This writes directly to GitHub.",
    defaultPayload: { owner: "", repo: "", title: "", body: "" },
    fields: [
      { key: "owner", label: "Owner", type: "text", placeholder: "acme", required: true },
      { key: "repo", label: "Repository", type: "text", placeholder: "core-app", required: true },
      { key: "title", label: "Title", type: "text", placeholder: "Production issue", required: true },
      { key: "body", label: "Body", type: "textarea", placeholder: "Context and next steps" },
    ],
  },
  {
    id: "slack.list-channels",
    connectorId: "slack",
    toolName: "slack.list_channels",
    label: "List Slack channels",
    description: "Check what the bot can see before you try to post into it.",
    mode: "read",
    defaultPayload: { limit: 20 },
    fields: [{ key: "limit", label: "Limit", type: "number", placeholder: "20" }],
  },
  {
    id: "slack.send-message",
    connectorId: "slack",
    toolName: "slack.send_message",
    label: "Send Slack message",
    description: "Push a crisp update into a channel when a loop needs to close.",
    mode: "write",
    caution: "This posts live into Slack.",
    defaultPayload: { channel: "", text: "" },
    fields: [
      { key: "channel", label: "Channel", type: "text", placeholder: "#launch-war-room", required: true },
      { key: "text", label: "Message", type: "textarea", placeholder: "What changed, why it matters, next step", required: true },
    ],
  },
  {
    id: "notion.list-databases",
    connectorId: "notion",
    toolName: "notion.list_databases",
    label: "List Notion databases",
    description: "Find the right system of record before writing into it.",
    mode: "read",
    defaultPayload: { query: "" },
    fields: [{ key: "query", label: "Search", type: "text", placeholder: "growth" }],
  },
  {
    id: "notion.append-block",
    connectorId: "notion",
    toolName: "notion.append_block",
    label: "Append Notion block",
    description: "Write a clear paragraph back to a page after an operating review.",
    mode: "write",
    caution: "This modifies a Notion page.",
    defaultPayload: { pageId: "", text: "" },
    fields: [
      { key: "pageId", label: "Page ID", type: "text", placeholder: "Notion page id", required: true },
      { key: "text", label: "Paragraph", type: "textarea", placeholder: "Decision or summary to append", required: true },
    ],
  },
  {
    id: "linear.list-issues",
    connectorId: "linear",
    toolName: "linear.list_issues",
    label: "List Linear issues",
    description: "Read the active issue queue across a team or the full workspace.",
    mode: "read",
    defaultPayload: { teamKey: "", state: "open", limit: 10 },
    fields: [
      { key: "teamKey", label: "Team key", type: "text", placeholder: "ENG" },
      {
        key: "state",
        label: "State",
        type: "select",
        required: true,
        options: [
          { label: "Open", value: "open" },
          { label: "In Progress", value: "in_progress" },
          { label: "Done", value: "done" },
          { label: "All", value: "all" },
        ],
      },
      { key: "limit", label: "Limit", type: "number", placeholder: "10" },
    ],
  },
  {
    id: "linear.create-issue",
    connectorId: "linear",
    toolName: "linear.create_issue",
    label: "Create Linear issue",
    description: "Push a decision straight into the execution system.",
    mode: "write",
    caution: "This creates a live issue in Linear.",
    defaultPayload: { teamKey: "", title: "", description: "" },
    fields: [
      { key: "teamKey", label: "Team key", type: "text", placeholder: "ENG", required: true },
      { key: "title", label: "Title", type: "text", placeholder: "Fix production triage", required: true },
      { key: "description", label: "Description", type: "textarea", placeholder: "Context and acceptance criteria" },
    ],
  },
];

export function getActionById(id: string) {
  return ACTIONS.find((action) => action.id === id);
}