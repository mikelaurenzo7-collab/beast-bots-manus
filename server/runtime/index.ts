// Side-effect imports register each provider's tools with the registry.
// Keep these imports here so `server/runtime` is the single entry point.
import "./tools/github";
import "./tools/slack";
import "./tools/notion";
import "./tools/google";
import "./tools/linear";
import "./tools/figma";
import "./tools/linkedin";
import "./tools/hubspot";
import "./tools/discord";

export { getTool, getToolsForBeast, listToolNames, toolsToLlmSchema } from "./registry";
export { executeBeast } from "./execute";
export type { Tool, ToolContext, ToolResult } from "./types";
