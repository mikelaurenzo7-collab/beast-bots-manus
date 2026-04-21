import type { Tool } from "./types";
import { zodToJsonSchema } from "./jsonSchema";

const TOOLS = new Map<string, Tool<unknown>>();

export function registerTool<I>(tool: Tool<I>): void {
  TOOLS.set(tool.name, tool as Tool<unknown>);
}

export function getTool(name: string): Tool<unknown> | undefined {
  return TOOLS.get(name);
}

export function listToolNames(): string[] {
  return Array.from(TOOLS.keys()).sort();
}

/**
 * Return the subset of the caller's requested tools that can actually run now.
 * Built-in tools are always usable; external-provider tools only pass through
 * when a decrypted token exists for their provider.
 */
export function getToolsForUser(
  requested: Tool<unknown>[],
  tokenByProvider: Map<string, string>
): Tool<unknown>[] {
  return requested.filter(
    (t) => t.provider === "builtin" || tokenByProvider.has(t.provider)
  );
}

/** OpenAI-style `tools` payload for invokeLLM. */
export function toolsToLlmSchema(tools: Tool<unknown>[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.input),
    },
  }));
}
