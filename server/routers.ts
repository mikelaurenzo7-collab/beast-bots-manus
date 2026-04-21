import { z } from "zod";
import { ACTIONS, getActionById } from "../shared/actions";
import { CONNECTORS, getConnectorById, type ConnectorId } from "../shared/connectors";
import type { RunKind } from "../shared/history";
import { getMissionById, MISSIONS } from "../shared/missions";
import { PRODUCT_SNAPSHOT } from "../shared/product";
import { getScheduleTimingSummary, SCHEDULE_CADENCE_VALUES } from "../shared/schedules";
import { ENV } from "./_core/env";
import { normalizeAutoPauseAfterFailures, validateScheduleTiming } from "./_core/scheduleTiming.ts";
import {
  clearConnectorSecret,
  clearRunHistory,
  createMissionSchedule,
  deleteMissionSchedule,
  getConnectorStatuses,
  getActiveMissionScheduleCount,
  getMissionSchedule,
  getMissionScheduleCount,
  getRunCount,
  isVaultWritable,
  listRunHistory,
  listMissionSchedules,
  recordRun,
  resolveConnectorTokens,
  saveConnectorSecret,
  setMissionScheduleEnabled,
} from "./_core/stateStore";
import { publicProcedure, router } from "./_core/trpc";
import { executeMissionRun } from "./missionRunner";
import { listToolNames } from "./runtime";
import { runActionWithTokens, runConnectorProbe } from "./runtime/orchestrator";

const productRouter = router({
  snapshot: publicProcedure.query(async () => {
    const statuses = await getConnectorStatuses(ENV.connectorTokens);
    const configuredConnectorCount = Object.values(statuses).filter((status) => status.configured).length;
    const configuredActionCount = ACTIONS.filter((action) => statuses[action.connectorId]?.configured).length;
    return {
      ...PRODUCT_SNAPSHOT,
      stats: {
        connectors: CONNECTORS.length,
        liveMissions: MISSIONS.filter((mission) => mission.status === "live").length,
        actions: ACTIONS.length,
        tools: listToolNames().length,
        configuredConnectorCount,
        configuredActionCount,
        historyRuns: await getRunCount(),
        vaultEnabled: isVaultWritable(),
        schedules: await getMissionScheduleCount(),
        activeSchedules: await getActiveMissionScheduleCount(),
      },
    };
  }),
});

const connectorsRouter = router({
  list: publicProcedure.query(async () => {
    const statuses = await getConnectorStatuses(ENV.connectorTokens);
    return CONNECTORS.map((connector) => ({
      ...connector,
      ...statuses[connector.id],
    }));
  }),
  probe: publicProcedure
    .input(z.object({ connectorId: z.enum(["github", "slack", "notion", "linear"]) }))
    .mutation(async ({ input }) => {
      const tokens = await resolveConnectorTokens(ENV.connectorTokens);
      return runConnectorProbe(input.connectorId as ConnectorId, tokens);
    }),
  saveSecret: publicProcedure
    .input(
      z.object({
        connectorId: z.enum(["github", "slack", "notion", "linear"]),
        token: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await saveConnectorSecret(input.connectorId as ConnectorId, input.token);
      const statuses = await getConnectorStatuses(ENV.connectorTokens);
      return statuses[input.connectorId as ConnectorId];
    }),
  clearSecret: publicProcedure
    .input(z.object({ connectorId: z.enum(["github", "slack", "notion", "linear"]) }))
    .mutation(async ({ input }) => {
      await clearConnectorSecret(input.connectorId as ConnectorId);
      const statuses = await getConnectorStatuses(ENV.connectorTokens);
      return statuses[input.connectorId as ConnectorId];
    }),
});

const actionsRouter = router({
  list: publicProcedure.query(async () => {
    const statuses = await getConnectorStatuses(ENV.connectorTokens);
    return ACTIONS.map((action) => ({
      ...action,
      configured: statuses[action.connectorId]?.configured ?? false,
    }));
  }),
  run: publicProcedure
    .input(
      z.object({
        actionId: z.string(),
        payload: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ input }) => {
      const startedAt = Date.now();
      const tokens = await resolveConnectorTokens(ENV.connectorTokens);
      const result = await runActionWithTokens(input.actionId, input.payload, tokens);
      const action = getActionById(input.actionId);
      if (action) {
        await recordRun({
          kind: "action",
          targetId: action.id,
          targetLabel: action.label,
          ok: result.ok,
          summary: result.summary,
          error: result.error,
          durationMs: Date.now() - startedAt,
          connectorIds: [action.connectorId],
          payload: input.payload,
          sections: [
            {
              title: action.label,
              connectorId: action.connectorId,
              connectorLabel: getConnectorById(action.connectorId)?.label ?? action.connectorId,
              ok: result.ok,
              summary: result.summary,
              error: result.error,
            },
          ],
        });
      }
      return result;
    }),
});

const missionsRouter = router({
  list: publicProcedure.query(async () => {
    const statuses = await getConnectorStatuses(ENV.connectorTokens);
    return MISSIONS.map((mission) => ({
      ...mission,
      readyConnectorCount: mission.connectorIds.filter((connectorId) => statuses[connectorId]?.configured).length,
    }));
  }),
  run: publicProcedure
    .input(
      z.object({
        missionId: z.string(),
        payload: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => executeMissionRun(input.missionId, input.payload ?? {}, { kind: "manual" })),
});

const schedulesRouter = router({
  list: publicProcedure.query(() => listMissionSchedules()),
  create: publicProcedure
    .input(
      z.object({
        missionId: z.string(),
        label: z.string().optional(),
        cadence: z.enum(SCHEDULE_CADENCE_VALUES),
        payload: z.record(z.string(), z.unknown()).optional(),
        timeOfDay: z.string().optional(),
        timezone: z.string().optional(),
        autoPauseAfterFailures: z.number().int().min(1).max(10).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const mission = getMissionById(input.missionId);
      if (!mission) {
        throw new Error(`Unknown mission: ${input.missionId}`);
      }

      const payload = input.payload ?? {};
      const missingFields = mission.fields
        .filter((field) => {
          if (!field.required) return false;
          const value = payload[field.key];
          if (field.type === "number") {
            return typeof value !== "number" || !Number.isFinite(value);
          }
          return typeof value !== "string" || !value.trim();
        })
        .map((field) => field.label);

      if (missingFields.length > 0) {
        throw new Error(`Missing required mission schedule fields: ${missingFields.join(", ")}`);
      }

      validateScheduleTiming({
        cadence: input.cadence,
        timeOfDay: input.timeOfDay?.trim() || undefined,
        timezone: input.timezone?.trim() || undefined,
      });

      return createMissionSchedule({
        missionId: mission.id,
        missionTitle: mission.title,
        label:
          input.label?.trim() ||
          `${mission.title} · ${getScheduleTimingSummary({
            cadence: input.cadence,
            timeOfDay: input.timeOfDay?.trim() || undefined,
            timezone: input.timezone?.trim() || undefined,
          })}`,
        cadence: input.cadence,
        payload,
        connectorIds: mission.connectorIds,
        timeOfDay: input.timeOfDay?.trim() || undefined,
        timezone: input.timezone?.trim() || undefined,
        autoPauseAfterFailures: normalizeAutoPauseAfterFailures(input.autoPauseAfterFailures),
      });
    }),
  setEnabled: publicProcedure
    .input(
      z.object({
        scheduleId: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(({ input }) => setMissionScheduleEnabled(input.scheduleId, input.enabled)),
  delete: publicProcedure
    .input(z.object({ scheduleId: z.string() }))
    .mutation(async ({ input }) => {
      await deleteMissionSchedule(input.scheduleId);
      return { success: true };
    }),
  runNow: publicProcedure
    .input(z.object({ scheduleId: z.string() }))
    .mutation(async ({ input }) => {
      const schedule = await getMissionSchedule(input.scheduleId);
      if (!schedule) {
        throw new Error(`Unknown schedule: ${input.scheduleId}`);
      }

      return executeMissionRun(schedule.missionId, schedule.payload, {
        kind: "schedule",
        scheduleId: schedule.id,
        scheduleLabel: schedule.label,
      });
    }),
});

const historyRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          kind: z.enum(["action", "mission"]).optional(),
          limit: z.number().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(({ input }) => listRunHistory({ kind: input?.kind as RunKind | undefined, limit: input?.limit })),
  clear: publicProcedure.mutation(async () => {
    await clearRunHistory();
    return { success: true };
  }),
});

const runtimeRouter = router({
  tools: publicProcedure.query(() => listToolNames()),
});

export const appRouter = router({
  product: productRouter,
  connectors: connectorsRouter,
  actions: actionsRouter,
  missions: missionsRouter,
  schedules: schedulesRouter,
  history: historyRouter,
  runtime: runtimeRouter,
});

export type AppRouter = typeof appRouter;