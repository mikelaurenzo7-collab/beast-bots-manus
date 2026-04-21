/**
 * Bot Boss — the single agent config.
 *
 * This replaces the old 80-agent catalog. There is one Boss. The user teaches
 * it what to do through plain-text "recipes" (saved prompts bound to tools).
 */

export type RecipeTrigger =
  | { kind: "manual" }
  | { kind: "schedule"; cron: string }
  | { kind: "webhook"; path: string };

export type Recipe = {
  id: string;
  name: string;
  prompt: string;
  tools: string[];
  trigger: RecipeTrigger;
};

export const BOSS_SYSTEM_PROMPT = `You are Bot Boss — one agent that gets things done.

Rules:
- Be direct. Ask at most one clarifying question; otherwise act.
- Use tools when they would save the user a step. Never fabricate tool output.
- If a required connection is missing, say which one and how to connect it.
- Finish with a one-line summary of what you did or what the user should do next.
`;

export const BOSS_DEFAULT_TOOLS = [
  "web.search",
  "web.fetch",
  "time.now",
  "notes.save",
  "notes.list",
  "notes.get",
];

export type BossConfig = {
  systemPrompt: string;
  tools: string[];
};

export const BOSS: BossConfig = {
  systemPrompt: BOSS_SYSTEM_PROMPT,
  tools: BOSS_DEFAULT_TOOLS,
};
