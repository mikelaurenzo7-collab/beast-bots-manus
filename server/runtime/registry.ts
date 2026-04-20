import type { Tool } from "./types";
import { zodToJsonSchema } from "./jsonSchema";

const TOOLS = new Map<string, Tool<unknown>>();

/** Register a tool. Idempotent — replaces an existing registration. */
export function registerTool<I>(tool: Tool<I>): void {
  TOOLS.set(tool.name, tool as Tool<unknown>);
}

/** Look up a registered tool by fully-qualified name (`${provider}.${action}`). */
export function getTool(name: string): Tool<unknown> | undefined {
  return TOOLS.get(name);
}

/** Return all registered tool names, for tests / drift guards. */
export function listToolNames(): string[] {
  return Array.from(TOOLS.keys()).sort();
}

/**
 * Filter the registered tools down to the ones a beast can use right now:
 *  - Must be listed in the beast's `tools` array.
 *  - User must have an active connection for the tool's provider.
 */
export function getToolsForBeast(
  beastTools: string[] | undefined,
  connectedProviders: Set<string>
): Tool<unknown>[] {
  if (!beastTools || beastTools.length === 0) return [];
  return beastTools
    .map(getTool)
    .filter((t): t is Tool<unknown> => !!t && connectedProviders.has(t.provider));
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
