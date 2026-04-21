import { Router } from "express";
import { z } from "zod";
import { BOTS, BOSS, getBot } from "../../shared/bots";
import { executeBoss } from "../runtime";
import {
  appendChat,
  countRunsToday,
  createRun,
  finishRun,
  getRecipe,
  getSubscription,
  loadChat,
} from "../db";
import { HttpError, requireUserId } from "../_core/middleware";
import { ENV } from "../_core/env";
import { sendPushToUser, isApnsConfigured } from "../_core/apns";
import { logger } from "../_core/logger";

export const bossRouter = Router();

const runSchema = z.object({
  botSlug: z.string().optional(),
  message: z.string().min(1).max(16_000),
  recipeId: z.number().int().optional(),
  useHistory: z.boolean().optional(),
  /** When true, also send a push summary to this user's devices. */
  pushOnComplete: z.boolean().optional(),
});

/**
 * POST /v1/boss/run
 *
 * Runs a bot turn. Enforces per-user daily quota before executing.
 * When `pushOnComplete=true`, fires an APNs notification with the reply.
 */
bossRouter.post("/run", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const body = runSchema.parse(req.body);

    // Daily quota gate — Pro subscribers get the higher cap.
    const [used, sub] = await Promise.all([
      countRunsToday(userId),
      getSubscription(userId),
    ]);
    const isPro =
      sub?.plan === "pro" && (sub.status === "active" || sub.status === "trialing");
    const limit = isPro ? ENV.dailyRunQuotaPro : ENV.dailyRunQuotaFree;
    if (used >= limit) {
      throw new HttpError(
        429,
        isPro
          ? `Daily run limit reached (${limit}).`
          : `Daily run limit reached (${limit}). Upgrade to Pro for ${ENV.dailyRunQuotaPro}/day.`
      );
    }

    const bot = getBot(body.botSlug ?? "boss") ?? BOSS;

    let systemPrompt = bot.systemPrompt;
    let tools = bot.tools;
    let recipeName: string | undefined;

    if (body.recipeId !== undefined) {
      const recipe = await getRecipe(userId, body.recipeId);
      if (!recipe) throw new HttpError(404, "Recipe not found");
      systemPrompt = `${bot.systemPrompt}\n\nRecipe: ${recipe.name}\n${recipe.prompt}`;
      tools = recipe.tools;
      recipeName = recipe.name;
    }

    const history = body.useHistory
      ? (await loadChat(userId, bot.slug, 20))
          .reverse()
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const run = await createRun({
      userId,
      botSlug: bot.slug,
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

      await appendChat({ userId, botSlug: bot.slug, role: "user", content: body.message });
      await appendChat({
        userId,
        botSlug: bot.slug,
        role: "assistant",
        content: result.reply,
        runId: run.id,
      });

      // Fire push (non-blocking). Only if explicitly requested or if the
      // run did real work (tool calls actually executed).
      const notable = body.pushOnComplete || result.runs.length > 0;
      if (notable && isApnsConfigured()) {
        sendPushToUser(userId, {
          title: bot.name,
          body: truncate(result.reply, 180),
          data: { runId: String(run.id), botSlug: bot.slug },
        }).catch((err) =>
          logger.warn("push failed", { userId, runId: run.id, err: String(err) })
        );
      }

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
        botSlug: bot.slug,
        recipeName,
        quota: { used: used + 1, limit },
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

/** GET /v1/boss/chat?botSlug=...  → thread history, newest-first. */
bossRouter.get("/chat", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const botSlug = (req.query.botSlug as string) ?? "boss";
    const rows = await loadChat(userId, botSlug, 100);
    res.json({
      botSlug,
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

/** GET /v1/boss/catalog  → the Money Bots catalog. */
bossRouter.get("/catalog", async (_req, res) => {
  res.json({
    bots: BOTS.map((b) => ({
      slug: b.slug,
      name: b.name,
      tagline: b.tagline,
      category: b.category,
      icon: b.icon,
      requiredProviders: b.requiredProviders,
      revenueProposition: b.revenueProposition,
    })),
  });
});

/** GET /v1/boss/quota  → today's usage + plan-aware limit. */
bossRouter.get("/quota", async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const [used, sub] = await Promise.all([
      countRunsToday(userId),
      getSubscription(userId),
    ]);
    const isPro =
      sub?.plan === "pro" && (sub.status === "active" || sub.status === "trialing");
    res.json({
      used,
      limit: isPro ? ENV.dailyRunQuotaPro : ENV.dailyRunQuotaFree,
      plan: sub?.plan ?? "free",
    });
  } catch (err) {
    next(err);
  }
});

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
