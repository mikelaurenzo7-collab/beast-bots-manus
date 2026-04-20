import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  agentRuns,
  chatMessages,
  installations,
  notifications,
  oauthConnections,
  oauthState,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "avatarUrl"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── OAuth Connections ────────────────────────────────────────────────────────

export async function getOAuthConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(oauthConnections).where(eq(oauthConnections.userId, userId));
}

export async function getOAuthConnection(userId: number, provider: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(oauthConnections)
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, provider)))
    .limit(1);
  return result[0];
}

export async function upsertOAuthConnection(data: {
  userId: number;
  provider: string;
  accessTokenCiphertext?: string;
  refreshTokenCiphertext?: string;
  tokenIv?: string;
  scopes?: string[];
  expiresAt?: Date;
  accountId?: string;
  accountName?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getOAuthConnection(data.userId, data.provider);
  if (existing) {
    await db
      .update(oauthConnections)
      .set({
        accessTokenCiphertext: data.accessTokenCiphertext,
        refreshTokenCiphertext: data.refreshTokenCiphertext,
        tokenIv: data.tokenIv,
        scopes: data.scopes,
        expiresAt: data.expiresAt,
        accountId: data.accountId,
        accountName: data.accountName,
        metadata: data.metadata,
        updatedAt: new Date(),
      })
      .where(eq(oauthConnections.id, existing.id));
  } else {
    await db.insert(oauthConnections).values(data);
  }
}

export async function deleteOAuthConnection(userId: number, provider: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(oauthConnections)
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, provider)));
}

// ─── OAuth State ──────────────────────────────────────────────────────────────

export async function createOAuthState(data: {
  state: string;
  userId: number;
  providerId: string;
  returnTo?: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(oauthState).values(data);
}

export async function consumeOAuthState(state: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(oauthState)
    .where(and(eq(oauthState.state, state), eq(oauthState.used, false)))
    .limit(1);
  if (!result[0]) return undefined;
  if (result[0].expiresAt < new Date()) return undefined;
  await db.update(oauthState).set({ used: true }).where(eq(oauthState.id, result[0].id));
  return result[0];
}

// ─── Installations ────────────────────────────────────────────────────────────

export async function getInstallations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(installations)
    .where(and(eq(installations.userId, userId), eq(installations.status, "active")));
}

export async function getInstallation(userId: number, agentSlug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(installations)
    .where(and(eq(installations.userId, userId), eq(installations.agentSlug, agentSlug)))
    .limit(1);
  return result[0];
}

export async function installAgent(data: {
  userId: number;
  agentSlug: string;
  connectionId?: number;
  customizations?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getInstallation(data.userId, data.agentSlug);
  if (existing) {
    await db
      .update(installations)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(installations.id, existing.id));
  } else {
    await db.insert(installations).values({ ...data, status: "active" });
  }
}

export async function uninstallAgent(userId: number, agentSlug: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(installations)
    .set({ status: "uninstalled", updatedAt: new Date() })
    .where(and(eq(installations.userId, userId), eq(installations.agentSlug, agentSlug)));
}

export async function updateInstallationCustomizations(
  userId: number,
  agentSlug: string,
  customizations: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(installations)
    .set({ customizations, updatedAt: new Date() })
    .where(and(eq(installations.userId, userId), eq(installations.agentSlug, agentSlug)));
}

// ─── Agent Runs ───────────────────────────────────────────────────────────────

export async function createAgentRun(data: {
  installationId: number;
  userId: number;
  agentSlug: string;
  action: string;
  inputSummary?: string;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(agentRuns).values({ ...data, status: "running" });
  return result[0];
}

export async function updateAgentRun(
  id: number,
  data: {
    status: "success" | "error";
    outputSummary?: string;
    tokensUsed?: number;
    durationMs?: number;
    errorMessage?: string;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(agentRuns).set(data).where(eq(agentRuns.id, id));
}

export async function getAgentRuns(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.userId, userId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);
}

export async function getAgentRunsBySlug(userId: number, agentSlug: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.userId, userId), eq(agentRuns.agentSlug, agentSlug)))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(data: {
  userId: number;
  type: "run_complete" | "run_error" | "new_bot" | "system";
  title: string;
  body?: string;
  agentSlug?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function getNotifications(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
}

export async function getUnreadCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return result[0]?.count ?? 0;
}

// ─── Chat Messages ────────────────────────────────────────────────────────────

export async function getChatHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

export async function saveChatMessage(data: {
  userId: number;
  role: "user" | "assistant";
  content: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(chatMessages).values(data);
}

export async function clearChatHistory(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
}

// ─── Notification Helpers ─────────────────────────────────────────────────────
/** Get distinct userIds who have any of the given agent slugs installed */
export async function getUsersWithInstallations(agentSlugs: string[]): Promise<{ userId: number }[]> {
  if (agentSlugs.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const { inArray } = await import("drizzle-orm");
  const results = await db
    .selectDistinct({ userId: installations.userId })
    .from(installations)
    .where(inArray(installations.agentSlug, agentSlugs));
  return results;
}
