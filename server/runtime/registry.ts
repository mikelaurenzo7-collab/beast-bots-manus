import type { Tool } from "./types";

const TOOLS = new Map<string, Tool<unknown>>();

export function registerTool<I>(tool: Tool<I>) {
  TOOLS.set(tool.name, tool as Tool<unknown>);
}

export function getTool(name: string) {
  return TOOLS.get(name);
}

export function listToolNames() {
  return Array.from(TOOLS.keys()).sort();
}