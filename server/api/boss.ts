import { Router } from "express";
import { z } from "zod";
import { BOSS } from "../../shared/boss";
import { executeBoss } from "../runtime";
import {
  appendChat,
  createRun,
  finishRun,
  getRecipe,
  loadChat,
} from "../db";
import { HttpError, requireUserId } from "../_core/middleware";

export const bossRouter = Router();

const runSchema = z.object({
  message: z.string().min(1).max(16_000),
  recipeId: z.number().int().optional(),
  useHistory: z.boolean().optional(),
});

/**
 * POST /v1/boss/run
 *
 * Body: { message, recipeId?, useHistory? }
 *
 * Returns: { reply, toolCalls: [...], runId }
 *
 * When `recipeId` is provided, the recipe's prompt is prepended as extra
 * context and its tool allowlist is used; otherwise the global Boss config.
 */
bossRouter.post("/run", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const body = runSchema.parse(req.body);

    let systemPrompt = BOSS.systemPrompt;
    let tools = BOSS.tools;
    let recipeName: string | undefined;

    if (body.recipeId !== undefined) {
      const recipe = await getRecipe(userId, body.recipeId);
      if (!recipe) throw new HttpError(404, "Recipe not found");
      systemPrompt = `${BOSS.systemPrompt}\n\nRecipe: ${recipe.name}\n${recipe.prompt}`;
      tools = recipe.tools;
      recipeName = recipe.name;
    }

    const history = body.useHistory
      ? (await loadChat(userId, 20))
          .reverse()
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const run = await createRun({
      userId,
      recipeId: body.recipeId,
      inputSummary: truncate(body.message, 512),
    });

    const start = Date.now();
    try {
      const result = await executeBoss({
        userId,
        systemPrompt,
        allowedTools: tools,
        history,
        message: body.message,
        maxTurns: 6,
      });

      await finishRun(run.id, {
        status: "success",
        outputSummary: truncate(result.reply, 512),
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - start,
        toolCalls: result.runs.map((r) => ({
          name: r.toolName,
          input: r.input,
          ok: r.result.ok,
          summary: r.result.summary,
        })),
      });

      await appendChat({ userId, role: "user", content: body.message });
      await appendChat({
        userId,
        role: "assistant",
        content: result.reply,
        runId: run.id,
      });

      res.json({
        reply: result.reply,
        toolCalls: result.runs.map((r) => ({
          name: r.toolName,
          label: r.label,
          ok: r.result.ok,
          summary: r.result.summary,
          durationMs: r.durationMs,
        })),
        runId: run.id,
        recipeName,
      });
    } catch (err) {
      await finishRun(run.id, {
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      });
      throw err;
    }
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, err.message));
    next(err);
  }
});

/** GET /v1/boss/chat  → latest chat history, newest-first. */
bossRouter.get("/chat", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const rows = await loadChat(userId, 100);
    res.json({
      messages: rows.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        runId: m.runId,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
