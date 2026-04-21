import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { CONNECTORS, type ConnectorId, type ConnectorRuntimeStatus } from "../../shared/connectors";
import type { RunHistoryEntry, RunHistorySection, RunKind, RunSynthesis } from "../../shared/history";
import {
  SCHEDULE_CADENCE_VALUES,
  scheduleUsesLocalTime,
  type MissionSchedule,
  type ScheduleCadence,
} from "../../shared/schedules";
import { ENV } from "./env";
import { calculateNextRunAt as calculateScheduledRunAt, normalizeAutoPauseAfterFailures } from "./scheduleTiming.ts";
import { decryptSecret, encryptSecret, type PackedEncrypted } from "./vaultCrypto";

type StoredConnectorSecret = {
  encryptedToken: PackedEncrypted;
  updatedAt: string;
  last4: string;
};

type BotBossState = {
  version: 1;
  connectors: Partial<Record<ConnectorId, StoredConnectorSecret>>;
  runHistory: RunHistoryEntry[];
  missionSchedules: MissionSchedule[];
};

type RunRecordInput = {
  kind: RunKind;
  targetId: string;
  targetLabel: string;
  ok: boolean;
  summary: string;
  narrative?: string;
  error?: string;
  durationMs: number;
  connectorIds: ConnectorId[];
  payload: Record<string, unknown>;
  sections: RunHistorySection[];
  synthesis?: RunSynthesis;
};

type MissionScheduleInput = {
  missionId: string;
  missionTitle: string;
  label: string;
  cadence: ScheduleCadence;
  payload: Record<string, unknown>;
  connectorIds: ConnectorId[];
  timeOfDay?: string;
  timezone?: string;
  autoPauseAfterFailures?: number;
};

const DEFAULT_STATE: BotBossState = {
  version: 1,
  connectors: {},
  runHistory: [],
  missionSchedules: [],
};

let writeQueue = Promise.resolve();

const VALID_SCHEDULE_CADENCES = new Set<ScheduleCadence>(SCHEDULE_CADENCE_VALUES);
const VALID_CONNECTOR_IDS = new Set<ConnectorId>(CONNECTORS.map((connector) => connector.id));

function getDataDir() {
  return process.env.BOT_BOSS_DATA_DIR?.trim() || ENV.dataDir || path.resolve(import.meta.dirname, "../..", ".bot-boss-data");
}

function getStateFilePath() {
  return path.join(getDataDir(), "state.json");
}

function getVaultKey() {
  return process.env.BOT_BOSS_VAULT_KEY?.trim() || ENV.vaultKey;
}

function ensureVaultKey() {
  const key = getVaultKey();
  if (!key || key.length < 32) {
    throw new Error("BOT_BOSS_VAULT_KEY must be set and at least 32 characters to save encrypted connector secrets.");
  }
  return key;
}

function maskToken(token: string) {
  return token.length <= 4 ? "••••" : `••••${token.slice(-4)}`;
}

function normalizeState(raw: unknown): BotBossState {
  if (!raw || typeof raw !== "object") return DEFAULT_STATE;
  const record = raw as Partial<BotBossState>;
  return {
    version: 1,
    connectors: record.connectors && typeof record.connectors === "object" ? record.connectors : {},
    runHistory: Array.isArray(record.runHistory) ? record.runHistory : [],
    missionSchedules: Array.isArray(record.missionSchedules)
      ? record.missionSchedules.flatMap((schedule) => {
          const normalized = normalizeMissionSchedule(schedule);
          return normalized ? [normalized] : [];
        })
      : [],
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toIsoString(value: Date) {
  return value.toISOString();
}

export function calculateNextRunAt(
  input: ScheduleCadence | Pick<MissionSchedule, "cadence" | "timeOfDay" | "timezone">,
  from = new Date()
) {
  if (typeof input === "string") {
    return calculateScheduledRunAt({ cadence: input, timeOfDay: undefined, timezone: undefined }, from);
  }

  return calculateScheduledRunAt(input, from);
}

function normalizeMissionSchedule(raw: unknown): MissionSchedule | null {
  if (!isObjectRecord(raw)) return null;

  const cadence = typeof raw.cadence === "string" && VALID_SCHEDULE_CADENCES.has(raw.cadence as ScheduleCadence)
    ? (raw.cadence as ScheduleCadence)
    : null;

  if (!cadence || typeof raw.id !== "string" || typeof raw.missionId !== "string" || typeof raw.missionTitle !== "string" || typeof raw.label !== "string") {
    return null;
  }

  const connectorIds = Array.isArray(raw.connectorIds)
    ? raw.connectorIds.filter((connectorId): connectorId is ConnectorId => typeof connectorId === "string" && VALID_CONNECTOR_IDS.has(connectorId as ConnectorId))
    : [];

  const timeOfDay = typeof raw.timeOfDay === "string" && raw.timeOfDay.trim() ? raw.timeOfDay.trim() : undefined;
  const timezone = typeof raw.timezone === "string" && raw.timezone.trim() ? raw.timezone.trim() : undefined;

  return {
    id: raw.id,
    missionId: raw.missionId,
    missionTitle: raw.missionTitle,
    label: raw.label,
    cadence,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    payload: isObjectRecord(raw.payload) ? raw.payload : {},
    connectorIds,
    timeOfDay: scheduleUsesLocalTime(cadence) ? timeOfDay ?? "09:00" : undefined,
    timezone: scheduleUsesLocalTime(cadence) ? timezone ?? "UTC" : undefined,
    consecutiveFailures: typeof raw.consecutiveFailures === "number" && raw.consecutiveFailures >= 0 ? Math.trunc(raw.consecutiveFailures) : 0,
    autoPauseAfterFailures: normalizeAutoPauseAfterFailures(
      typeof raw.autoPauseAfterFailures === "number" ? raw.autoPauseAfterFailures : undefined
    ),
    pausedReason:
      raw.pausedReason === "failure-threshold"
        ? "failure-threshold"
        : typeof raw.enabled === "boolean" && !raw.enabled
          ? "manual"
          : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    nextRunAt: typeof raw.nextRunAt === "string" ? raw.nextRunAt : new Date().toISOString(),
    lastRunAt: typeof raw.lastRunAt === "string" ? raw.lastRunAt : undefined,
    lastRunStatus: raw.lastRunStatus === "success" || raw.lastRunStatus === "error" ? raw.lastRunStatus : undefined,
    lastRunSummary: typeof raw.lastRunSummary === "string" ? raw.lastRunSummary : undefined,
  };
}

function sortSchedules(schedules: MissionSchedule[]) {
  return [...schedules].sort((left, right) => {
    if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
    return left.nextRunAt.localeCompare(right.nextRunAt);
  });
}

async function ensureDataDir() {
  await fs.mkdir(getDataDir(), { recursive: true });
}

async function readState(): Promise<BotBossState> {
  try {
    const file = await fs.readFile(getStateFilePath(), "utf8");
    return normalizeState(JSON.parse(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_STATE, connectors: {}, runHistory: [] };
    }
    throw error;
  }
}

async function writeState(state: BotBossState) {
  await ensureDataDir();
  const filePath = getStateFilePath();
  const tempPath = `${filePath}.${nanoid(6)}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

async function updateState(mutator: (state: BotBossState) => BotBossState | Promise<BotBossState>) {
  let result: BotBossState = DEFAULT_STATE;
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const current = await readState();
    result = await mutator(current);
    await writeState(result);
  });
  await writeQueue;
  return result;
}

export function isVaultWritable() {
  const key = getVaultKey();
  return Boolean(key && key.length >= 32);
}

export async function resolveConnectorTokens(envTokens: Record<ConnectorId, string | undefined>) {
  const state = await readState();
  const tokens: Record<ConnectorId, string | undefined> = { ...envTokens };
  const vaultKey = getVaultKey();
  if (!vaultKey) return tokens;

  for (const connector of CONNECTORS) {
    const stored = state.connectors[connector.id];
    if (!stored) continue;

    try {
      tokens[connector.id] = decryptSecret(stored.encryptedToken, vaultKey);
    } catch (error) {
      console.warn(`[vault] failed to decrypt ${connector.id} secret`, error);
    }
  }

  return tokens;
}

export async function getConnectorStatuses(envTokens: Record<ConnectorId, string | undefined>) {
  const state = await readState();
  const vaultWritable = isVaultWritable();

  const statuses = Object.fromEntries(
    CONNECTORS.map((connector) => {
      const envToken = envTokens[connector.id];
      const stored = state.connectors[connector.id];

      const status: ConnectorRuntimeStatus = stored
        ? vaultWritable
          ? {
              configured: true,
              source: "vault",
              maskedToken: stored.last4 ? `••••${stored.last4}` : undefined,
              updatedAt: stored.updatedAt,
              vaultEnabled: true,
              vaultLocked: false,
              hasStoredSecret: true,
            }
          : {
              configured: Boolean(envToken),
              source: envToken ? "env" : "none",
              maskedToken: envToken ? maskToken(envToken) : undefined,
              updatedAt: stored.updatedAt,
              vaultEnabled: false,
              vaultLocked: true,
              hasStoredSecret: true,
            }
        : envToken
          ? {
              configured: true,
              source: "env",
              maskedToken: maskToken(envToken),
              updatedAt: undefined,
              vaultEnabled: vaultWritable,
              vaultLocked: false,
              hasStoredSecret: false,
            }
          : {
              configured: false,
              source: "none",
              maskedToken: undefined,
              updatedAt: undefined,
              vaultEnabled: vaultWritable,
              vaultLocked: false,
              hasStoredSecret: false,
            };

      return [connector.id, status];
    })
  ) as Record<ConnectorId, ConnectorRuntimeStatus>;

  return statuses;
}

export async function saveConnectorSecret(connectorId: ConnectorId, token: string) {
  const normalized = token.trim();
  if (!normalized) {
    throw new Error("Connector token cannot be empty.");
  }

  const vaultKey = ensureVaultKey();
  await updateState((state) => ({
    ...state,
    connectors: {
      ...state.connectors,
      [connectorId]: {
        encryptedToken: encryptSecret(normalized, vaultKey),
        updatedAt: new Date().toISOString(),
        last4: normalized.slice(-4),
      },
    },
  }));
}

export async function clearConnectorSecret(connectorId: ConnectorId) {
  await updateState((state) => {
    const nextConnectors = { ...state.connectors };
    delete nextConnectors[connectorId];
    return {
      ...state,
      connectors: nextConnectors,
    };
  });
}

export async function recordRun(input: RunRecordInput) {
  const entry: RunHistoryEntry = {
    id: nanoid(12),
    kind: input.kind,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    ok: input.ok,
    summary: input.summary,
    narrative: input.narrative,
    error: input.error,
    createdAt: new Date().toISOString(),
    durationMs: input.durationMs,
    connectorIds: input.connectorIds,
    payload: input.payload,
    sections: input.sections,
    synthesis: input.synthesis,
  };

  await updateState((state) => ({
    ...state,
    runHistory: [entry, ...state.runHistory].slice(0, 200),
  }));

  return entry;
}

export async function listRunHistory(options?: { kind?: RunKind; limit?: number }) {
  const state = await readState();
  const filtered = options?.kind ? state.runHistory.filter((entry) => entry.kind === options.kind) : state.runHistory;
  return filtered.slice(0, options?.limit ?? 24);
}

export async function clearRunHistory() {
  await updateState((state) => ({
    ...state,
    runHistory: [],
  }));
}

export async function getRunCount() {
  const state = await readState();
  return state.runHistory.length;
}

export async function getMissionScheduleCount() {
  const state = await readState();
  return state.missionSchedules.length;
}

export async function getActiveMissionScheduleCount() {
  const state = await readState();
  return state.missionSchedules.filter((schedule) => schedule.enabled).length;
}

export async function listMissionSchedules() {
  const state = await readState();
  return sortSchedules(state.missionSchedules);
}

export async function getMissionSchedule(scheduleId: string) {
  const state = await readState();
  return state.missionSchedules.find((schedule) => schedule.id === scheduleId);
}

export async function createMissionSchedule(input: MissionScheduleInput, options?: { now?: Date }) {
  const now = options?.now ?? new Date();
  const schedule: MissionSchedule = {
    id: nanoid(12),
    missionId: input.missionId,
    missionTitle: input.missionTitle,
    label: input.label,
    cadence: input.cadence,
    enabled: true,
    payload: input.payload,
    connectorIds: input.connectorIds,
    timeOfDay: input.timeOfDay,
    timezone: input.timezone,
    consecutiveFailures: 0,
    autoPauseAfterFailures: normalizeAutoPauseAfterFailures(input.autoPauseAfterFailures),
    createdAt: toIsoString(now),
    updatedAt: toIsoString(now),
    nextRunAt: calculateNextRunAt(input, now),
  };

  await updateState((state) => ({
    ...state,
    missionSchedules: sortSchedules([schedule, ...state.missionSchedules]),
  }));

  return schedule;
}

export async function setMissionScheduleEnabled(scheduleId: string, enabled: boolean, options?: { now?: Date }) {
  const now = options?.now ?? new Date();
  let updated: MissionSchedule | undefined;
  await updateState((state) => ({
    ...state,
    missionSchedules: sortSchedules(
      state.missionSchedules.map((schedule) => {
        if (schedule.id !== scheduleId) return schedule;
        updated = {
          ...schedule,
          enabled,
          updatedAt: toIsoString(now),
          consecutiveFailures: enabled ? 0 : schedule.consecutiveFailures,
          pausedReason: enabled ? undefined : "manual",
          nextRunAt: enabled ? calculateNextRunAt(schedule, now) : schedule.nextRunAt,
        };
        return updated;
      })
    ),
  }));
  return updated;
}

export async function deleteMissionSchedule(scheduleId: string) {
  await updateState((state) => ({
    ...state,
    missionSchedules: state.missionSchedules.filter((schedule) => schedule.id !== scheduleId),
  }));
}

export async function listDueMissionSchedules(now = new Date()) {
  const state = await readState();
  return sortSchedules(
    state.missionSchedules.filter((schedule) => schedule.enabled && new Date(schedule.nextRunAt).getTime() <= now.getTime())
  );
}

export async function markMissionScheduleRun(
  scheduleId: string,
  result: { ok: boolean; summary: string },
  options?: { now?: Date }
) {
  const now = options?.now ?? new Date();
  let updated: MissionSchedule | undefined;
  await updateState((state) => ({
    ...state,
    missionSchedules: sortSchedules(
      state.missionSchedules.map((schedule) => {
        if (schedule.id !== scheduleId) return schedule;
        const consecutiveFailures = result.ok ? 0 : schedule.consecutiveFailures + 1;
        const autoPaused = !result.ok && consecutiveFailures >= schedule.autoPauseAfterFailures;
        updated = {
          ...schedule,
          updatedAt: toIsoString(now),
          lastRunAt: toIsoString(now),
          lastRunStatus: result.ok ? "success" : "error",
          lastRunSummary: result.summary,
          consecutiveFailures,
          enabled: autoPaused ? false : schedule.enabled,
          pausedReason: autoPaused ? "failure-threshold" : undefined,
          nextRunAt: calculateNextRunAt(schedule, now),
        };
        return updated;
      })
    ),
  }));
  return updated;
}