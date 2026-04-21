import type { z } from "zod";

export type ToolContext<I> = {
  token: string;
  input: I;
};

export type ToolResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
};

export type Tool<I = unknown> = {
  name: string;
  label: string;
  provider: string;
  description: string;
  input: z.ZodType<I>;
  run: (ctx: ToolContext<I>) => Promise<ToolResult>;
};