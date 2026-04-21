/**
 * Pre-configured workflow templates for Beast Bots
 * Each template chains multiple agents together for common automation scenarios
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "productivity" | "marketing" | "development" | "sales" | "support";
  agents: string[]; // Agent slugs in order
  connections: Array<{ from: number; to: number }>;
  difficulty: "easy" | "medium" | "hard";
  icon: string;
  estimatedTime: string;
  rating: number;
  uses: number;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "github-to-slack",
    name: "GitHub PR to Slack Notification",
    description: "Automatically post GitHub pull requests to Slack for team review",
    category: "development",
    agents: ["github-beast", "slack-beast"],
    connections: [{ from: 0, to: 1 }],
    difficulty: "easy",
    icon: "🔔",
    estimatedTime: "5 min",
    rating: 4.8,
    uses: 2341,
  },
  {
    id: "gmail-to-notion",
    name: "Gmail to Notion Database",
    description: "Save important emails to a Notion database for organization",
    category: "productivity",
    agents: ["gmail-beast", "notion-beast"],
    connections: [{ from: 0, to: 1 }],
    difficulty: "easy",
    icon: "📧",
    estimatedTime: "10 min",
    rating: 4.6,
    uses: 1847,
  },
  {
    id: "github-linear-slack",
    name: "GitHub PR → Linear Ticket → Slack",
    description: "Create Linear tickets from GitHub PRs and notify Slack",
    category: "development",
    agents: ["github-beast", "linear-beast", "slack-beast"],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
    difficulty: "medium",
    icon: "🚀",
    estimatedTime: "15 min",
    rating: 4.9,
    uses: 3124,
  },
  {
    id: "twitter-notion-slack",
    name: "Twitter Mentions to Notion & Slack",
    description: "Track Twitter mentions in Notion and alert team on Slack",
    category: "marketing",
    agents: ["twitter-beast", "notion-beast", "slack-beast"],
    connections: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
    ],
    difficulty: "medium",
    icon: "🐦",
    estimatedTime: "12 min",
    rating: 4.5,
    uses: 1203,
  },
  {
    id: "stripe-slack-hubspot",
    name: "Stripe Payment → HubSpot CRM → Slack",
    description: "Log Stripe payments to HubSpot and notify sales team",
    category: "sales",
    agents: ["stripe-beast", "hubspot-beast", "slack-beast"],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
    difficulty: "hard",
    icon: "💳",
    estimatedTime: "20 min",
    rating: 4.7,
    uses: 987,
  },
  {
    id: "zendesk-slack-notion",
    name: "Zendesk Tickets → Slack & Notion",
    description: "Route support tickets to Slack and log in Notion for tracking",
    category: "support",
    agents: ["zendesk-beast", "slack-beast", "notion-beast"],
    connections: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
    ],
    difficulty: "medium",
    icon: "🎫",
    estimatedTime: "15 min",
    rating: 4.6,
    uses: 1456,
  },
  {
    id: "mailchimp-hubspot-slack",
    name: "Mailchimp Signup → HubSpot → Slack",
    description: "Add new email subscribers to HubSpot and notify team",
    category: "marketing",
    agents: ["mailchimp-beast", "hubspot-beast", "slack-beast"],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
    difficulty: "medium",
    icon: "📬",
    estimatedTime: "12 min",
    rating: 4.4,
    uses: 892,
  },
  {
    id: "github-shopify-slack",
    name: "GitHub Release → Shopify & Slack",
    description: "Publish GitHub releases to Shopify and announce on Slack",
    category: "development",
    agents: ["github-beast", "shopify-beast", "slack-beast"],
    connections: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
    ],
    difficulty: "hard",
    icon: "🛍️",
    estimatedTime: "18 min",
    rating: 4.3,
    uses: 654,
  },
  {
    id: "calendar-slack-reminder",
    name: "Google Calendar → Slack Reminders",
    description: "Send Slack reminders for upcoming Google Calendar events",
    category: "productivity",
    agents: ["google-calendar-beast", "slack-beast"],
    connections: [{ from: 0, to: 1 }],
    difficulty: "easy",
    icon: "📅",
    estimatedTime: "8 min",
    rating: 4.7,
    uses: 2103,
  },
  {
    id: "form-response-workflow",
    name: "Form Response → Notion → Slack",
    description: "Capture form responses in Notion and notify team",
    category: "productivity",
    agents: ["airtable-beast", "notion-beast", "slack-beast"],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
    difficulty: "easy",
    icon: "📝",
    estimatedTime: "10 min",
    rating: 4.5,
    uses: 1678,
  },
];
