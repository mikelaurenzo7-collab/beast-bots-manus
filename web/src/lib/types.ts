/** Shapes mirroring the REST API responses. Keep in lockstep with server. */

export type User = { id: number; email: string | null; name: string | null };
export type AuthResponse = { sessionToken: string; user: User };

export type Role = "user" | "assistant";
export type ChatMessage = {
  id: number;
  role: Role;
  content: string;
  runId: number | null;
  createdAt: string;
};
export type ChatHistoryResponse = { botSlug: string; messages: ChatMessage[] };

export type ToolCallSummary = {
  name: string;
  label: string;
  ok: boolean;
  summary: string;
  durationMs: number;
};
export type RunResponse = {
  reply: string;
  toolCalls: ToolCallSummary[];
  runId: number;
  botSlug: string;
  recipeName?: string;
};

export type Run = {
  id: number;
  botSlug: string;
  recipeId: number | null;
  status: "running" | "success" | "error";
  inputSummary: string | null;
  outputSummary: string | null;
  tokensUsed: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  toolCalls: { name: string; ok: boolean; summary: string }[] | null;
  createdAt: string;
};

export type Recipe = {
  id: number;
  name: string;
  prompt: string;
  tools: string[];
  triggerKind: "manual" | "schedule" | "webhook";
  triggerCron: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Connection = {
  id: number;
  provider: string;
  accountName: string | null;
  scopes: string[] | null;
  expiresAt: string | null;
  createdAt: string;
};

export type BotSummary = {
  slug: string;
  name: string;
  tagline: string;
  category: "general" | "ecommerce" | "trading" | "creator";
  icon: string;
  requiredProviders: string[];
  revenueProposition: string;
};
export type BotCatalogResponse = { bots: BotSummary[] };
