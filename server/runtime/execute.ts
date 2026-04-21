import { invokeLLM, type Message, type ToolCall } from "../_core/llm";
import { getDecryptedAccessToken } from "../db";
import { getTool, getToolsForUser, toolsToLlmSchema } from "./registry";
import type { Tool, ToolResult } from "./types";

/** One step of the tool-use loop, surfaced so the caller can persist it. */
export type ToolRun = {
  toolName: string;
  label: string;
  input: unknown;
  result: ToolResult;
  durationMs: number;
};

export type ExecuteParams = {
  userId: number;
  systemPrompt: string;
  allowedTools: string[];
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  maxTurns?: number;
};

export type ExecuteResult = {
  reply: string;
  runs: ToolRun[];
  tokensUsed: number;
};

/**
 * Run one Boss turn end-to-end: send the message + allowed tools to the LLM,
 * execute any tool_calls, feed results back, loop until a plain-text answer
 * (or we hit maxTurns). Missing OAuth tokens just disable the affected tool;
 * built-in tools always run.
 */
export async function executeBoss({
  userId,
  systemPrompt,
  allowedTools,
  history,
  message,
  maxTurns = 5,
}: ExecuteParams): Promise<ExecuteResult> {
  const tools = allowedTools
    .map((n) => getTool(n))
    .filter((t): t is Tool<unknown> => !!t);

  const tokenByProvider = new Map<string, string>();
  const missingProviders: string[] = [];
  const providers = new Set(tools.map((t) => t.provider));
  for (const provider of providers) {
    if (provider === "builtin") continue;
    const tok = await getDecryptedAccessToken(userId, provider);
    if (tok) tokenByProvider.set(provider, tok);
    else missingProviders.push(provider);
  }

  const usable = getToolsForUser(tools, tokenByProvider);
  const llmTools = toolsToLlmSchema(usable);

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content }) as Message),
    { role: "user", content: message },
  ];

  if (missingProviders.length > 0) {
    messages.splice(1, 0, {
      role: "system",
      content: `Note: these connections are not set up yet and their tools are unavailable: ${missingProviders.join(", ")}. If one is needed, tell the user to connect it in Settings.`,
    });
  }

  const runs: ToolRun[] = [];
  let totalTokens = 0;
  let finalReply = "";

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await invokeLLM({
      messages,
      ...(llmTools.length > 0 ? { tools: llmTools, toolChoice: "auto" as const } : {}),
    });
    totalTokens += response.usage?.total_tokens ?? 0;

    const choice = response.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls ?? [];

    if (toolCalls.length === 0) {
      finalReply =
        typeof choice?.content === "string"
          ? choice.content
          : Array.isArray(choice?.content)
            ? choice.content.map((c) => (c.type === "text" ? c.text : "")).join("")
            : "";
      break;
    }

    messages.push({
      role: "assistant",
      content: typeof choice.content === "string" ? choice.content : "",
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const run = await executeOneToolCall(call, usable, tokenByProvider, userId);
      runs.push(run);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(run.result),
      });
    }
  }

  if (!finalReply) {
    finalReply =
      runs.length > 0
        ? `Done after ${runs.length} tool call${runs.length === 1 ? "" : "s"}. ` +
          runs.map((r) => r.result.summary).join(" ")
        : "I couldn't complete that — try rephrasing.";
  }

  return { reply: finalReply, runs, tokensUsed: totalTokens };
}

async function executeOneToolCall(
  call: ToolCall,
  availableTools: Tool<unknown>[],
  tokenByProvider: Map<string, string>,
  userId: number
): Promise<ToolRun> {
  const name = call.function.name;
  const tool = availableTools.find((t) => t.name === name);
  const start = Date.now();

  if (!tool) {
    return {
      toolName: name,
      label: name,
      input: null,
      result: { ok: false, summary: `Tool "${name}" unavailable` },
      durationMs: Date.now() - start,
    };
  }

  let parsedArgs: unknown = {};
  try {
    if (call.function.arguments) parsedArgs = JSON.parse(call.function.arguments);
  } catch {
    /* fall through with empty args */
  }

  const validated = tool.input.safeParse(parsedArgs);
  if (!validated.success) {
    return {
      toolName: name,
      label: tool.label,
      input: parsedArgs,
      result: {
        ok: false,
        summary: `Invalid arguments for ${tool.label}`,
        error: validated.error.message,
      },
      durationMs: Date.now() - start,
    };
  }

  const token = tool.provider === "builtin" ? "" : tokenByProvider.get(tool.provider);
  if (tool.provider !== "builtin" && !token) {
    return {
      toolName: name,
      label: tool.label,
      input: validated.data,
      result: {
        ok: false,
        summary: `Missing ${tool.provider} connection`,
        error: `Connect ${tool.provider} in Settings to use this tool.`,
      },
      durationMs: Date.now() - start,
    };
  }

  const result = await tool.run({ userId, token: token ?? "", input: validated.data });
  return {
    toolName: name,
    label: tool.label,
    input: validated.data,
    result,
    durationMs: Date.now() - start,
  };
}
