import { and, eq, isNotNull } from "drizzle-orm";
import { BOSS, getBot } from "../../shared/bots";
import { recipes } from "../../drizzle/schema";
import {
  appendChat,
  createRun,
  finishRun,
  getDb,
  listExpiringConnections,
  saveConnection,
} from "../db";
import { executeBoss } from "./index";
import { logger } from "../_core/logger";
import { sendPushToUser } from "../_core/apns";
import { decryptToken } from "../_core/crypto";
import { getProvider } from "../providers";

/**
 * Scheduled recipe runner.
 *
 * On each tick (every 60s), loads `recipes` where triggerKind=schedule and
 * runs any whose cron matches the current minute (UTC). Each scheduled run
 * is ordinary — same executeBoss path, same audit trail — plus a push to
 * the user's device(s) summarizing the result.
 *
 * The cron matcher supports 5 fields (minute, hour, day-of-month, month,
 * day-of-week) with lists (`1,2,3`), ranges (`1-5`), and wildcards (`*`).
 * No step syntax yet; add when needed.
 */

let timer: NodeJS.Timeout | null = null;
let lastTickMinute = -1;

export function startScheduler(): void {
  if (timer) return;
  logger.info("scheduler: starting");
  timer = setInterval(tick, 60_000);
  // Also fire once on startup so tests don't wait a minute.
  setImmediate(tick);
}

export function stopScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

async function tick() {
  const now = new Date();
  const minute = Math.floor(now.getTime() / 60_000);
  if (minute === lastTickMinute) return;
  lastTickMinute = minute;

  try {
    const rows = await getDb()
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.triggerKind, "schedule"),
          eq(recipes.archived, false),
          isNotNull(recipes.triggerCron)
        )
      );

    for (const r of rows) {
      if (!r.triggerCron || !cronMatches(r.triggerCron, now)) continue;
      runScheduled(r).catch((err) =>
        logger.error("scheduled run failed", {
          recipeId: r.id,
          userId: r.userId,
          err: String(err),
        })
      );
    }
  } catch (err) {
    logger.error("scheduler tick failed", { err: String(err) });
  }

  // Once every 15 minutes: rotate tokens that are about to expire.
  if (minute % 15 === 0) {
    rotateExpiringTokens().catch((err) =>
      logger.error("token rotation failed", { err: String(err) })
    );
  }
}

/**
 * Refresh OAuth access tokens that expire in the next 24 hours, using each
 * provider's `refresh()` hook. Silent for providers without a refresh flow
 * (Shopify) or without a stored refresh token.
 */
async function rotateExpiringTokens() {
  const rows = await listExpiringConnections(24);
  for (const row of rows) {
    const provider = getProvider(row.provider);
    if (!provider?.refresh || !row.refreshTokenCiphertext) continue;
    try {
      const refresh = decryptToken(row.refreshTokenCiphertext, row.tokenIv);
      const result = await provider.refresh(refresh);
      if (!result) continue;
      await saveConnection({
        userId: row.userId,
        provider: row.provider,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? refresh,
        scopes: result.scopes,
        expiresAt: result.expiresInSeconds
          ? new Date(Date.now() + result.expiresInSeconds * 1000)
          : undefined,
        accountId: row.accountId ?? undefined,
        accountName: row.accountName ?? undefined,
      });
      logger.info("refreshed provider token", {
        userId: row.userId,
        provider: row.provider,
      });
    } catch (err) {
      logger.warn("token refresh failed", {
        userId: row.userId,
        provider: row.provider,
        err: String(err),
      });
    }
  }
}

async function runScheduled(recipe: typeof recipes.$inferSelect) {
  // Scheduled runs default to the generalist so we don't accidentally invoke
  // a bot the user revoked a connection on. A recipe can override with a
  // bot slug in its prompt if desired.
  const bot = getBot("boss") ?? BOSS;
  const message = `[scheduled] ${recipe.name}`;
  const run = await createRun({
    userId: recipe.userId,
    botSlug: bot.slug,
    recipeId: recipe.id,
    inputSummary: message,
  });

  const start = Date.now();
  try {
    const result = await executeBoss({
      userId: recipe.userId,
      systemPrompt: `${bot.systemPrompt}\n\nRecipe: ${recipe.name}\n${recipe.prompt}`,
      allowedTools: recipe.tools,
      history: [],
      message,
      maxTurns: 6,
    });

    await finishRun(run.id, {
      status: "success",
      outputSummary: result.reply.slice(0, 512),
      tokensUsed: result.tokensUsed,
      durationMs: Date.now() - start,
      toolCalls: result.runs.map((r) => ({
        name: r.toolName,
        input: r.input,
        ok: r.result.ok,
        summary: r.result.summary,
      })),
    });
    await appendChat({
      userId: recipe.userId,
      botSlug: bot.slug,
      role: "assistant",
      content: result.reply,
      runId: run.id,
    });
    await sendPushToUser(recipe.userId, {
      title: recipe.name,
      body: result.reply.slice(0, 180),
      data: { runId: String(run.id), recipeId: String(recipe.id) },
    });
  } catch (err) {
    await finishRun(run.id, {
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    });
  }
}

// ─── Cron matcher ───────────────────────────────────────────────────────────

/**
 * Match a 5-field cron against a Date (UTC).
 * Supports: *, comma lists, hyphen ranges. No step or name aliases yet.
 */
export function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [m, h, dom, mon, dow] = parts;
  const now = {
    minute: date.getUTCMinutes(),
    hour: date.getUTCHours(),
    dom: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    dow: date.getUTCDay(),
  };
  return (
    matchField(m, now.minute, 0, 59) &&
    matchField(h, now.hour, 0, 23) &&
    matchField(dom, now.dom, 1, 31) &&
    matchField(mon, now.month, 1, 12) &&
    matchField(dow, now.dow, 0, 6)
  );
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (value >= a && value <= b) return true;
    } else {
      const n = Number(part);
      if (Number.isFinite(n) && n >= min && n <= max && n === value) return true;
    }
  }
  return false;
}
