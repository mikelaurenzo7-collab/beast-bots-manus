import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  chatMessages,
  deviceTokens,
  notes,
  oauthConnections,
  oauthState,
  recipes,
  runs,
  subscriptions,
  users,
  webhookEvents,
  type InsertUser,
  type Run,
  type Subscription,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { decryptToken, encryptToken } from "./_core/crypto";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    if (!ENV.databaseUrl) {
      throw new Error("DATABASE_URL is not configured");
    }
    _db = drizzle(ENV.databaseUrl);
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertAppleUser(params: {
  appleSub: string;
  email?: string | null;
  name?: string | null;
}) {
  const db = getDb();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.appleSub, params.appleSub))
    .limit(1);

  if (existing[0]) {
    await db
      .update(users)
      .set({
        email: params.email ?? existing[0].email,
        name: params.name ?? existing[0].name,
        lastSignedIn: new Date(),
      })
      .where(eq(users.id, existing[0].id));
    return existing[0].id;
  }

  const insert: InsertUser = {
    appleSub: params.appleSub,
    email: params.email ?? null,
    name: params.name ?? null,
    lastSignedIn: new Date(),
  };
  await db.insert(users).values(insert);
  const [fresh] = await db
    .select()
    .from(users)
    .where(eq(users.appleSub, params.appleSub))
    .limit(1);
  return fresh.id;
}

export async function getUserById(id: number) {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

// ─── OAuth Connections ────────────────────────────────────────────────────────

export async function listConnections(userId: number) {
  return getDb()
    .select({
      id: oauthConnections.id,
      provider: oauthConnections.provider,
      accountName: oauthConnections.accountName,
      scopes: oauthConnections.scopes,
      expiresAt: oauthConnections.expiresAt,
      createdAt: oauthConnections.createdAt,
    })
    .from(oauthConnections)
    .where(eq(oauthConnections.userId, userId));
}

export async function saveConnection(params: {
  userId: number;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes?: string[];
  expiresAt?: Date;
  accountId?: string;
  accountName?: string;
}) {
  const db = getDb();
  const access = encryptToken(params.accessToken);
  const refresh = params.refreshToken ? encryptToken(params.refreshToken) : null;
  const [existing] = await db
    .select()
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, params.userId),
        eq(oauthConnections.provider, params.provider)
      )
    )
    .limit(1);

  const values = {
    userId: params.userId,
    provider: params.provider,
    accessTokenCiphertext: access.ciphertext,
    tokenIv: access.iv,
    refreshTokenCiphertext: refresh?.ciphertext,
    scopes: params.scopes,
    expiresAt: params.expiresAt,
    accountId: params.accountId,
    accountName: params.accountName,
  };

  if (existing) {
    await db
      .update(oauthConnections)
      .set(values)
      .where(eq(oauthConnections.id, existing.id));
  } else {
    await db.insert(oauthConnections).values(values);
  }
}

export async function deleteConnection(userId: number, provider: string) {
  await getDb()
    .delete(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, provider)
      )
    );
}

export async function getDecryptedAccessToken(userId: number, provider: string) {
  const [conn] = await getDb()
    .select()
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, provider)
      )
    )
    .limit(1);
  if (!conn?.accessTokenCiphertext) return null;
  return decryptToken(conn.accessTokenCiphertext, conn.tokenIv);
}

// ─── OAuth State ──────────────────────────────────────────────────────────────

export async function createOAuthState(params: {
  state: string;
  userId: number;
  providerId: string;
  codeVerifier?: string;
  shop?: string;
  returnTo?: string;
  expiresAt: Date;
}) {
  await getDb().insert(oauthState).values(params);
}

export async function consumeOAuthState(state: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(oauthState)
    .where(and(eq(oauthState.state, state), eq(oauthState.used, false)))
    .limit(1);
  if (!row || row.expiresAt < new Date()) return null;
  await db.update(oauthState).set({ used: true }).where(eq(oauthState.id, row.id));
  return row;
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export async function listRecipes(userId: number) {
  return getDb()
    .select()
    .from(recipes)
    .where(and(eq(recipes.userId, userId), eq(recipes.archived, false)))
    .orderBy(desc(recipes.updatedAt));
}

export async function getRecipe(userId: number, id: number) {
  const [row] = await getDb()
    .select()
    .from(recipes)
    .where(and(eq(recipes.userId, userId), eq(recipes.id, id)))
    .limit(1);
  return row;
}

export async function createRecipe(params: {
  userId: number;
  name: string;
  prompt: string;
  tools: string[];
  triggerKind?: "manual" | "schedule" | "webhook";
  triggerCron?: string;
}) {
  const db = getDb();
  await db.insert(recipes).values({
    userId: params.userId,
    name: params.name,
    prompt: params.prompt,
    tools: params.tools,
    triggerKind: params.triggerKind ?? "manual",
    triggerCron: params.triggerCron,
  });
  const [row] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, params.userId))
    .orderBy(desc(recipes.id))
    .limit(1);
  return row;
}

export async function updateRecipe(
  userId: number,
  id: number,
  patch: Partial<{
    name: string;
    prompt: string;
    tools: string[];
    triggerKind: "manual" | "schedule" | "webhook";
    triggerCron: string | null;
    archived: boolean;
  }>
) {
  await getDb()
    .update(recipes)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(recipes.userId, userId), eq(recipes.id, id)));
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export async function createRun(params: {
  userId: number;
  botSlug: string;
  recipeId?: number;
  inputSummary: string;
}) {
  const db = getDb();
  await db.insert(runs).values({
    userId: params.userId,
    botSlug: params.botSlug,
    recipeId: params.recipeId ?? null,
    inputSummary: params.inputSummary,
    status: "running",
  });
  const [row] = await db
    .select()
    .from(runs)
    .where(eq(runs.userId, params.userId))
    .orderBy(desc(runs.id))
    .limit(1);
  return row;
}

export async function finishRun(
  id: number,
  patch: Partial<Pick<Run, "status" | "outputSummary" | "tokensUsed" | "durationMs" | "errorMessage" | "toolCalls">>
) {
  await getDb().update(runs).set(patch).where(eq(runs.id, id));
}

export async function listRuns(userId: number, limit = 50) {
  return getDb()
    .select()
    .from(runs)
    .where(eq(runs.userId, userId))
    .orderBy(desc(runs.createdAt))
    .limit(limit);
}

/** How many runs the user has created since UTC midnight today. */
export async function countRunsToday(userId: number): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(runs)
    .where(and(eq(runs.userId, userId), sql`${runs.createdAt} >= ${since}`));
  return row?.count ?? 0;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function appendChat(params: {
  userId: number;
  botSlug: string;
  role: "user" | "assistant";
  content: string;
  runId?: number;
}) {
  await getDb().insert(chatMessages).values({
    userId: params.userId,
    botSlug: params.botSlug,
    role: params.role,
    content: params.content,
    runId: params.runId ?? null,
  });
}

export async function loadChat(userId: number, botSlug: string, limit = 100) {
  return getDb()
    .select()
    .from(chatMessages)
    .where(
      and(eq(chatMessages.userId, userId), eq(chatMessages.botSlug, botSlug))
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

export async function clearChat(userId: number, botSlug?: string) {
  const db = getDb();
  if (botSlug) {
    await db
      .delete(chatMessages)
      .where(
        and(eq(chatMessages.userId, userId), eq(chatMessages.botSlug, botSlug))
      );
  } else {
    await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
  }
}

// ─── Notes (built-in tool storage) ────────────────────────────────────────────

export async function createNote(params: { userId: number; title: string; body: string }) {
  const db = getDb();
  await db.insert(notes).values(params);
  const [row] = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, params.userId))
    .orderBy(desc(notes.id))
    .limit(1);
  return row;
}

export async function listNotes(userId: number, limit = 50) {
  return getDb()
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt))
    .limit(limit);
}

export async function getNote(userId: number, id: number) {
  const [row] = await getDb()
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.id, id)))
    .limit(1);
  return row;
}

export async function countNotes(userId: number) {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(notes)
    .where(eq(notes.userId, userId));
  return row?.count ?? 0;
}

// ─── APNs Device Tokens ───────────────────────────────────────────────────────

export async function upsertDeviceToken(params: {
  userId: number;
  deviceToken: string;
  bundleId: string;
  environment: "sandbox" | "production";
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(deviceTokens)
    .where(eq(deviceTokens.deviceToken, params.deviceToken))
    .limit(1);
  if (existing) {
    await db
      .update(deviceTokens)
      .set({ userId: params.userId, bundleId: params.bundleId, environment: params.environment })
      .where(eq(deviceTokens.id, existing.id));
  } else {
    await db.insert(deviceTokens).values(params);
  }
}

export async function deleteDeviceToken(userId: number, deviceToken: string) {
  await getDb()
    .delete(deviceTokens)
    .where(
      and(
        eq(deviceTokens.userId, userId),
        eq(deviceTokens.deviceToken, deviceToken)
      )
    );
}

export async function listDeviceTokens(userId: number) {
  return getDb()
    .select()
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId));
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getSubscription(userId: number) {
  const [row] = await getDb()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return row;
}

export async function upsertSubscription(params: {
  userId: number;
  plan: Subscription["plan"];
  status: Subscription["status"];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}) {
  const db = getDb();
  const existing = await getSubscription(params.userId);
  if (existing) {
    await db
      .update(subscriptions)
      .set({
        plan: params.plan,
        status: params.status,
        stripeCustomerId: params.stripeCustomerId ?? existing.stripeCustomerId,
        stripeSubscriptionId:
          params.stripeSubscriptionId ?? existing.stripeSubscriptionId,
        currentPeriodEnd: params.currentPeriodEnd ?? existing.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd,
      })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values(params);
  }
}

export async function getSubscriptionByStripeCustomer(customerId: string) {
  const [row] = await getDb()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row;
}

// ─── Webhook dedup ───────────────────────────────────────────────────────────

/**
 * Record a webhook event. Returns `true` if this is the first time we've
 * seen (provider, externalId); `false` if we're processing a duplicate.
 * Duplicate-safe thanks to the UNIQUE index.
 */
export async function recordWebhook(params: {
  provider: string;
  externalId: string;
  topic: string;
  userId?: number;
  payload?: unknown;
}): Promise<boolean> {
  try {
    await getDb().insert(webhookEvents).values({
      provider: params.provider,
      externalId: params.externalId,
      topic: params.topic,
      userId: params.userId ?? null,
      payload: params.payload as Record<string, unknown>,
    });
    return true;
  } catch {
    // Duplicate key → already processed.
    return false;
  }
}

/** List OAuth connections whose access token expires within `hours` hours. */
export async function listExpiringConnections(hours: number) {
  const cutoff = new Date(Date.now() + hours * 3_600_000);
  const { lt } = await import("drizzle-orm");
  return getDb()
    .select()
    .from(oauthConnections)
    .where(lt(oauthConnections.expiresAt, cutoff));
}

/** Return a user's id from their Shopify shop domain (myshopify.com host). */
export async function findUserByShopifyShop(shop: string): Promise<number | null> {
  const [row] = await getDb()
    .select({ userId: oauthConnections.userId })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.provider, "shopify"),
        eq(oauthConnections.accountId, shop)
      )
    )
    .limit(1);
  return row?.userId ?? null;
}
