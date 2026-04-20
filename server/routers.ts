import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { BEASTS, getBeastBySlug } from "../shared/agents";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { executeBeast } from "./runtime";
import {
  clearChatHistory,
  createAgentRun,
  createNotification,
  deleteOAuthConnection,
  getAgentRuns,
  getAgentRunsBySlug,
  getChatHistory,
  getInstallation,
  getInstallations,
  getNotifications,
  getOAuthConnection,
  getOAuthConnections,
  getUnreadCount,
  installAgent,
  markNotificationsRead,
  saveChatMessage,
  uninstallAgent,
  updateAgentRun,
  updateInstallationCustomizations,
} from "./db";

// ─── Agents Router ────────────────────────────────────────────────────────────

const agentsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        category: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(80),
        offset: z.number().min(0).default(0),
      })
    )
    .query(({ input }) => {
      let filtered = BEASTS;
      if (input.category && input.category !== "All") {
        filtered = filtered.filter((b) => b.category === input.category);
      }
      if (input.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            b.tagline.toLowerCase().includes(q) ||
            b.description.toLowerCase().includes(q) ||
            b.platform.toLowerCase().includes(q) ||
            b.category.toLowerCase().includes(q)
        );
      }
      return {
        total: filtered.length,
        items: filtered.slice(input.offset, input.offset + input.limit),
      };
    }),

  get: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) => {
    const beast = getBeastBySlug(input.slug);
    if (!beast) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
    return beast;
  }),

  featured: publicProcedure.query(() => BEASTS.filter((b) => b.featured)),
  hot: publicProcedure.query(() => BEASTS.filter((b) => b.hot)),
  new: publicProcedure.query(() => BEASTS.filter((b) => b.new)),

  stats: publicProcedure.query(() => ({
    total: BEASTS.length,
    totalInstalls: BEASTS.reduce((a, b) => a + b.installs, 0),
    categories: 14,
    avgRating: Math.round((BEASTS.reduce((a, b) => a + b.rating, 0) / BEASTS.length) * 10) / 10,
  })),
});

// ─── Installations Router ─────────────────────────────────────────────────────

const installationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getInstallations(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ agentSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      return getInstallation(ctx.user.id, input.agentSlug);
    }),

  install: protectedProcedure
    .input(
      z.object({
        agentSlug: z.string(),
        connectionId: z.number().optional(),
        customizations: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const beast = getBeastBySlug(input.agentSlug);
      if (!beast) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      await installAgent({
        userId: ctx.user.id,
        agentSlug: input.agentSlug,
        connectionId: input.connectionId,
        customizations: input.customizations,
      });
      await createNotification({
        userId: ctx.user.id,
        type: "system",
        title: `${beast.name} installed!`,
        body: `${beast.tagline} is now active and ready to run.`,
        agentSlug: input.agentSlug,
      });
      return { success: true };
    }),

  uninstall: protectedProcedure
    .input(z.object({ agentSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await uninstallAgent(ctx.user.id, input.agentSlug);
      return { success: true };
    }),

  updateCustomizations: protectedProcedure
    .input(
      z.object({
        agentSlug: z.string(),
        customizations: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateInstallationCustomizations(ctx.user.id, input.agentSlug, input.customizations);
      return { success: true };
    }),
});

// ─── Connections Router ───────────────────────────────────────────────────────

const connectionsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getOAuthConnections(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ ctx, input }) => {
      return getOAuthConnection(ctx.user.id, input.provider);
    }),

  disconnect: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteOAuthConnection(ctx.user.id, input.provider);
      return { success: true };
    }),

  // Save an API-key or token-based connection
  saveApiKey: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        apiKey: z.string().min(1),
        accountName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { upsertOAuthConnection } = await import("./db");
      const { encryptToken } = await import("./_core/crypto");
      const { ciphertext, iv } = encryptToken(input.apiKey);
      await upsertOAuthConnection({
        userId: ctx.user.id,
        provider: input.provider,
        accessTokenCiphertext: ciphertext,
        tokenIv: iv,
        accountName: input.accountName,
        scopes: [],
      });
      return { success: true };
    }),
});

// ─── Activity Router ──────────────────────────────────────────────────────────

const activityRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      return getAgentRuns(ctx.user.id, input.limit);
    }),

  byAgent: protectedProcedure
    .input(z.object({ agentSlug: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      return getAgentRunsBySlug(ctx.user.id, input.agentSlug, input.limit);
    }),

  /**
   * Legacy quick-run entry point kept for backwards compat with the Agent
   * Detail "Quick Actions" chips. Dispatches to the real runtime when the
   * beast is configured; otherwise records a demo run.
   */
  run: protectedProcedure
    .input(
      z.object({
        agentSlug: z.string(),
        action: z.string(),
        inputSummary: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const beast = getBeastBySlug(input.agentSlug);
      if (!beast) throw new TRPCError({ code: "NOT_FOUND" });

      const installation = await getInstallation(ctx.user.id, input.agentSlug);
      if (!installation) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Agent not installed" });
      }

      // Real runtime path: ask the LLM to perform the action using the beast's tools.
      if (beast.systemPrompt && beast.tools && beast.tools.length > 0) {
        const start = Date.now();
        try {
          const { reply, runs, tokensUsed } = await executeBeast({
            userId: ctx.user.id,
            beast,
            history: [],
            message: input.action,
          });
          const allOk = runs.every((r) => r.result.ok);
          const inserted = await createAgentRun({
            installationId: installation.id,
            userId: ctx.user.id,
            agentSlug: input.agentSlug,
            action: input.action,
            inputSummary: input.inputSummary ?? `Quick action: ${input.action}`,
          });
          const runId = (inserted as unknown as { insertId: number } | undefined)?.insertId;
          if (runId) {
            await updateAgentRun(runId, {
              status: allOk ? "success" : "error",
              outputSummary: reply.slice(0, 1000),
              tokensUsed,
              durationMs: Date.now() - start,
              errorMessage: allOk ? undefined : runs.find((r) => !r.result.ok)?.result.error,
            });
          }
          await createNotification({
            userId: ctx.user.id,
            type: allOk ? "run_complete" : "run_error",
            title: allOk ? `${beast.name} run complete` : `${beast.name} run failed`,
            body: allOk
              ? `${runs.length} tool call${runs.length === 1 ? "" : "s"} in ${((Date.now() - start) / 1000).toFixed(1)}s`
              : runs.find((r) => !r.result.ok)?.result.error ?? "See activity for details.",
            agentSlug: input.agentSlug,
          });
          return { success: allOk, reply, runs, durationMs: Date.now() - start };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }

      // Demo fallback: record a clearly-labelled demo run so users aren't misled.
      const inserted = await createAgentRun({
        installationId: installation.id,
        userId: ctx.user.id,
        agentSlug: input.agentSlug,
        action: input.action,
        inputSummary: input.inputSummary ?? `Demo: ${input.action}`,
      });
      const runId = (inserted as unknown as { insertId: number } | undefined)?.insertId;
      if (runId) {
        await updateAgentRun(runId, {
          status: "demo",
          outputSummary: "Demo run — this beast's live handler isn't wired up yet.",
          durationMs: 500,
        });
      }
      return { success: true, reply: "Demo run recorded.", runs: [], durationMs: 500 };
    }),

  /**
   * Per-beast chat turn. Drives the tool-use loop, persists the user + assistant
   * messages scoped to `agentSlug`, and writes a real agent_runs row per tool call.
   */
  chat: protectedProcedure
    .input(
      z.object({
        agentSlug: z.string(),
        message: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const beast = getBeastBySlug(input.agentSlug);
      if (!beast) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      if (!beast.systemPrompt || !beast.tools) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `${beast.name} isn't wired for live chat yet. Try the BeastBot concierge instead.`,
        });
      }
      const installation = await getInstallation(ctx.user.id, input.agentSlug);
      if (!installation) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Install this beast first." });
      }

      await saveChatMessage({
        userId: ctx.user.id,
        role: "user",
        content: input.message,
        agentSlug: input.agentSlug,
      });

      const priorRaw = await getChatHistory(ctx.user.id, 20, input.agentSlug);
      const prior = priorRaw
        .slice()
        .reverse()
        // Drop the just-inserted user message; executeBeast adds the current one itself.
        .slice(0, -1)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const start = Date.now();
      const { reply, runs, tokensUsed } = await executeBeast({
        userId: ctx.user.id,
        beast,
        history: prior,
        message: input.message,
      });

      // Persist each tool call as an agent_runs row for the Activity feed.
      for (const run of runs) {
        const inserted = await createAgentRun({
          installationId: installation.id,
          userId: ctx.user.id,
          agentSlug: input.agentSlug,
          action: run.toolName,
          inputSummary: JSON.stringify(run.input).slice(0, 500),
        });
        const runId = (inserted as unknown as { insertId: number } | undefined)?.insertId;
        if (runId) {
          await updateAgentRun(runId, {
            status: run.result.ok ? "success" : "error",
            outputSummary: run.result.summary.slice(0, 1000),
            durationMs: run.durationMs,
            errorMessage: run.result.ok ? undefined : run.result.error,
          });
        }
      }

      await saveChatMessage({
        userId: ctx.user.id,
        role: "assistant",
        content: reply,
        agentSlug: input.agentSlug,
      });

      return {
        reply,
        runs: runs.map((r) => ({
          toolName: r.toolName,
          label: r.label,
          ok: r.result.ok,
          summary: r.result.summary,
          error: r.result.error,
          durationMs: r.durationMs,
        })),
        tokensUsed,
        durationMs: Date.now() - start,
      };
    }),

  /** History for a beast's chat thread. */
  chatHistory: protectedProcedure
    .input(z.object({ agentSlug: z.string(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const msgs = await getChatHistory(ctx.user.id, input.limit, input.agentSlug);
      return msgs.slice().reverse();
    }),

  /** Clear a single beast's chat thread. */
  clearChat: protectedProcedure
    .input(z.object({ agentSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await clearChatHistory(ctx.user.id, input.agentSlug);
      return { success: true };
    }),
});

// ─── Notifications Router ─────────────────────────────────────────────────────

const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      return getNotifications(ctx.user.id, input.limit);
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return getUnreadCount(ctx.user.id);
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markNotificationsRead(ctx.user.id);
    return { success: true };
  }),
  // Admin/system: broadcast a "new bot" notification to all users who have installed
  // agents in the same category as the new bot. Called when a new agent is added.
  broadcastNewBot: publicProcedure
    .input(
      z.object({
        agentSlug: z.string(),
        adminSecret: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Validate admin secret (simple check — in production use a signed token)
      if (input.adminSecret !== (process.env.JWT_SECRET ?? "").slice(0, 16)) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const beast = getBeastBySlug(input.agentSlug);
      if (!beast) throw new TRPCError({ code: "NOT_FOUND" });
      // Get all users who have installed agents in the same category
      // Find all agents in the same category and get users who installed any of them
      const sameCategory = BEASTS.filter((b) => b.category === beast.category).map((b) => b.slug);
      const { getUsersWithInstallations } = await import("./db");
      const rows = await getUsersWithInstallations(sameCategory);
      let notified = 0;
      for (const row of rows) {
        await createNotification({
          userId: row.userId,
          type: "new_bot",
          title: `New beast in ${beast.category}!`,
          body: `${beast.name} — ${beast.tagline} is now available in the marketplace.`,
          agentSlug: input.agentSlug,
        });
        notified++;
      }
      return { notified };
    }),
});

// ─── Chat Router ──────────────────────────────────────────────────────────────

const chatRouter = router({
  history: protectedProcedure.query(async ({ ctx }) => {
    // Global BeastBot concierge: only the `agentSlug IS NULL` rows.
    const msgs = await getChatHistory(ctx.user.id, 50, null);
    return msgs.reverse();
  }),

  send: protectedProcedure
    .input(z.object({ message: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      // Save user message to the global (unscoped) concierge thread.
      await saveChatMessage({
        userId: ctx.user.id,
        role: "user",
        content: input.message,
        agentSlug: null,
      });

      // Get installed agents for context
      const installed = await getInstallations(ctx.user.id);
      const installedSlugs = installed.map((i) => i.agentSlug);
      const installedBeasts = BEASTS.filter((b) => installedSlugs.includes(b.slug));

      const systemPrompt = `You are BeastBot, the AI assistant for Beast Bots — the app store for AI agents.
You help users discover, configure, and get the most out of their Beast Bots.

The user has ${installedBeasts.length} agents installed: ${installedBeasts.map((b) => b.name).join(", ") || "none yet"}.

Available agents in the marketplace: ${BEASTS.map((b) => `${b.name} (${b.category})`).join(", ")}.

Your role:
- Recommend the best Beast Bots based on the user's workflow needs
- Explain what each bot does and how to configure it
- Suggest automation workflows and use cases
- Help troubleshoot connection issues
- Be enthusiastic, helpful, and concise

Keep responses under 200 words. Use bullet points for lists. Be specific and actionable.`;

      const response = await invokeLLM({
        messages: [
          { role: "system" as const, content: systemPrompt as string },
          { role: "user" as const, content: input.message as string },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const assistantContent: string = typeof rawContent === "string" ? rawContent : "I'm having trouble thinking right now. Try again!";

      await saveChatMessage({
        userId: ctx.user.id,
        role: "assistant",
        content: assistantContent,
        agentSlug: null,
      });

      return { content: assistantContent };
    }),

  clear: protectedProcedure.mutation(async ({ ctx }) => {
    await clearChatHistory(ctx.user.id, null);
    return { success: true };
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  agents: agentsRouter,
  installations: installationsRouter,
  connections: connectionsRouter,
  activity: activityRouter,
  notifications: notificationsRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
