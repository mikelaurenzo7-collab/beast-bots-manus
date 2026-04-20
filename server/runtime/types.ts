import type { z } from "zod";

/** Context handed to every tool when it's executed. */
export type ToolContext<I> = {
  userId: number;
  token: string;
  input: I;
};

/** Shape every tool returns after running. */
export type ToolResult = {
  ok: boolean;
  /** Short human-readable summary; stored in agent_runs.outputSummary. */
  summary: string;
  /** Optional structured data returned to the LLM (serialized to JSON). */
  data?: unknown;
  /** Optional error message. Populated when ok=false. */
  error?: string;
};

/** Definition of a single tool the LLM can call. */
export type Tool<I = unknown> = {
  /** Fully-qualified tool name: `${provider}.${action}` — e.g. "github.list_repos". */
  name: string;
  /** Short human label used in Activity logs and UI. */
  label: string;
  /** OAuth/API-key provider key (matches oauth_connections.provider). */
  provider: string;
  /** Description the LLM sees in its tools payload. */
  description: string;
  /** Zod schema describing the tool's input. */
  input: z.ZodType<I>;
  /** Execute the tool. Must not throw — wrap errors and return ok:false. */
  run: (ctx: ToolContext<I>) => Promise<ToolResult>;
};
