import type { Beast } from "../../shared/agents";
import { invokeLLM, type Message, type ToolCall } from "../_core/llm";
import { getDecryptedToken } from "../db";
import { getTool, getToolsForBeast, toolsToLlmSchema } from "./registry";
import type { Tool, ToolResult } from "./types";

/** One step of the tool-use loop, surfaced so the caller can persist it. */
export type ToolRun = {
  toolName: string;
  label: string;
  input: unknown;
  result: ToolResult;
  durationMs: number;
  tokensUsed: number;
};

export type ExecuteParams = {
  userId: number;
  beast: Beast;
  /** Prior conversation turns (user/assistant) — pass [] for a fresh conversation. */
  history: { role: "user" | "assistant"; content: string }[];
  /** The current user turn to answer. */
  message: string;
  /** Max tool-call rounds before we force the model to finalize. Default 5. */
  maxTurns?: number;
};

export type ExecuteResult = {
  reply: string;
  runs: ToolRun[];
  tokensUsed: number;
};

/**
 * Run a beast turn end-to-end: send the user's message to the LLM along with
 * the beast's allowed tools, execute any tool_calls the model requests against
 * real provider APIs, feed results back, and loop until the model returns a
 * final text reply (or we hit the turn limit).
 */
export async function executeBeast({
  userId,
  beast,
  history,
  message,
  maxTurns = 5,
}: ExecuteParams): Promise<ExecuteResult> {
  if (!beast.systemPrompt || !beast.tools) {
    throw new Error(`Beast ${beast.slug} has no persona config — cannot execute live`);
  }

  // Gather connected providers for this user across all tools the beast is allowed to use.
  const requiredProviders = new Set<string>();
  for (const name of beast.tools) {
    const tool = getTool(name);
    if (tool) requiredProviders.add(tool.provider);
  }

  const tokenByProvider = new Map<string, string>();
  const connectedProviders = new Set<string>();
  for (const provider of requiredProviders) {
    const fetched = await getDecryptedToken(userId, provider);
    if (fetched) {
      tokenByProvider.set(provider, fetched.token);
      connectedProviders.add(provider);
    }
  }

  const availableTools = getToolsForBeast(beast.tools, connectedProviders);
  const llmTools = toolsToLlmSchema(availableTools);

  // Build the running message list the LLM sees on every round.
  const messages: Message[] = [
    { role: "system", content: beast.systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content }) as Message),
    { role: "user", content: message },
  ];

  // If the beast has no usable tools (user hasn't connected), inject a hint so
  // the LLM can tell the user what to do rather than pretend.
  if (availableTools.length === 0 && requiredProviders.size > 0) {
    const missing = Array.from(requiredProviders).join(", ");
    messages.splice(1, 0, {
      role: "system",
      content: `NOTE: The user has not connected the following required provider(s): ${missing}. Tell them to connect in Settings before you can take action.`,
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
            ? choice.content
                .map((c) => (c.type === "text" ? c.text : ""))
                .join("")
            : "";
      break;
    }

    // Append the assistant's tool-call message so the LLM sees its own calls.
    messages.push({
      role: "assistant",
      content: typeof choice.content === "string" ? choice.content : "",
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const run = await executeOneToolCall(call, availableTools, tokenByProvider, userId);
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
        ? `Finished after ${runs.length} tool call${runs.length === 1 ? "" : "s"}. ` +
          runs.map((r) => r.result.summary).join(" ")
        : "I couldn't complete that request — please try rephrasing.";
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
      result: {
        ok: false,
        summary: `Tool "${name}" is not available`,
        error: "Tool not registered or provider not connected",
      },
      durationMs: Date.now() - start,
      tokensUsed: 0,
    };
  }

  let parsedArgs: unknown;
  try {
    parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    parsedArgs = {};
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
      tokensUsed: 0,
    };
  }

  const token = tokenByProvider.get(tool.provider);
  if (!token) {
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
      tokensUsed: 0,
    };
  }

  const result = await tool.run({ userId, token, input: validated.data });
  return {
    toolName: name,
    label: tool.label,
    input: validated.data,
    result,
    durationMs: Date.now() - start,
    tokensUsed: 0,
  };
}
