import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { BEASTS, getBeastBySlug } from "../shared/agents";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  clearChatHistory,
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
      // Store the API key as the "access token" (plaintext for now — production would encrypt)
      const { upsertOAuthConnection } = await import("./db");
      await upsertOAuthConnection({
        userId: ctx.user.id,
        provider: input.provider,
        accessTokenCiphertext: input.apiKey,
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

  // Simulate running an agent (demo mode)
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
      if (!installation) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Agent not installed" });

      const { createAgentRun, updateAgentRun } = await import("./db");
      const runResult = await createAgentRun({
        installationId: installation.id,
        userId: ctx.user.id,
        agentSlug: input.agentSlug,
        action: input.action,
        inputSummary: input.inputSummary,
      });

      // Simulate async run
      const startMs = Date.now();
      const success = Math.random() > 0.1;
      const durationMs = 800 + Math.floor(Math.random() * 2200);

      if (runResult) {
        const runId = (runResult as unknown as { insertId: number }).insertId;
        setTimeout(async () => {
          await updateAgentRun(runId, {
            status: success ? "success" : "error",
            outputSummary: success ? `${input.action} completed successfully` : undefined,
            tokensUsed: success ? Math.floor(Math.random() * 500) + 100 : 0,
            durationMs,
            errorMessage: success ? undefined : "Simulated error — check your connection settings",
          });
          await createNotification({
            userId: ctx.user.id,
            type: success ? "run_complete" : "run_error",
            title: success ? `${beast.name} run complete` : `${beast.name} run failed`,
            body: success
              ? `${input.action} finished in ${(durationMs / 1000).toFixed(1)}s`
              : "Check your connection settings and try again.",
            agentSlug: input.agentSlug,
          });
        }, durationMs);
      }

      return { success: true, durationMs };
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
    const msgs = await getChatHistory(ctx.user.id, 50);
    return msgs.reverse();
  }),

  send: protectedProcedure
    .input(z.object({ message: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      // Save user message
      await saveChatMessage({ userId: ctx.user.id, role: "user", content: input.message });

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

      await saveChatMessage({ userId: ctx.user.id, role: "assistant", content: assistantContent });

      return { content: assistantContent };
    }),

  clear: protectedProcedure.mutation(async ({ ctx }) => {
    await clearChatHistory(ctx.user.id);
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
